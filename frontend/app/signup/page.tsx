"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AuthPageShell } from "@/components/auth-page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SignupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const authBaseUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:2000"
  const [formData, setFormData] = useState({
    businessName: "",
    email: "",
    password: "",
    username: "",
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch(`${authBaseUrl}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: formData.businessName,
          email: formData.email,
          password: formData.password,
          username: formData.username,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const detail = data.detail
        const message = Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(", ")
          : typeof detail === "string"
            ? detail
            : "Could not create account. Check that the auth service is running on port 2000."
        setError(message)
      } else {
        router.push("/login?registered=1")
      }
    } catch {
      setError(
        `Cannot reach the auth server at ${authBaseUrl}. Start it with: cd backend/auth-service && uvicorn app.main:app --reload --port 2000`
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    })
  }

  const inputClass =
    "rounded-xl border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus-visible:ring-purple-500"

  return (
    <AuthPageShell title="Create an account" subtitle="Get started with your free account">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="businessName" className="text-gray-200">
            Business Name
          </Label>
          <Input
            id="businessName"
            placeholder="Enter your business name"
            required
            className={inputClass}
            value={formData.businessName}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-200">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            required
            className={inputClass}
            value={formData.email}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username" className="text-gray-200">
            Username
          </Label>
          <Input
            id="username"
            placeholder="Enter a username"
            required
            className={inputClass}
            value={formData.username}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-gray-200">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Create a password"
            required
            className={inputClass}
            value={formData.password}
            onChange={handleChange}
          />
        </div>

        {error && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full rounded-xl bg-purple-600 text-white hover:bg-purple-700 h-11"
          disabled={isLoading}
        >
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-400">
        Already have an account?{" "}
        <Link href="/login" className="text-purple-300 hover:text-purple-200 font-medium">
          Sign in
        </Link>
      </p>
    </AuthPageShell>
  )
}
