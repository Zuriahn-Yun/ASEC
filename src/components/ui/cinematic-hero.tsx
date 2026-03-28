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
  const depthCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Tagline entrance
      gsap.fromTo(
        taglineRef.current,
        { opacity: 0, y: 60 },
        { opacity: 1, y: 0, duration: 1.2, ease: "power3.out", delay: 0.3 }
      );

      // Card entrance with 3D effect
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 80, rotateX: 15 },
        { opacity: 1, y: 0, rotateX: 0, duration: 1.4, ease: "power3.out", delay: 0.6 }
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

      // Scroll-triggered card elevation
      ScrollTrigger.create({
        trigger: cardRef.current,
        start: "top 80%",
        end: "center center",
        scrub: 1,
        onUpdate: (self) => {
          if (cardRef.current) {
            const scale = 1 + self.progress * 0.05;
            const shadowOpacity = 0.1 + self.progress * 0.3;
            gsap.set(cardRef.current, {
              scale,
              boxShadow: `0 25px 80px rgba(0,0,0,${shadowOpacity})`,
            });
          }
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // 3D mouse interaction for depth card
  useEffect(() => {
    const card = depthCardRef.current;
    if (!card) return;

    let rafId: number;
    let targetRotateX = 0;
    let targetRotateY = 0;
    let currentRotateX = 0;
    let currentRotateY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const mouseX = e.clientX - centerX;
      const mouseY = e.clientY - centerY;

      targetRotateY = (mouseX / rect.width) * 20;
      targetRotateX = -(mouseY / rect.height) * 20;
    };

    const handleMouseLeave = () => {
      targetRotateX = 0;
      targetRotateY = 0;
    };

    const animate = () => {
      currentRotateX += (targetRotateX - currentRotateX) * 0.1;
      currentRotateY += (targetRotateY - currentRotateY) * 0.1;

      if (card) {
        card.style.transform = `perspective(1000px) rotateX(${currentRotateX}deg) rotateY(${currentRotateY}deg)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);
    rafId = requestAnimationFrame(animate);

    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(rafId);
    };
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

        {/* Premium Depth Card */}
        <div
          ref={cardRef}
          className="w-full max-w-4xl mb-16"
          style={{ perspective: "1000px" }}
        >
          <div
            ref={depthCardRef}
            className="relative bg-gradient-to-br from-slate-800/80 via-slate-900/90 to-slate-950/95 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-slate-700/50 shadow-2xl transition-shadow duration-300"
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-blue-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  {cardHeading}
                </h2>
                <p className="text-slate-300 text-lg leading-relaxed mb-6">
                  {cardDescription}
                </p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Shield className="w-4 h-4 text-green-400" />
                    <span>SAST</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span>DAST</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Lock className="w-4 h-4 text-blue-400" />
                    <span>SCA</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/50 rounded-2xl border border-slate-700/30">
                <div className="text-6xl md:text-7xl font-bold bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                  {metricValue}%
                </div>
                <div className="text-slate-400 text-sm mt-2">{metricLabel}</div>
                <div className="w-full h-2 bg-slate-700 rounded-full mt-4 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                    style={{ width: `${metricValue}%` }}
                  />
                </div>
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
