'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, PhoneOff, ShoppingCart, UserPlus } from 'lucide-react'
import {
  createVoiceSession,
  endVoiceSession,
  handoffSession,
  postTurn,
  sessionEventsUrl,
} from '@/lib/apis/salesApi'

type ChatMessage = { type: 'user' | 'ai'; text: string }
type OrderEvent = { order_id?: string; product_name?: string; quantity?: number; total_price?: number; currency?: string }

interface LiveCallProps {
  userId: string
  lead: { id: number | string; Name?: string; Contact?: string; Email?: string }
  mode: 'sales' | 'support'
  onClose: () => void
}

function mergeMsg(prev: ChatMessage[], role: 'user' | 'ai', text: string): ChatMessage[] {
  const last = prev[prev.length - 1]
  if (last?.type === role) {
    if (last.text === text || text.startsWith(last.text) || last.text.endsWith(text)) return prev
    return [...prev.slice(0, -1), { type: role, text: `${last.text} ${text}`.trim() }]
  }
  return [...prev, { type: role, text }]
}

function sentimentColor(score: number): string {
  if (score < 30) return 'bg-red-500'
  if (score < 50) return 'bg-orange-400'
  if (score < 70) return 'bg-yellow-400'
  return 'bg-green-500'
}

export function LiveCall({ userId, lead, mode, onClose }: LiveCallProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vapiRef = useRef<any>(null)
  const esRef = useRef<EventSource | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const [phase, setPhase] = useState<'idle' | 'connecting' | 'live' | 'ended'>('idle')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState('')
  const [speaking, setSpeaking] = useState(false)

  const [score, setScore] = useState(70)
  const [emotion, setEmotion] = useState('neutral')
  const [history, setHistory] = useState<number[]>([])
  const [escalated, setEscalated] = useState(false)
  const [humanPresent, setHumanPresent] = useState(false)
  const [orders, setOrders] = useState<OrderEvent[]>([])
  const [handoffText, setHandoffText] = useState('')

  const endRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const cleanup = useCallback(() => {
    try {
      vapiRef.current?.stop()
    } catch {
      /* ignore */
    }
    esRef.current?.close()
    esRef.current = null
    if (sessionIdRef.current) endVoiceSession(sessionIdRef.current)
  }, [])

  useEffect(() => cleanup, [cleanup])

  const openEventStream = useCallback((sessionId: string) => {
    const es = new EventSource(sessionEventsUrl(sessionId))
    esRef.current = es
    es.onmessage = (e) => {
      let data: Record<string, unknown>
      try {
        data = JSON.parse(e.data)
      } catch {
        return
      }
      switch (data.type) {
        case 'snapshot':
        case 'sentiment': {
          if (typeof data.score === 'number') {
            setScore(data.score)
            setHistory((h) => [...h.slice(-39), data.score as number])
          }
          if (typeof data.emotion === 'string') setEmotion(data.emotion)
          if (data.type === 'snapshot' && Array.isArray(data.orders)) setOrders(data.orders as OrderEvent[])
          break
        }
        case 'escalation':
          setEscalated(true)
          break
        case 'handoff':
          setHumanPresent(true)
          setEscalated(true)
          break
        case 'order':
          if (data.order) setOrders((o) => [...o, data.order as OrderEvent])
          break
        default:
          break
      }
    }
    es.onerror = () => {
      /* EventSource auto-reconnects; nothing to do */
    }
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wireVapi = useCallback((vapi: any, sessionId: string) => {
    vapi.on('call-start', () => {
      setPhase('live')
      setError('')
    })
    vapi.on('call-end', () => setPhase('ended'))
    vapi.on('speech-start', () => setSpeaking(true))
    vapi.on('speech-end', () => setSpeaking(false))
    vapi.on('message', (m: Record<string, unknown>) => {
      if (
        m.type === 'transcript' &&
        m.transcriptType === 'final' &&
        typeof m.transcript === 'string'
      ) {
        const role = m.role === 'user' ? 'user' : 'ai'
        const text = (m.transcript as string).trim()
        if (!text) return
        setMessages((prev) => mergeMsg(prev, role, text))
        // Forward to backend: user turns get scored; assistant turns get stored.
        postTurn(sessionId, role === 'user' ? 'user' : 'assistant', text)
      }
    })
    vapi.on('error', (e: unknown) => {
      console.error('[vapi error]', e)
      setError(typeof e === 'string' ? e : (e as Error)?.message || 'Voice provider error')
    })
  }, [])

  const start = useCallback(async () => {
    setError('')
    setMessages([])
    setPhase('connecting')
    try {
      const session = await createVoiceSession(userId, lead.id, mode)
      if (!session.ready || !session.assistant || !session.public_key) {
        setError(
          session.error ||
            'Voice agent not ready. Set VAPI_PUBLIC_KEY and PUBLIC_URL on the sales service.'
        )
        setPhase('idle')
        return
      }
      sessionIdRef.current = session.session_id
      openEventStream(session.session_id)

      const { default: Vapi } = await import('@vapi-ai/web')
      const vapi = new Vapi(session.public_key)
      wireVapi(vapi, session.session_id)
      vapiRef.current = vapi
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await vapi.start(session.assistant as any)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start the call')
      setPhase('idle')
    }
  }, [userId, lead.id, mode, openEventStream, wireVapi])

  const takeOver = useCallback(async () => {
    if (!sessionIdRef.current) return
    await handoffSession(sessionIdRef.current)
    setHumanPresent(true)
  }, [])

  const sendHumanLine = useCallback(() => {
    const text = handoffText.trim()
    if (!text || !sessionIdRef.current) return
    // Speak the human's words through the call if the SDK supports it.
    try {
      vapiRef.current?.say?.(text)
    } catch {
      /* some SDK versions lack say(); the line still shows in the transcript */
    }
    setMessages((prev) => mergeMsg(prev, 'ai', text))
    postTurn(sessionIdRef.current, 'assistant', text)
    setHandoffText('')
  }, [handoffText])

  const hangUp = useCallback(() => {
    cleanup()
    setPhase('ended')
    onClose()
  }, [cleanup, onClose])

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* ---- Left: call + transcript ---- */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-semibold">{lead.Name || 'Lead'}</p>
            <p className="text-xs text-muted-foreground">
              {lead.Contact || lead.Email || '—'} · {mode === 'sales' ? 'Sales' : 'Support'} call
            </p>
          </div>
          <Badge variant={phase === 'live' ? 'default' : 'outline'}>
            {phase === 'live' ? 'Live' : phase === 'connecting' ? 'Connecting…' : phase === 'ended' ? 'Ended' : 'Ready'}
          </Badge>
        </div>

        <motion.div
          className="w-28 h-28 mx-auto my-3 rounded-full bg-gradient-to-r from-blue-400 to-purple-500"
          animate={{
            scale: phase === 'live' ? [1, speaking ? 1.15 : 1.05, 1] : 1,
            opacity: phase === 'live' ? [0.7, 1, 0.7] : 0.7,
          }}
          transition={{ duration: speaking ? 0.8 : 1.6, repeat: phase === 'live' ? Infinity : 0, repeatType: 'reverse' }}
        />

        <div className="bg-white rounded-lg border p-3 h-56 overflow-y-auto text-sm">
          {messages.length === 0 && (
            <p className="text-gray-400 text-center mt-16">
              {phase === 'live' ? 'Speak now — transcript appears here' : 'Press Start call to begin'}
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`mb-2 ${m.type === 'user' ? 'text-right' : 'text-left'}`}>
              <span className={`inline-block px-2 py-1 rounded-lg ${m.type === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'}`}>
                {m.text}
              </span>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 mt-2 whitespace-pre-wrap">{error}</p>
        )}

        <div className="flex gap-2 mt-3">
          {phase === 'idle' || phase === 'ended' ? (
            <Button onClick={start} className="flex-1 bg-blue-600 hover:bg-blue-700">
              Start call
            </Button>
          ) : (
            <Button onClick={hangUp} className="flex-1 bg-red-600 hover:bg-red-700">
              <PhoneOff className="h-4 w-4 mr-2" /> End call
            </Button>
          )}
        </div>
      </div>

      {/* ---- Right: realtime analytics ---- */}
      <div className="space-y-3">
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Customer sentiment</span>
            <Badge variant="outline" className="capitalize">{emotion}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${sentimentColor(score)}`}
                style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
              />
            </div>
            <span className="text-sm font-semibold w-10 text-right">{Math.round(score)}%</span>
          </div>
          {/* sparkline */}
          <div className="flex items-end gap-0.5 h-10 mt-2">
            {history.map((s, i) => (
              <div
                key={i}
                className={`flex-1 ${sentimentColor(s)} rounded-sm`}
                style={{ height: `${Math.max(6, s)}%` }}
                title={`${Math.round(s)}%`}
              />
            ))}
          </div>
        </div>

        {escalated && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3">
            <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1">
              <AlertTriangle className="h-4 w-4" /> Sentiment low — human recommended
            </div>
            {!humanPresent ? (
              <Button size="sm" onClick={takeOver} className="bg-red-600 hover:bg-red-700">
                <UserPlus className="h-4 w-4 mr-2" /> Take over as human
              </Button>
            ) : (
              <div className="flex gap-2 mt-1">
                <input
                  value={handoffText}
                  onChange={(e) => setHandoffText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendHumanLine()}
                  placeholder="Type a reply to the customer…"
                  className="flex-1 border rounded px-2 py-1 text-sm"
                />
                <Button size="sm" onClick={sendHumanLine}>Send</Button>
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <ShoppingCart className="h-4 w-4" /> Orders this call ({orders.length})
          </div>
          {orders.length === 0 ? (
            <p className="text-xs text-muted-foreground">No orders placed yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {orders.map((o, i) => (
                <li key={o.order_id || i} className="flex justify-between">
                  <span>{o.quantity}× {o.product_name}</span>
                  <span className="font-medium">{o.currency || 'USD'} {o.total_price}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-[11px] text-gray-400">
          Brain: LangGraph/Groq + tools · Voice: VAPI · Sentiment: realtime per turn
        </p>
      </div>
    </div>
  )
}
