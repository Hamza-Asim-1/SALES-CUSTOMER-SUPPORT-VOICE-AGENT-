"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { useDispatch, useSelector } from "react-redux"
import { logout } from "@/app/store/features/authSlice"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import type { RootState } from "@/app/store/store"

const landingNavItems = [
  { name: "Dashboard", link: "/dashboard" },
  { name: "Demo", link: "/demo" },
]

export function Navbar() {
  const pathname = usePathname()
  const isHomePage = pathname === "/"
  const { toggleSidebar } = useSidebar()
  const dispatch = useDispatch()
  const router = useRouter()
  const { isAuthenticated } = useSelector((state: RootState) => state.auth)

  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Handle scroll effect for transparent to solid navbar
  useEffect(() => {
    const handleScroll = () => {
      const offset = window.scrollY
      if (offset > 50) {
        setScrolled(true)
      } else {
        setScrolled(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  const handleLogout = () => {
    // Clear token from localStorage
    localStorage.removeItem("token")

    // Dispatch logout action
    dispatch(logout())

    // Redirect to login page
    router.push("/login")
  }

  // Landing page navbar
  if (isHomePage) {
    return (
      <>
        <header
          className={`py-4 fixed w-full z-50 transition-all duration-500 ${
            scrolled ? "bg-black/80 backdrop-blur-md shadow-md" : "bg-transparent"
          }`}
        >
          <nav className="container mx-auto px-6 flex justify-between items-center">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Link href="/" className="text-2xl font-bold text-white flex items-center">
                <div className="h-8 w-8 rounded-md bg-purple-600 flex items-center justify-center text-white font-bold mr-2">
                  A
                </div>
                <span className="bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
                  AI Sales
                </span>
              </Link>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              <ul className="flex space-x-2 mr-6">
                {landingNavItems.map((item, index) => (
                  <motion.li
                    key={item.name}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 + index * 0.1 }}
                  >
                    <Link
                      href={item.link}
                      className="relative px-3 py-2 text-white hover:text-purple-300 transition-colors group"
                    >
                      {item.name}
                      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-purple-500 transform scale-x-0 origin-left transition-transform group-hover:scale-x-100"></span>
                    </Link>
                  </motion.li>
                ))}
              </ul>

              <motion.div
                className="flex space-x-3"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Link href="/login">
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white transition-all"                  >
                    Login
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white transition-all">
                    Sign Up
                  </Button>
                </Link>
              </motion.div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </nav>
        </header>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden fixed top-16 left-0 right-0 z-40 bg-black/95 backdrop-blur-md"
            >
              <div className="container mx-auto px-6 py-6 flex flex-col space-y-4">
                {landingNavItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.link}
                    className="text-white hover:text-purple-300 py-2 text-lg border-b border-white/10"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
                <div className="flex flex-col space-y-3 pt-4">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full border-purple-500 text-white hover:bg-purple-800">
                      Login
                    </Button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">Sign Up</Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )
  }

  // Dashboard navbar
  return (
    <header className="fixed top-0 left-0 right-0 h-16 border-b bg-white z-40 px-4">
      <div className="flex h-full items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleSidebar} aria-label="Toggle sidebar">
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold">
              A
            </div>
            <span className="text-xl font-bold">AI Sales</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="outline" size="sm">
              Login
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Sign Up</Button>
          </Link>
        </div>
      </div>
    </header>
  )
}

