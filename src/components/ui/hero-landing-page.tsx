'use client'

import { useEffect, useState } from "react"
import { ChevronDown, ArrowRight, Menu, X } from 'lucide-react'
import Link from "next/link"
import { ShaderAnimation } from "./shader-animation"

export function TuringLanding() {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
  }, [mobileOpen])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden relative">
      {/* Three.js Shader Background */}
      <div className="absolute inset-0 z-0">
        <ShaderAnimation />
      </div>

      {/* Subtle blue background gradient overlays */}
      <div className="absolute inset-0 pointer-events-none z-[1]">
        <div className="absolute inset-0 bg-gradient-to-r from-[rgba(0,132,255,0.15)] via-transparent to-transparent opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-bl from-[rgba(0,132,255,0.1)] via-transparent to-transparent opacity-50" />
      </div>

      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/30 z-[1]" />

      {/* Main Content */}
      <main className="main min-h-screen pt-[200px] pb-20 relative z-[2]">
        <div className="content-wrapper max-w-[1400px] mx-auto px-6 md:px-[60px] flex flex-col lg:flex-row justify-between items-start lg:items-end relative">
          {/* Left Content */}
          <div className="max-w-[800px] mb-12 lg:mb-0">
            <h1 className="text-5xl md:text-6xl lg:text-[80px] font-light leading-[1.1] mb-8 tracking-[-2px]">
              Secure your code,
              <br />
              not just servers
            </h1>
            <p className="text-lg leading-relaxed text-[#b8b8b8] mb-12 font-normal">
              AI-powered vulnerability detection with automated fixes.
              <br />
              SAST, DAST, and SCA scanning in one platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
              <Link
                href="/sign-up"
                className="flex items-center gap-2.5 bg-[#0084ff] text-white py-3.5 px-7 rounded-md text-base font-medium hover:bg-[#0066cc] hover:translate-x-0.5 transition-all duration-200"
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="https://github.com/Zuriahn-Yun/ASEC#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-transparent text-[#b8b8b8] py-3.5 px-7 text-base font-medium hover:text-white transition-colors duration-200"
              >
                Learn more
              </Link>
            </div>
          </div>

          {/* Stats Section */}
          <div className="flex gap-12 md:gap-20 items-end">
            <div className="text-center">
              <div className="text-4xl md:text-5xl lg:text-[64px] font-light leading-none mb-3">3</div>
              <div className="text-base text-[#b8b8b8] font-normal">Scan Types</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl lg:text-[64px] font-light leading-none mb-3">AI</div>
              <div className="text-base text-[#b8b8b8] font-normal">Powered Fixes</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
