"use client"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useMemo } from "react"
import { createNoise3D } from "simplex-noise"

export const WavyBackground = ({
  children,
  className,
  containerClassName,
  colors,
  waveWidth,
  backgroundFill,
  blur = 10,
  speed = "fast",
  waveOpacity = 0.5,
  ...props
}: {
  children?: any
  className?: string
  containerClassName?: string
  colors?: string[]
  waveWidth?: number
  backgroundFill?: string
  blur?: number
  speed?: "slow" | "fast"
  waveOpacity?: number
  [key: string]: any
}) => {
  const noise = useMemo(() => createNoise3D(), [])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const animationRef = useRef<number>()
  const resizeTimeoutRef = useRef<NodeJS.Timeout>()

  const getSpeed = () => {
    switch (speed) {
      case "slow":
        return 0.001
      case "fast":
        return 0.002
      default:
        return 0.001
    }
  }

  const init = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    contextRef.current = ctx
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight * 1.5
    ctx.filter = `blur(${blur}px)`
  }

  const handleResize = () => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current)
    }
    resizeTimeoutRef.current = setTimeout(() => {
      if (!canvasRef.current || !contextRef.current) return
      canvasRef.current.width = window.innerWidth
      canvasRef.current.height = window.innerHeight * 1.5
      contextRef.current.filter = `blur(${blur}px)`
    }, 100)
  }

  const waveColors = colors ?? ["#FF69B4", "#1E90FF", "#FF1493", "#00BFFF", "#FF69B4"]

  const drawWave = (n: number, t: number) => {
    const ctx = contextRef.current
    if (!ctx || !canvasRef.current) return

    const w = canvasRef.current.width
    const h = canvasRef.current.height

    for (let i = 0; i < n; i++) {
      ctx.beginPath()
      ctx.lineWidth = waveWidth || 50
      ctx.strokeStyle = waveColors[i % waveColors.length]
      for (let x = 0; x < w; x += 5) {
        const y = noise(x / 800, 0.3 * i, t) * 100
        ctx.lineTo(x, y + h * 0.5)
      }
      ctx.stroke()
      ctx.closePath()
    }
  }

  const render = () => {
    const ctx = contextRef.current
    if (!ctx || !canvasRef.current) return

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

    ctx.fillStyle = backgroundFill || "#000000"
    ctx.globalAlpha = waveOpacity || 0.5
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)

    const gradient = ctx.createRadialGradient(
      canvasRef.current.width / 2,
      canvasRef.current.height / 2,
      0,
      canvasRef.current.width / 2,
      canvasRef.current.height / 2,
      canvasRef.current.width / 2,
    )
    gradient.addColorStop(0, "rgba(255,255,255,0.1)")
    gradient.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)

    drawWave(5, performance.now() * getSpeed() * 0.01)
    animationRef.current = requestAnimationFrame(render)
  }

  useEffect(() => {
    init()
    render()
    window.addEventListener("resize", handleResize)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener("resize", handleResize)
    }
  }, [handleResize]) // Added handleResize to the dependency array

  return (
    <div className={cn("relative", containerClassName)}>
      <canvas className="absolute inset-0 z-0" ref={canvasRef} id="canvas"></canvas>
      <div className={cn("relative z-10", className)} {...props}>
        {children}
      </div>
    </div>
  )
}

