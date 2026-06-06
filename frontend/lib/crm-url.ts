import { CRM_API_URL } from '@/lib/api-config'

/** Strip accidental duplicates / whitespace from Vercel env vars (e.g. two URLs in one value). */
export function normalizeApiUrl(raw?: string | null): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return ''
  const match = trimmed.match(/https?:\/\/[^\s,]+/)
  return (match ? match[0] : trimmed.split(/\s+/)[0]).replace(/\/$/, '')
}

/** CRM API base — same-origin proxy in the browser to avoid CORS and cold-start flakes. */
export function getCrmApiBase(): string {
  if (typeof window !== 'undefined') {
    return '/api/crm'
  }
  return normalizeApiUrl(process.env.NEXT_PUBLIC_API_BASE_URL) || CRM_API_URL
}

/** Server-side rewrite target for next.config.mjs (no trailing slash). */
export function getCrmRewriteTarget(): string {
  return normalizeApiUrl(process.env.NEXT_PUBLIC_API_BASE_URL) || CRM_API_URL
}
