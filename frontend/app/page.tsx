"use client"
import { useState, useEffect } from "react"
import { CardSpotlightComponent } from "@/components/card-spotlight"
import { WavyBackground } from "@/components/ui/wavy-background"
import { TypedTextEffect } from "@/components/ui/typed-text-effect"
import { Banner } from "@/components/banner"
import { Briefcase, CheckSquare, Heart, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

export default function Home() {
  const [completedLines, setCompletedLines] = useState<string[]>([])
  const lines = ["Reach your customers.", "Wherever. Whenever."]
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Set visibility after a short delay to allow for animation
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  const fadeInUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
      },
    },
  }

  const staggerContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden w-full">
      <WavyBackground className="min-h-screen pb-20">
        <div className="container mx-auto px-4 pt-24">
          <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-4xl md:text-5xl lg:text-7xl font-bold mb-6 leading-tight mix-blend-difference space-y-4"
            >
              {/* First line */}
              <div>
                {completedLines.includes(lines[0]) ? (
                  <span className="inline-block">{lines[0]}</span>
                ) : (
                  <TypedTextEffect
                    strings={[lines[0]]}
                    className="inline-block"
                    speed={50}
                    onComplete={() => setCompletedLines((prev) => [...prev, lines[0]])}
                  />
                )}
              </div>

              {/* Second line */}
              <div>
                {completedLines.includes(lines[0]) &&
                  (completedLines.includes(lines[1]) ? (
                    <span className="inline-block">{lines[1]}</span>
                  ) : (
                    <TypedTextEffect
                      strings={[lines[1]]}
                      className="inline-block"
                      speed={50}
                      onComplete={() => setCompletedLines((prev) => [...prev, lines[1]])}
                    />
                  ))}
              </div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              className="text-xl md:text-2xl mb-12 mix-blend-difference max-w-2xl"
            >
              AI-powered voice agents that transform how businesses connect with customers, delivering personalized
              experiences at scale.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.6 }}
            >
              <Link href="/demo">
                <Button
                  size="lg"
                  className="bg-purple-600 text-white hover:bg-purple-700 rounded-full px-10 py-6 text-xl transition-all hover:shadow-lg group"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </motion.div>
          </div>

          <motion.section
            className="py-24"
            initial="hidden"
            animate={isVisible ? "visible" : "hidden"}
            variants={staggerContainerVariants}
          >
            <motion.h2 className="text-3xl md:text-4xl font-bold text-center mb-16" variants={fadeInUpVariants}>
              Powerful AI Voice Solutions
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <motion.div variants={fadeInUpVariants}>
                <CardSpotlightComponent
                  title="Inbound Sales Agent"
                  description="Instantly deploy the Inbound Sales Agent on your contact or pricing pages, trained on millions of hours of sales calls."
                  icon={Briefcase}
                />
              </motion.div>
              <motion.div variants={fadeInUpVariants}>
                <CardSpotlightComponent
                  title="Survey Agent"
                  description="Engage customers with the Survey Agent, offering quick feedback through natural conversation."
                  icon={CheckSquare}
                />
              </motion.div>
              <motion.div variants={fadeInUpVariants}>
                <CardSpotlightComponent
                  title="Customer Satisfaction Agent"
                  description="The Customer Satisfaction Survey Agent helps you gather real-time feedback and insights."
                  icon={Heart}
                />
              </motion.div>
            </div>
          </motion.section>
        </div>
      </WavyBackground>

      <motion.div
        className="flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
      >
        <Banner />
      </motion.div>

      <main className="container mx-auto px-4 pt-5">
        <motion.section
          className="py-24"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="text-center">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">Ready to get started?</h2>
            <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
              Transform your customer interactions with AI-powered voice agents that deliver results.
            </p>
            <Link href="/demo">
              <Button
                size="lg"
                className="bg-purple-600 text-white hover:bg-purple-700 rounded-full px-10 py-6 text-xl transition-all hover:shadow-lg group"
              >
                Book a Demo
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </motion.section>
      </main>

      <footer className="bg-black py-16 border-t border-gray-800">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div>
              <h3 className="font-bold text-2xl mb-6 flex items-center">
                <div className="h-8 w-8 rounded-md bg-purple-600 flex items-center justify-center text-white font-bold mr-2">
                  A
                </div>
                <span>AI Sales</span>
              </h3>
              <p className="text-gray-400 text-lg">AI-powered voice agents for your business</p>
            </div>
            <div>
              <h4 className="font-bold text-xl mb-6">Product</h4>
              <ul className="space-y-4">
                <li>
                  <Link href="#" className="text-gray-400 hover:text-white text-lg">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-400 hover:text-white text-lg">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-400 hover:text-white text-lg">
                    Enterprise
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-xl mb-6">Company</h4>
              <ul className="space-y-4">
                <li>
                  <Link href="#" className="text-gray-400 hover:text-white text-lg">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-400 hover:text-white text-lg">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-400 hover:text-white text-lg">
                    Careers
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-xl mb-6">Legal</h4>
              <ul className="space-y-4">
                <li>
                  <Link href="#" className="text-gray-400 hover:text-white text-lg">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-400 hover:text-white text-lg">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-400 hover:text-white text-lg">
                    Security
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-16 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p className="text-lg">&copy; {new Date().getFullYear()} AI Sales. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

