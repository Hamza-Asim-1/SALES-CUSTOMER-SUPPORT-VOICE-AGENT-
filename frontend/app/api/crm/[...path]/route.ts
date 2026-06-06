import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function crmBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').trim()
  const match = raw.match(/https?:\/\/[^\s,]+/)
  return (
    match ? match[0] : raw.split(/\s+/)[0] || 'https://fyp-crm.onrender.com'
  ).replace(/\/$/, '')
}

async function proxyRequest(req: NextRequest, pathSegments: string[]) {
  const path = pathSegments.join('/')
  const target = new URL(`${crmBase()}/${path}`)
  target.search = req.nextUrl.search

  const init: RequestInit = {
    method: req.method,
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text()
  }

  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(target.toString(), init)
      const body = await res.text()
      return new NextResponse(body, {
        status: res.status,
        headers: {
          'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
        },
      })
    } catch (error) {
      lastError = error
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 15000))
      }
    }
  }

  const detail = lastError instanceof Error ? lastError.message : 'CRM unreachable'
  return NextResponse.json({ detail }, { status: 502 })
}

type RouteCtx = { params: Promise<{ path: string[] }> }

async function handle(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params
  return proxyRequest(req, path)
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx)
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx)
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx)
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx)
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx)
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
