"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSelector } from 'react-redux';
import { usePathname } from "next/navigation"
import { BarChart3, Database, Headphones, Home, Settings, LogOut, Bell, HelpCircle } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { RootState } from "@/app/store/store";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function DashboardSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [hasAnimated, setHasAnimated] = useState(false)
  
  useEffect(() => {
    // Set animation state to true after first render
    setHasAnimated(true)
  }, [])
  
  const userState = useSelector((state: RootState) => state.auth.user);

  // Navigation items for the sidebar
  const mainNavItems = [
    {
      title: "Dashboard",
      icon: Home,
      href: "/dashboard",
      isActive: pathname === "/dashboard",
    },
    {
      title: "Reporting",
      icon: BarChart3,
      href: "/reporting",
      isActive: pathname === "/reporting",
    },
    {
      title: "CRM Integration",
      icon: Database,
      href: "/crm-integration",
      isActive: pathname === "/crm-integration",
    },
    {
      title: "Sales Agent",
      icon: Headphones,
      href: "/sales-agent",
      isActive: pathname === "/sales-agent",
    },
    {
      title: "Chabot Embed",
      icon: Headphones,
      href: "/chatbot-embed",
      isActive: pathname === "/chatbot-embed",
    },
  ]

  const accountNavItems = [
    {
      title: "Settings",
      icon: Settings,
      href: "/settings",
      isActive: pathname === "/settings",
    },
    {
      title: "Help & Support",
      icon: HelpCircle,
      href: "/support",
      isActive: pathname === "/support",
    },
  ]

  const menuItemVariants = {
    hover: { 
      scale: 1.02, 
      backgroundColor: "rgba(243, 244, 246, 0.8)",
      transition: { duration: 0.2 }
    },
    tap: { 
      scale: 0.98,
      backgroundColor: "rgba(229, 231, 235, 1.0)",
      transition: { duration: 0.1 }
    }
  }

  const logoVariants = {
    hover: {
      scale: 1.1,
      transition: { duration: 0.3 }
    }
  }

  const handleNavigation = (href: string) => {
    router.push(href)
  }

  const handleLogout = () => {
    // Add logout logic here if needed
    router.push("/login") // Redirect to login page after logout
  }

  return (
    <Sidebar className="border-r border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-sm w-72">
      <SidebarHeader className="border-b border-gray-200 py-6">
        <motion.div 
          className="px-6 flex items-center gap-4"
          whileHover="hover"
          variants={logoVariants}
        >
          <motion.div 
            className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl shadow-md"
            // initial={!hasAnimated ? { opacity: 0, y: -20 } : false}
            // animate={!hasAnimated ? { opacity: 1, y: 0 } : false}
            // transition={{ duration: 0.5 }}
          >
            A
          </motion.div>
          <motion.h2 
            className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent cursor-pointer"
            initial={!hasAnimated ? { opacity: 0, x: -20 } : false}
            animate={!hasAnimated ? { opacity: 1, x: 0 } : false}
            transition={{ duration: 0.5, delay: 0.2 }}
            onClick={() => router.push("/")}
          >
            AI Sales
          </motion.h2>
        </motion.div>
      </SidebarHeader>
      
      <SidebarContent className="px-5 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-base font-bold text-gray-600 px-4 py-6">MAIN MENU</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <TooltipProvider>
                {mainNavItems.map((item) => (
                  <SidebarMenuItem key={item.title} className="mb-5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <motion.div
                          whileHover="hover"
                          whileTap="tap"
                          variants={menuItemVariants}
                          className="w-full rounded-xl overflow-hidden"
                        >
                          <SidebarMenuButton 
                            asChild 
                            isActive={item.isActive} 
                            className={cn(
                              "py-6 px-5 rounded-xl text-lg transition-all duration-300",
                              item.isActive 
                                ? "bg-primary text-primary-foreground shadow-md" 
                                : "hover:bg-gray-100 hover:shadow-sm"
                            )}
                          >
                            <div 
                              className="flex items-center cursor-pointer"
                              onClick={() => handleNavigation(item.href)}
                            >
                              <item.icon className={cn(
                                "mr-5 h-7 w-7 transition-transform duration-300",
                                item.isActive ? "text-primary-foreground" : "text-gray-600"
                              )} />
                              <span className={cn(
                                "font-medium",
                                item.isActive ? "text-primary-foreground" : "text-gray-700"
                              )}>
                                {item.title}
                              </span>
                            </div>
                          </SidebarMenuButton>
                        </motion.div>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{item.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                ))}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-6 bg-gradient-to-r from-transparent via-gray-200 to-transparent h-px" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-base font-bold text-gray-600 px-4 py-5">NOTIFICATIONS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="mb-5">
                <motion.div
                  whileHover="hover"
                  whileTap="tap"
                  variants={menuItemVariants}
                  className="w-full rounded-xl overflow-hidden"
                >
                  <SidebarMenuButton 
                    className="py-5 px-5 rounded-xl hover:bg-gray-100 text-lg transition-all duration-300"
                    onClick={() => handleNavigation("/notifications")}
                  >
                    <Bell className="mr-5 h-7 w-7 text-gray-600" />
                    <span className="font-medium text-gray-700">Notifications</span>
                    <motion.span 
                      className="ml-auto bg-primary text-primary-foreground text-sm rounded-full px-4 py-1 font-bold"
                      whileHover={{ 
                        scale: 1.1, 
                        transition: { 
                          duration: 0.2,
                          repeat: 1,
                          repeatType: "reverse" 
                        } 
                      }}
                    >
                      3
                    </motion.span>
                  </SidebarMenuButton>
                </motion.div>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mt-auto border-t border-gray-200 pt-5 bg-gray-50">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <TooltipProvider>
                {accountNavItems.map((item) => (
                  <SidebarMenuItem key={item.title} className="mb-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <motion.div
                          whileHover="hover"
                          whileTap="tap"
                          variants={menuItemVariants}
                          className="w-full rounded-xl overflow-hidden"
                        >
                          <SidebarMenuButton 
                            asChild 
                            isActive={item.isActive} 
                            className={cn(
                              "py-5 px-5 rounded-xl text-lg transition-all duration-300",
                              item.isActive 
                                ? "bg-primary/10 text-primary shadow-sm" 
                                : "hover:bg-gray-100"
                            )}
                          >
                            <div 
                              className="flex items-center cursor-pointer"
                              onClick={() => handleNavigation(item.href)}
                            >
                              <item.icon className="mr-5 h-7 w-7 text-gray-600" />
                              <span className="font-medium text-gray-700">{item.title}</span>
                            </div>
                          </SidebarMenuButton>
                        </motion.div>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{item.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                ))}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-5 bg-gradient-to-r from-transparent via-gray-200 to-transparent h-px" />

        <div className="p-6">
          <motion.div 
            className="flex items-center gap-5 p-4 rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
            whileHover={{ 
              scale: 1.02,
              backgroundColor: "rgba(249, 250, 251, 1)"
            }}
            whileTap={{ scale: 0.98 }}
          >
            <Avatar className="h-14 w-14 border-2 border-primary/30">
              <AvatarImage src="/placeholder.svg?height=56&width=56" alt="User" />
              <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white text-xl">JD</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-gray-800">{userState ? userState.name : "Hamza The Great"}</p>
              <p className="text-base text-gray-500 truncate">{userState ? userState.email : "Email"}</p>
            </div>
            <motion.button 
              className="text-gray-500 hover:text-red-500 p-3 rounded-lg hover:bg-gray-100"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleLogout}
            >
              <LogOut className="h-6 w-6" />
            </motion.button>
          </motion.div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}