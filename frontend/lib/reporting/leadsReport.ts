import type { AnalysisReport } from "@/lib/apis/reportingApis"

type CrmLead = Record<string, unknown>

function parseCrmStatus(item: CrmLead): string {
  if (typeof item.Status === "string" && item.Status) return item.Status
  const info = typeof item.Info === "string" ? item.Info : ""
  const match = info.match(/^\[(\w+)\]/)
  return match?.[1] ?? "Lead"
}

function parseOrganization(item: CrmLead): string {
  if (typeof item.Organization === "string" && item.Organization) return item.Organization
  const location = typeof item.Location === "string" ? item.Location : ""
  return location.split(" — ")[0]?.trim() || location || "Unknown"
}

function countBy(items: string[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, key) => {
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
}

export function buildLeadsAnalysisReport(leads: CrmLead[]): AnalysisReport {
  const crmStatuses = leads.map(parseCrmStatus)
  const callStatuses = leads.map((l) => String(l.status ?? "pending"))
  const organizations = leads.map(parseOrganization)

  const crmCounts = countBy(crmStatuses)
  const callCounts = countBy(callStatuses)
  const orgCounts = countBy(organizations)

  const monthBuckets: Record<string, { leads: number; success: number }> = {}
  for (const lead of leads) {
    const created = lead.created_at ? new Date(String(lead.created_at)) : new Date()
    const key = created.toLocaleString("en-US", { month: "short", year: "2-digit" })
    if (!monthBuckets[key]) monthBuckets[key] = { leads: 0, success: 0 }
    monthBuckets[key].leads += 1
    if (String(lead.status) === "success") monthBuckets[key].success += 1
  }

  const salesOverTime = Object.entries(monthBuckets).map(([month, stats]) => ({
    month,
    sales: stats.success,
    calls: stats.leads,
    leads: stats.leads,
  }))

  const productDistribution = Object.entries(crmCounts).map(([name, value]) => ({ name, value }))
  const salesByChannel = Object.entries(callCounts).map(([name, value]) => ({ name, value }))

  const topOrgs = Object.entries(orgCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({
      name,
      sales: count,
      target: Math.max(1, Math.round(count * 0.85)),
    }))

  const successRate =
    leads.length > 0 ? Math.round(((callCounts.success ?? 0) / leads.length) * 100) : 0

  const summaryPoints = [
    `You have ${leads.length} leads in your CRM pipeline.`,
    `${crmCounts.Customer ?? 0} customers, ${crmCounts.Prospect ?? 0} prospects, and ${crmCounts.Lead ?? 0} new leads.`,
    `${callCounts.success ?? 0} successful calls, ${callCounts.pending ?? 0} pending, ${callCounts.failure ?? 0} failed, ${callCounts.processing ?? 0} in progress.`,
    `Call success rate is approximately ${successRate}% across all leads.`,
    `Top organization: ${topOrgs[0]?.name ?? "N/A"} with ${topOrgs[0]?.sales ?? 0} contacts.`,
  ]

  return {
    schema_info: { source: "dashboard_leads", total_rows: leads.length },
    insights: { summary: summaryPoints.join(" ") },
    chart_requirements: [],
    raw_data: {
      sales_over_time: salesOverTime,
      product_distribution: productDistribution,
      sales_by_channel: salesByChannel,
      regional_performance: topOrgs,
      lead_stats: {
        total: leads.length,
        ...crmCounts,
        call_success: callCounts.success ?? 0,
        call_pending: callCounts.pending ?? 0,
        call_failure: callCounts.failure ?? 0,
        call_processing: callCounts.processing ?? 0,
        success_rate_percent: successRate,
      },
    },
    executive_summary: summaryPoints,
  }
}
