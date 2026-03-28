"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Shield, Zap, Lock } from "lucide-react";
import Link from "next/link";
import { ShaderAnimation } from "./shader-animation";

gsap.registerPlugin(ScrollTrigger);

interface CinematicHeroProps {
  brandName?: string;
  tagline1?: string;
  tagline2?: string;
  cardHeading?: string;
  cardDescription?: React.ReactNode;
  metricValue?: number;
  metricLabel?: string;
  ctaHeading?: string;
  ctaDescription?: string;
}

export function CinematicHero({
  brandName = "ASEC",
  tagline1 = "Secure your code,",
  tagline2 = "not just your servers.",
  cardHeading = "Security, redefined.",
  cardDescription = "AI-powered vulnerability detection and automated fixes for modern applications.",
  metricValue = 99,
  metricLabel = "Vulnerabilities Found",
  ctaHeading = "Start securing your code.",
  ctaDescription = "Join thousands of developers who trust ASEC to protect their applications.",
}: CinematicHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Tagline entrance
      gsap.fromTo(
        taglineRef.current,
        { opacity: 0, y: 60 },
        { opacity: 1, y: 0, duration: 1.2, ease: "power3.out", delay: 0.3 }
      );

      // Card entrance
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 80 },
        { opacity: 1, y: 0, duration: 1.4, ease: "power3.out", delay: 0.6 }
      );

      // CTA entrance
      gsap.fromTo(
        ctaRef.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 1, ease: "power3.out", delay: 1 }
      );

      // Scroll-triggered parallax for tagline
      ScrollTrigger.create({
        trigger: taglineRef.current,
        start: "top center",
        end: "bottom top",
        scrub: 1,
        onUpdate: (self) => {
          if (taglineRef.current) {
            gsap.set(taglineRef.current, {
              y: self.progress * -80,
              opacity: 1 - self.progress * 0.7,
            });
          }
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen overflow-hidden bg-black"
    >
      {/* Three.js Shader Background */}
      <div className="absolute inset-0 z-0">
        <ShaderAnimation />
      </div>
      
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/40 z-[1]" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 pt-32 pb-20">
        {/* Tagline Section - Added more top padding */}
        <div ref={taglineRef} className="text-center mb-16 mt-12">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-white via-blue-100 to-slate-300 bg-clip-text text-transparent">
              {tagline1}
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              {tagline2}
            </span>
          </h1>
        </div>

        {/* Security Checks Section */}
        <div ref={cardRef} className="w-full max-w-5xl mb-16">
          <div className="grid md:grid-cols-3 gap-6">
            {/* SAST Card */}
            <div className="group relative bg-gradient-to-b from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/30 hover:border-green-500/30 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">SAST</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Static Analysis scans your source code for vulnerabilities before deployment.
                </p>
              </div>
            </div>

            {/* DAST Card */}
            <div className="group relative bg-gradient-to-b from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/30 hover:border-yellow-500/30 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-yellow-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">DAST</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Dynamic Analysis tests your running application for runtime vulnerabilities.
                </p>
              </div>
            </div>

            {/* SCA Card */}
            <div className="group relative bg-gradient-to-b from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/30 hover:border-blue-500/30 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">SCA</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Software Composition Analysis finds vulnerabilities in your dependencies.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section - Added more bottom margin */}
        <div ref={ctaRef} className="text-center mb-16">
          <h3 className="text-2xl md:text-3xl font-semibold text-white mb-3">
            {ctaHeading}
          </h3>
          <p className="text-slate-400 mb-10 max-w-md mx-auto">
            {ctaDescription}
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-full transition-all duration-300 hover:gap-4 hover:shadow-lg hover:shadow-blue-500/25 mb-8"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
          {/* Extra spacing below button */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
