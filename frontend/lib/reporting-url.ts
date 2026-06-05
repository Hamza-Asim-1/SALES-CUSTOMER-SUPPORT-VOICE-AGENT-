/** Reporting API base — uses same-origin proxy in the browser to avoid CORS. */
export function getReportingApiBase(): string {
  if (typeof window !== "undefined") {
    return "/api/reporting"
  }

  const raw =
    process.env.NEXT_PUBLIC_REPORTING_URL?.replace(/\/$/, "") ||
    "http://localhost:6000"

  if (raw.endsWith("/api/v1")) {
    return raw
  }

  return `${raw}/api/v1`
}
