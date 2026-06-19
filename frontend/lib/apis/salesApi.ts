// Client for the sales service (SALES_API_URL): voice-call lifecycle + the
// business REST API (company profile, products with live stock/price, orders).
import { SALES_API_URL } from '@/lib/api-config'

const base = SALES_API_URL.replace(/\/$/, '')

export interface Product {
  product_id?: string
  user_id?: string
  name: string
  description?: string
  price: number | string
  currency?: string
  stock: number | string
  sku?: string
}

export interface Order {
  order_id: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  currency?: string
  status: string
  customer_name?: string
  customer_contact?: string
  created_at?: string
}

export interface CompanyProfile {
  user_id?: string
  company_name: string
  description?: string
  website?: string
  social_links?: string[]
  mode?: string
  agent_name?: string
  pitch_details?: string
}

export interface VoiceSession {
  ready: boolean
  session_id: string
  public_key?: string
  assistant?: Record<string, unknown>
  mode?: string
  company_name?: string
  agent_name?: string
  customer?: Record<string, unknown>
  product_count?: number
  error?: string
}

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || data?.detail || `HTTP ${res.status}`)
  return data
}

// ---- Company profile -------------------------------------------------
export async function getCompanyProfile(userId: string): Promise<CompanyProfile | null> {
  const res = await fetch(`${base}/company/profile?user_id=${encodeURIComponent(userId)}`)
  const data = await jsonOrThrow(res)
  return data.profile ?? null
}

export async function saveCompanyProfile(
  userId: string,
  profile: Partial<CompanyProfile>,
  products?: Partial<Product>[]
): Promise<{ profile: CompanyProfile; products: Product[] }> {
  const res = await fetch(`${base}/company/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, ...profile, products }),
  })
  return jsonOrThrow(res)
}

// ---- Products --------------------------------------------------------
export async function listProducts(userId: string): Promise<Product[]> {
  const res = await fetch(`${base}/company/products?user_id=${encodeURIComponent(userId)}`)
  const data = await jsonOrThrow(res)
  return data.products ?? []
}

export async function createProduct(userId: string, product: Partial<Product>): Promise<Product> {
  const res = await fetch(`${base}/company/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, ...product }),
  })
  const data = await jsonOrThrow(res)
  return data.product
}

export async function updateProduct(
  userId: string,
  productId: string,
  patch: Partial<Product>
): Promise<Product> {
  const res = await fetch(`${base}/company/products/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, ...patch }),
  })
  const data = await jsonOrThrow(res)
  return data.product
}

export async function deleteProduct(userId: string, productId: string): Promise<boolean> {
  const res = await fetch(
    `${base}/company/products/${productId}?user_id=${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  )
  const data = await jsonOrThrow(res)
  return data.ok
}

// ---- Orders ----------------------------------------------------------
export async function listOrders(userId: string): Promise<Order[]> {
  const res = await fetch(`${base}/company/orders?user_id=${encodeURIComponent(userId)}`)
  const data = await jsonOrThrow(res)
  return data.orders ?? []
}

export interface BusinessMetrics {
  total_sales: number
  total_orders: number
  units_sold: number
  total_calls: number
  escalated_calls: number
  avg_sentiment: number | null
  leads: number
  conversion_rate: number
}

export async function getMetrics(userId: string): Promise<BusinessMetrics | null> {
  try {
    const res = await fetch(`${base}/company/metrics?user_id=${encodeURIComponent(userId)}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ---- Voice call lifecycle -------------------------------------------
export async function createVoiceSession(
  userId: string,
  leadId: string | number | null,
  mode: 'sales' | 'support'
): Promise<VoiceSession> {
  const res = await fetch(`${base}/voice/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, lead_id: leadId, mode }),
  })
  return res.json()
}

export async function postTurn(sessionId: string, role: 'user' | 'assistant', text: string) {
  try {
    await fetch(`${base}/voice/session/${sessionId}/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, text }),
    })
  } catch {
    /* non-fatal: transcript display is independent of scoring */
  }
}

export async function handoffSession(sessionId: string) {
  await fetch(`${base}/voice/session/${sessionId}/handoff`, { method: 'POST' })
}

export async function endVoiceSession(sessionId: string) {
  try {
    await fetch(`${base}/voice/session/${sessionId}/end`, { method: 'POST' })
  } catch {
    /* ignore */
  }
}

export function sessionEventsUrl(sessionId: string): string {
  return `${base}/voice/session/${sessionId}/events`
}
