'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { SALES_API_URL } from '@/lib/api-config'

const salesBaseUrl = SALES_API_URL

type ChatMessage = { type: 'user' | 'ai'; text: string }

function mergeTranscriptMessage(
  prev: ChatMessage[],
  role: 'user' | 'ai',
  text: string
): ChatMessage[] {
  const last = prev[prev.length - 1]
  if (last?.type === role) {
    if (last.text === text) return prev
    // Append fragment from the same speaking turn (VAPI sends one final per phrase).
    if (text.startsWith(last.text) || last.text.endsWith(text)) return prev
    return [...prev.slice(0, -1), { type: role, text: `${last.text} ${text}`.trim() }]
  }
  return [...prev, { type: role, text }]
}

function friendlyEndReason(reason: string): string {
  if (reason.includes('assistant-did-not-receive-customer-audio')) {
    return (
      'Could not connect your microphone in time. Allow mic access when prompted, ' +
      'keep this tab in the foreground, then click Start call again.'
    )
  }
  if (reason.includes('customer-did-not-give-microphone-permission')) {
    return 'Microphone permission was denied. Allow the mic in your browser settings and try again.'
  }
  if (reason.includes('silence-timed-out')) {
    return 'Call ended due to silence. Speak after Alex finishes — the mic is always listening.'
  }
  return `Call ended: ${reason.replace(/-/g, ' ')}`
}

function isDailyRoomCloseNoise(msg: string): boolean {
  return (
    msg.includes('Meeting ended due to ejection') ||
    msg.includes('Meeting ended in error') ||
    msg.includes('Meeting has ended')
  )
}

type DemoMode = 'sales' | 'support'

interface DemoConfig {
  mode: DemoMode
  company_name: string
  agent_name: string
  what_we_offer: string
  details: string
}

const DEFAULT_DEMO_CONFIG: DemoConfig = {
  mode: 'sales',
  company_name: 'TechCare AI',
  agent_name: 'Alex',
  what_we_offer: 'AI-powered automation for customer support and sales.',
  details: '',
}

interface VapiAssistantResponse {
  ready?: boolean
  public_key?: string
  assistant?: Record<string, unknown>
  error?: string
  demo_mode?: string
  demo_company?: string
  stack_note?: string
}

