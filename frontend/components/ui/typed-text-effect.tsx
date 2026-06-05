"use client"
import type React from "react"
import { useEffect, useRef } from "react"
import Typed from "typed.js"

interface TypedTextEffectProps {
  strings: string[]
  className?: string
  speed?: number
  onComplete?: () => void
}

export const TypedTextEffect: React.FC<TypedTextEffectProps> = ({
  strings,
  className = "",
  speed = 50,
  onComplete,
}) => {
  const el = useRef(null)
  const typed = useRef<Typed | null>(null)

  useEffect(() => {
    const options = {
      strings: strings,
      typeSpeed: speed,
      onComplete: () => {
        if (onComplete && typeof onComplete === "function") {
          onComplete()
        }
      },
      showCursor: false,
    }

    typed.current = new Typed(el.current!, options)

    return () => {
      typed.current?.destroy()
    }
  }, [strings, speed, onComplete])

  return <span ref={el} className={className} />
}

