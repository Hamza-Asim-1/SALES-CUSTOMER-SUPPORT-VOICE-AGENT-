"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { WavyBackground } from "@/components/ui/wavy-background"

interface AuthPageShellProps {
  title: string
  subtitle: string
  children: React.ReactNode
}

export function AuthPageShell({ title, subtitle, children }: AuthPageShellProps) {
  return (
    <div className="min-h-screen bg-black text-white">
      <WavyBackground
        className="min-h-screen flex items-center justify-center px-4 py-16"
        backgroundFill="black"
        colors={["#7c3aed", "#9333ea", "#6366f1", "#4f46e5"]}
        waveOpacity={0.35}
      >
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="mb-8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-600 flex items-center justify-center text-white font-bold">
              A
            </div>
            <div>
              <p className="text-lg font-semibold bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
                AI Sales
              </p>
              <p className="text-xs text-gray-400">Voice agents for your business</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl shadow-purple-900/20 p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">{title}</h1>
              <p className="text-gray-400 mt-1">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </WavyBackground>
    </div>
  )
}
