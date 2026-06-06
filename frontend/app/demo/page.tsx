"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { SALES_API_URL } from "@/lib/api-config"

const salesBaseUrl = SALES_API_URL

type DemoType = "pretrained" | "custom"
type DemoMode = "sales" | "support"

export default function DemoPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [countryCode, setCountryCode] = useState("+92")
  const [demoType, setDemoType] = useState<DemoType>("pretrained")
  const [mode, setMode] = useState<DemoMode>("sales")
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    companyName: "",
    agentName: "Alex",
    product: "",
    description: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.id]: e.target.value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Build the voice-agent config for the /demo/config endpoint.
    const configBody =
      demoType === "pretrained"
        ? { preset: "techcare", mode }
        : {
            mode,
            company_name: formData.companyName || formData.product || "Your Company",
            agent_name: formData.agentName || "Alex",
            what_we_offer: formData.product,
            details: formData.description,
          }

    try {
      // 1) Train/configure the voice agent (mode + company/product data).
      const cfgRes = await fetch(`${salesBaseUrl}/demo/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configBody),
      })
      if (!cfgRes.ok) {
        setError(`Could not configure the voice agent (HTTP ${cfgRes.status}). Is the sales service running on port 8000?`)
        return
      }

      // 2) Best-effort: keep the scheduling/contact record (non-blocking).
      const fullPhone = `${countryCode} ${formData.phone}`.trim()
      fetch(`${salesBaseUrl}/post-user-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: "",
          phone: fullPhone,
          product: demoType === "pretrained" ? "TechCare AI (pre-trained demo)" : formData.product,
          description: demoType === "pretrained" ? `Pre-trained ${mode} demo` : formData.description,
        }),
      }).catch(() => {})

      // 3) Go to the live voice demo with config already applied.
      router.push(`/voice-demo?ready=1`)
    } catch {
      setError(
        `Cannot reach the sales server at ${salesBaseUrl}. Start it with: cd backend/sales_agent_service/src && ..\\.venv\\Scripts\\python.exe -m calling_agent.main`
      )
    } finally {
      setIsLoading(false)
    }
  }

  const customInvalid = demoType === "custom" && (!formData.product.trim() || !formData.description.trim())

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F8F8] p-4 w-full">
      <Card className="w-full max-w-2xl bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">Book a Demo</CardTitle>
          <CardDescription>
            Try our AI voice agent. Use our ready-made demo, or train it on your own product in seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            {/* Demo type: pre-trained vs custom */}
            <div className="space-y-2">
              <Label>Choose your demo</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDemoType("pretrained")}
                  className={`text-left p-4 rounded-xl border transition ${
                    demoType === "pretrained"
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-gray-200 bg-white hover:border-blue-300"
                  }`}
                >
                  <p className="font-semibold text-gray-900">Use pre-trained demo</p>
                  <p className="text-xs text-gray-600 mt-1">
                    TechCare AI &amp; ServiceFlow AI — product and script already in our database.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setDemoType("custom")}
                  className={`text-left p-4 rounded-xl border transition ${
                    demoType === "custom"
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-gray-200 bg-white hover:border-blue-300"
                  }`}
                >
                  <p className="font-semibold text-gray-900">Create your own demo</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Enter your product details — the agent is trained on them instantly.
                  </p>
                </button>
              </div>
            </div>

            {/* Mode: sales vs support */}
            <div className="space-y-2">
              <Label>Call type</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode("sales")}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border transition ${
                    mode === "sales"
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  Sales call
                </button>
                <button
                  type="button"
                  onClick={() => setMode("support")}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border transition ${
                    mode === "support"
                      ? "bg-purple-500 text-white border-purple-500"
                      : "bg-white text-gray-700 border-gray-300 hover:border-purple-400"
                  }`}
                >
                  Customer support call
                </button>
              </div>
            </div>

            {/* Pre-trained preview */}
            {demoType === "pretrained" && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-1">
                <p className="font-semibold text-gray-900">What the agent will pitch (one product only)</p>
                <p><span className="text-gray-500">Company:</span> TechCare AI (agent: Alex)</p>
                <p><span className="text-gray-500">Product:</span> <strong>ServiceFlow AI</strong> — AI ticket categorization, smart routing, and automated responses.</p>
                <p className="text-gray-500">
                  {mode === "sales"
                    ? "Strong pitch on ServiceFlow only — pain, proof (60% faster responses), free 30-day pilot."
                    : "Support mode for ServiceFlow — troubleshoot tickets, routing, and integrations."}
                </p>
              </div>
            )}

            {/* Custom product fields */}
            {demoType === "custom" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      placeholder="e.g. ClinicPro"
                      className="rounded-xl"
                      value={formData.companyName}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agentName">Agent Name</Label>
                    <Input
                      id="agentName"
                      placeholder="Alex"
                      className="rounded-xl"
                      value={formData.agentName}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product">Product / Service Name</Label>
                  <Input
                    id="product"
                    placeholder="What are you offering?"
                    className="rounded-xl"
                    value={formData.product}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">
                    {mode === "sales" ? "Product details (what to pitch)" : "Service details (for support)"}
                  </Label>
                  <Textarea
                    id="description"
                    placeholder={
                      mode === "sales"
                        ? "Describe your product, key benefits, pricing, and target customer."
                        : "Describe your service, hours, common issues, and how to help customers."
                    }
                    className="min-h-[100px] rounded-xl"
                    value={formData.description}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            {/* Optional contact info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  className="rounded-xl"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number <span className="text-gray-400 font-normal">(optional)</span></Label>
                <div className="flex space-x-2">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="w-[100px] rounded-xl">
                      <SelectValue placeholder="+92" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+92">+92</SelectItem>
                      <SelectItem value="+1">+1</SelectItem>
                      <SelectItem value="+44">+44</SelectItem>
                      <SelectItem value="+91">+91</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter phone number"
                    className="flex-1 rounded-xl"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-600 text-white hover:bg-blue-700 rounded-xl disabled:opacity-60"
              disabled={isLoading || customInvalid}
            >
              {isLoading
                ? "Preparing your agent..."
                : `Start ${mode === "sales" ? "sales" : "support"} demo`}
            </Button>
            {customInvalid && (
              <p className="text-xs text-amber-600 text-center">
                Enter a product name and details to train the agent.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
