"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useDispatch } from "react-redux"
import { login } from "@/app/store/features/authSlice"
import { fetchCurrentUser } from "@/lib/apis/authApi"
import { AuthPageShell } from "@/components/auth-page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const router = useRouter()
  const dispatch = useDispatch()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const authBaseUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:2000"

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch(`${authBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        const token = data.access_token ?? data.token
        if (!token) {
          setError("Login succeeded but no token was returned.")
          return
        }

        localStorage.setItem("token", token)
        const profile = await fetchCurrentUser(token)
        dispatch(
          login({
            user: {
              id: profile.id,
              name: profile.username,
              email: profile.email,
            },
            token,
          })
        )
        router.push("/dashboard")
      } else {
        setError(data.detail || "Login failed")
      }
    } catch {
      setError(
        `Cannot reach the auth server. Start it with: cd backend/auth-service && uvicorn app.main:app --reload --port 2000`
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthPageShell title="Welcome back" subtitle="Sign in to your account to continue">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-200">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus-visible:ring-purple-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-gray-200">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus-visible:ring-purple-500"
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
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-400">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-purple-300 hover:text-purple-200 font-medium">
          Sign up
        </Link>
      </p>

      <p className="mt-3 text-center text-xs text-gray-500">
        Demo: demo@techcare.ai / Demo123!@#
      </p>
    </AuthPageShell>
  )
}