function DemoSetupCard({
  config,
  setConfig,
  applied,
  setApplied,
  disabled,
}: {
  config: DemoConfig
  setConfig: (cfg: DemoConfig) => void
  applied: boolean
  setApplied: (v: boolean) => void
  disabled: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const update = (patch: Partial<DemoConfig>) => {
    setApplied(false)
    setConfig({ ...config, ...patch })
  }

  const apply = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch(`${salesBaseUrl}/demo/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        setSaveError(`Failed to save config (HTTP ${res.status})`)
        return
      }
      setApplied(true)
    } catch {
      setSaveError(`Cannot reach ${salesBaseUrl}. Is the backend running?`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mb-6 bg-white/90 backdrop-blur-sm rounded-2xl shadow-md p-5 border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">Demo setup</h2>
        <span
          className={`text-xs px-2 py-1 rounded-full border ${
            applied
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {applied ? 'Applied to agent' : 'Not applied yet'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          onClick={() => update({ mode: 'sales' })}
          className={`px-3 py-2 rounded-xl text-sm font-medium border transition ${
            config.mode === 'sales'
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
          }`}
          disabled={disabled}
        >
          Sales call
        </button>
        <button
          type="button"
          onClick={() => update({ mode: 'support' })}
          className={`px-3 py-2 rounded-xl text-sm font-medium border transition ${
            config.mode === 'support'
              ? 'bg-purple-500 text-white border-purple-500'
              : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
          }`}
          disabled={disabled}
        >
          Customer service call
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Company name</label>
          <Input
            value={config.company_name}
            onChange={(e) => update({ company_name: e.target.value })}
            className="rounded-xl"
            disabled={disabled}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Agent name</label>
          <Input
            value={config.agent_name}
            onChange={(e) => update({ agent_name: e.target.value })}
            className="rounded-xl"
            disabled={disabled}
          />
        </div>
      </div>

      <label className="block text-xs text-gray-600 mb-1">What you offer (one line)</label>
      <Input
        value={config.what_we_offer}
        onChange={(e) => update({ what_we_offer: e.target.value })}
        placeholder="e.g. AI-powered scheduling for clinics"
        className="rounded-xl mb-2"
        disabled={disabled}
      />

      <label className="block text-xs text-gray-600 mb-1">
        Other details (pricing, proof points, target customer — strongly recommended for a sharp pitch)
      </label>
      <textarea
        value={config.details}
        onChange={(e) => update({ details: e.target.value })}
        placeholder={
          config.mode === 'sales'
            ? 'e.g. Target: dental clinics in the US. Pricing: $99/mo. Trial: 14 days.'
            : 'e.g. Hours: 9-5 PT. Common issues: login problems, billing questions, scheduling.'
        }
        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm min-h-[64px] disabled:bg-gray-50"
        disabled={disabled}
      />

      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-gray-500">
          {config.mode === 'sales'
            ? 'Agent will pitch your offering and try to book a follow-up.'
            : 'Agent will listen, ask one question at a time, and help — never sell.'}
        </p>
        <Button
          type="button"
          onClick={apply}
          disabled={saving || disabled}
          className="rounded-xl px-4 py-1.5 text-sm text-white bg-gray-900 hover:bg-black"
        >
          {saving ? 'Saving…' : applied ? 'Re-apply' : 'Apply to agent'}
        </Button>
      </div>

      {saveError && <p className="text-xs text-red-600 mt-2">{saveError}</p>}
    </div>
  )
}

function VoiceCall({
  messages,
  setMessages,
  error,
  setError,
  onClearMessages,
  demoConfig,
  configApplied,
}: {
  messages: ChatMessage[]
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  error: string
  setError: (v: string) => void
  onClearMessages: () => void
  demoConfig: DemoConfig
  configApplied: boolean
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vapiRef = useRef<any>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [volume, setVolume] = useState(0)
  const [stackInfo, setStackInfo] = useState('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      try {
        vapiRef.current?.stop()
      } catch {
        /* ignore teardown errors */
      }
    }
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wireEvents = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vapi: any) => {
      vapi.on('call-start', () => {
        setConnected(true)
        setConnecting(false)
        setError('')
      })
      vapi.on('call-end', () => {
        setConnected(false)
        setConnecting(false)
        setSpeaking(false)
        setListening(false)
        setThinking(false)
        setVolume(0)
      })
      vapi.on('speech-start', () => {
        setSpeaking(true)
        setListening(false)
        setThinking(false)
      })
      vapi.on('speech-end', () => {
        setSpeaking(false)
        setListening(true)
        setThinking(false)
      })
      vapi.on('volume-level', (v: number) => {
        if (typeof v === 'number') setVolume(v)
      })
      vapi.on('message', (message: Record<string, unknown>) => {
        // Surface non-trivial end reasons (e.g. provider failures) to the user.
        if (message.type === 'status-update' && message.status === 'ended') {
          const reason = typeof message.endedReason === 'string' ? message.endedReason : ''
          if (
            reason &&
            !reason.includes('customer-ended-call') &&
            !reason.includes('assistant-ended-call')
          ) {
            setError(friendlyEndReason(reason))
          }
        }
        // Only commit final transcripts to keep the panel clean.
        if (
          message.type === 'transcript' &&
          message.transcriptType === 'final' &&
          typeof message.transcript === 'string'
        ) {
          const role = message.role === 'user' ? 'user' : 'ai'
          const text = message.transcript.trim()
          if (!text) return
          if (role === 'user') {
            setThinking(true)
            setListening(false)
          }
          setMessages((prev) => mergeTranscriptMessage(prev, role, text))
        }
        if (message.type === 'model-output' || message.type === 'conversation-update') {
          setThinking(true)
          setListening(false)
        }
      })
      vapi.on('error', (e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        // Daily.co emits these when the room closes — surfaced via status-update instead.
        if (isDailyRoomCloseNoise(msg)) return
        setError(msg || 'Voice error')
        setConnecting(false)
      })
    },
    [setError, setMessages]
  )

  const beginCall = useCallback(async () => {
    if (!configApplied) {
      setError('Please click "Apply to agent" in the demo setup card first.')
      return
    }
    setError('')
    onClearMessages()
    setConnecting(true)

    try {
      // Fetch config first so VAPI can grab the mic immediately on start (avoids
      // burning the 15s default join timeout on network/import delays).
      const res = await fetch(`${salesBaseUrl}/vapi/assistant`)
      const data = (await res.json()) as VapiAssistantResponse
      if (!res.ok || !data.ready || !data.assistant || !data.public_key) {
        setError(
          data.error ||
            'Voice agent not ready. On Render (fyp-sales), set VAPI_PUBLIC_KEY and PUBLIC_URL=https://fyp-sales.onrender.com, then redeploy.'
        )
        setConnecting(false)
        return
      }

      const { default: Vapi } = await import('@vapi-ai/web')
      if (vapiRef.current) {
        try {
          vapiRef.current.stop()
        } catch {
          /* ignore */
        }
      }
      const vapi = new Vapi(data.public_key)
      wireEvents(vapi)
      vapiRef.current = vapi

      setStackInfo(
        `Mode: ${data.demo_mode} · Company: ${data.demo_company} · Voice: VAPI`
      )

      // VAPI SDK requests mic permission internally — do NOT pre-call getUserMedia
      // or you risk a double prompt and timeout before audio is published.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await vapi.start(data.assistant as any)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start the call')
      setConnecting(false)
    }
  }, [configApplied, onClearMessages, setError, wireEvents])

  const endCall = useCallback(() => {
    try {
      vapiRef.current?.stop()
    } catch {
      /* ignore */
    }
    setConnected(false)
    setConnecting(false)
    setSpeaking(false)
    setListening(false)
    setThinking(false)
  }, [])

  const statusLabel = connected
    ? 'Live — connected'
    : connecting
      ? 'Connecting…'
      : 'Not connected'

  const statusHint = connecting
    ? `Connecting to ${demoConfig.agent_name}… allow microphone when prompted (may take up to 30s).`
    : connected
      ? speaking
        ? `${demoConfig.agent_name} is speaking — talk anytime to interrupt.`
        : thinking
          ? `${demoConfig.agent_name} is thinking — response coming…`
          : listening
            ? 'Your turn — speak now. Pause briefly when you finish your sentence.'
            : 'Connected — speak now.'
      : 'Click Start call, wait for "Live — connected", then speak.'

  const statusColor = connected
    ? 'bg-green-100 text-green-800 border-green-200'
    : connecting
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-gray-100 text-gray-700 border-gray-200'

  return (
    <div className="w-full max-w-2xl">
      <div
        className={`text-center text-xs font-medium mb-3 px-3 py-1.5 rounded-full border w-full ${statusColor}`}
      >
        {statusLabel}
        {connecting && !connected ? ' (allow mic when prompted)' : ''}
      </div>

      <motion.div
        className="w-64 h-64 mx-auto mb-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-500"
        animate={{
          scale: connected ? [1, speaking ? 1.18 : thinking ? 1.12 : listening ? 1.1 : 1.05, 1] : 1,
          opacity: connected ? [0.7, 1, 0.7] : 0.7,
        }}
        transition={{
          duration: speaking ? 0.8 : 1.6,
          repeat: connected ? Infinity : 0,
          repeatType: 'reverse',
        }}
      />

      <p className="text-center text-sm text-gray-600 mb-4">{statusHint}</p>

      {connected && (
        <div className="text-center text-xs text-gray-500 mb-2 space-y-1">
          <p>
            {speaking
              ? `🔊 ${demoConfig.agent_name} speaking`
              : thinking
                ? '💭 Preparing response…'
                : listening
                  ? '🎤 Your turn — speak now'
                  : '…'}
            {volume > 0.02 ? `  ${'●'.repeat(Math.min(10, Math.ceil(volume * 12)))}` : ''}
          </p>
        </div>
      )}

      {stackInfo && (
        <p className="text-xs text-gray-500 mb-3 text-center">{stackInfo}</p>
      )}

      <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-4 mb-4 h-64 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center mt-20">
            {connected
              ? 'Speak now — your words will show up here'
              : 'Conversation transcript appears here'}
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`mb-4 ${message.type === 'user' ? 'text-right' : 'text-left'}`}
          >
            <span
              className={`inline-block p-2 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-black'
              }`}
            >
              {message.text}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4 whitespace-pre-wrap">
          {error}
        </p>
      )}

      <div className="flex justify-center mb-4">
        {connected ? (
          <Button
            onClick={endCall}
            className="rounded-xl px-8 py-2 text-white bg-red-500 hover:bg-red-600"
          >
            End call
          </Button>
        ) : (
          <Button
            onClick={beginCall}
            disabled={connecting || !configApplied}
            className="rounded-xl px-8 py-2 text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-60"
            title={!configApplied ? 'Apply the demo setup first' : undefined}
          >
            {connecting
              ? 'Connecting…'
              : configApplied
                ? `Start ${demoConfig.mode === 'sales' ? 'sales' : 'support'} call`
                : 'Apply setup first'}
          </Button>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center mt-3">
        Brain: LangGraph + Groq via custom LLM · Voice: VAPI (STT + TTS) · Production: sales agent on Render
      </p>
    </div>
  )
}

