"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";

export function NavbarWrapper() {
  const pathname = usePathname();
  
  // Define paths where navbar should be hidden
  const hideNavbarPaths = ['/sales', '/crm', '/dashboard/sales', '/dashboard/crm','/log','/sign','/reporting','/dash','/chatbot-embed','/login','/signup'];
  
  // Check if current path should hide navbar
  const showNavbar = !hideNavbarPaths.some(path => pathname?.startsWith(path));
  
  // Only render navbar if it should be shown
  return showNavbar ? <Navbar /> : null;
}