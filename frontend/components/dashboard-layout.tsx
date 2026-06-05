"use client"

import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      <DashboardSidebar />
      <SidebarInset>
        <div className="pt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ type: "tween" , duration: 0.4 }}
              className="flex-1 overflow-auto p-4 md:p-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </SidebarInset>
    </>
  )
}