export default function VoiceDemoPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState('')
  const [demoConfig, setDemoConfig] = useState<DemoConfig>(DEFAULT_DEMO_CONFIG)
  const [configApplied, setConfigApplied] = useState(false)

  const clearMessages = useCallback(() => setMessages([]), [])

  useEffect(() => {
    fetch(`${salesBaseUrl}/demo/config`)
      .then((r) => r.json())
      .then((cfg: DemoConfig) => {
        setDemoConfig({ ...DEFAULT_DEMO_CONFIG, ...cfg })
        // If we arrived from the Book-a-Demo page, the config was already applied
        // there — mark it applied so the user can start the call immediately.
        const ready =
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('ready') === '1'
        if (ready) setConfigApplied(true)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="w-full min-h-screen bg-[#f8f8f8] flex flex-col">
      <main className="flex-grow flex flex-col items-center justify-center pt-24 px-4 pb-12">
        <DemoSetupCard
          config={demoConfig}
          setConfig={setDemoConfig}
          applied={configApplied}
          setApplied={setConfigApplied}
          disabled={false}
        />
        <VoiceCall
          messages={messages}
          setMessages={setMessages}
          error={error}
          setError={setError}
          onClearMessages={clearMessages}
          demoConfig={demoConfig}
          configApplied={configApplied}
        />
      </main>
    </div>
  )
}
