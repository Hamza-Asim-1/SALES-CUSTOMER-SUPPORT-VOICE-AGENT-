import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let userConfig = undefined
try {
  userConfig = await import('./v0-user-next.config')
} catch (e) {
  // ignore error
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const reportingUrl =
      process.env.NEXT_PUBLIC_REPORTING_URL?.replace(/\/$/, "") ||
      "http://localhost:6000"
    const reportingBase = reportingUrl.endsWith("/api/v1")
      ? reportingUrl
      : `${reportingUrl}/api/v1`

    const crmRaw = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim()
    const crmMatch = crmRaw.match(/https?:\/\/[^\s,]+/)
    const crmUrl = (
      crmMatch ? crmMatch[0] : crmRaw.split(/\s+/)[0] || "https://fyp-crm.onrender.com"
    ).replace(/\/$/, "")

    return [
      {
        source: "/api/reporting/:path*",
        destination: `${reportingBase}/:path*`,
      },
      {
        source: "/api/crm/:path*",
        destination: `${crmUrl}/:path*`,
      },
    ]
  },
  webpack: (config, { isServer }) => {
    // Disable persistent cache — avoids ENOSPC failures on low disk space during dev.
    config.cache = false
    if (!isServer) {
      // Exact alias only — keeps @elevenlabs/client/internal working for @elevenlabs/react.
      config.resolve.alias['@elevenlabs/client$'] = path.resolve(
        __dirname,
        'node_modules/@elevenlabs/client/dist/platform/web/index.js'
      )
      config.resolve.mainFields = ['browser', 'module', 'main']
    }
    return config
  },
}

mergeConfig(nextConfig, userConfig)

function mergeConfig(nextConfig, userConfig) {
  if (!userConfig) {
    return
  }

  for (const key in userConfig) {
    if (
      typeof nextConfig[key] === 'object' &&
      !Array.isArray(nextConfig[key])
    ) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...userConfig[key],
      }
    } else {
      nextConfig[key] = userConfig[key]
    }
  }
}

export default nextConfig
