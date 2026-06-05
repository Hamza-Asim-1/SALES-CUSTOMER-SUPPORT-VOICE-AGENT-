"use client"
import { useEffect, useState } from "react"
import { motion, useAnimate, stagger } from "framer-motion"
import { cn } from "@/lib/utils"

export const TextGenerateEffect = ({
  words,
  className,
  speed = 0.05,
  onComplete,
}: {
  words: string
  className?: string
  speed?: number
  onComplete?: () => void
}) => {
  const [scope, animate] = useAnimate()
  const wordsArray = words.split(" ")
  const [isAnimating, setIsAnimating] = useState(true)

  useEffect(() => {
    if (isAnimating) {
      animate(
        "span",
        {
          opacity: 1,
        },
        {
          duration: 0.5,
          delay: stagger(speed),
          onComplete: () => {
            setIsAnimating(false)
            if (onComplete) onComplete()
          },
        },
      )
    }
  }, [animate, speed, isAnimating, onComplete])

  return (
    <motion.div ref={scope} className={cn("font-bold", className)}>
      {wordsArray.map((word, idx) => (
        <motion.span key={`${word}-${idx}`} className="opacity-0 inline-block mr-1">
          {word}
        </motion.span>
      ))}
    </motion.div>
  )
}

