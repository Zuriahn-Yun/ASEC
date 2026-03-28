import { CinematicHero } from "@/components/ui/cinematic-hero";
import { Navbar } from "@/components/navbar";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <CinematicHero
        brandName="ASEC"
        tagline1="Secure your code,"
        tagline2="not just your servers."
        cardHeading="Security, redefined."
        cardDescription={
          <>
            <span className="text-white font-semibold">ASEC</span> empowers developers to find
            and fix vulnerabilities with AI-powered analysis, comprehensive scanning, and
            actionable fixes.
          </>
        }
        metricValue={99}
        metricLabel="Vulnerabilities Found"
        ctaHeading="Start securing your code."
        ctaDescription="Join thousands of developers who trust ASEC to protect their applications."
      />
    </main>
  );
}
