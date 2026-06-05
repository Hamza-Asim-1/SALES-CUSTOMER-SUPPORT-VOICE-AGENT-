"use client"
import React from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"

const transition = {
  type: "spring",
  mass: 0.5,
  damping: 11.5,
  stiffness: 100,
  restDelta: 0.001,
  restSpeed: 0.001,
}

export const MenuItem = ({
  setActive,
  active,
  item,
  children,
}: {
  setActive: (item: string) => void
  active: string | null
  item: string
  children?: React.ReactNode
}) => {
  return (
    <div onMouseEnter={() => setActive(item)} className="relative">
      <motion.p transition={{ duration: 0.3 }} className="cursor-pointer text-gray-300 hover:text-white text-lg">
        {item}
      </motion.p>
      {active !== null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={transition}
        >
          {active === item && (
            <div className="absolute top-[calc(100%_+_1.7rem)] left-1/2 transform -translate-x-1/2">
              <motion.div
                transition={transition}
                layoutId="active"
                className="bg-gray-800 backdrop-blur-sm rounded-2xl overflow-hidden border border-gray-700 shadow-xl"
              >
                <motion.div layout className="w-max h-full p-4">
                  {children}
                </motion.div>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

export const Menu = ({
  setActive,
  children,
}: {
  setActive: (item: string | null) => void
  children: React.ReactNode
}) => {
  return (
    <nav
      onMouseLeave={() => setActive(null)}
      className="relative rounded-full border border-gray-700 bg-gray-900 bg-opacity-50 shadow-input flex justify-center space-x-8 px-12 py-6"
    >
      {children}
    </nav>
  )
}

export const NavbarMenu = ({
  navItems,
}: {
  navItems: {
    name: string
    link: string
  }[]
}) => {
  const [active, setActive] = React.useState<string | null>(null)
  const pathname = usePathname()

  return (
    <Menu setActive={setActive}>
      {navItems.map((item, index) => (
        <MenuItem key={index} item={item.name} active={active} setActive={setActive}>
          <div className="flex flex-col space-y-4 text-base">
            <Link href={item.link} className="block font-medium text-gray-300 hover:text-white">
              {item.name}
            </Link>
          </div>
        </MenuItem>
      ))}
    </Menu>
  )
}

