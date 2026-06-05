"use client"
import type React from "react"
import { CardSpotlight } from "./ui/card-spotlight"

export function CardSpotlightComponent({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description: string
  icon: React.ElementType
}) {
  return (
    <CardSpotlight className="bg-gray-800 border-gray-700">
      <div className="flex flex-col items-center text-center p-6">
        <Icon className="w-12 h-12 mb-4 text-purple-400" />
        <h3 className="text-2xl font-semibold mb-2 text-white">{title}</h3>
        <p className="text-gray-300">{description}</p>
      </div>
    </CardSpotlight>
  )
}

