"use client"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronRight, Settings, User } from "lucide-react"

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className={`bg-white text-black border-r transition-all duration-300 ${isExpanded ? "w-64" : "w-16"}`}>
      <Button
        variant="ghost"
        className="w-full p-4 flex justify-center text-black hover:bg-gray-100"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ChevronRight className={`transform transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </Button>
      <nav className="mt-8">
        <ul className="space-y-2">
          <li>
            <Link href="/settings" className="flex items-center p-4 hover:bg-gray-100 text-black">
              <Settings className="w-6 h-6" />
              {isExpanded && <span className="ml-4">Settings</span>}
            </Link>
          </li>
          <li>
            <Link href="/account" className="flex items-center p-4 hover:bg-gray-100 text-black">
              <User className="w-6 h-6" />
              {isExpanded && <span className="ml-4">Account</span>}
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  )
}

