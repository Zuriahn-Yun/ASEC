import { TuringLanding } from "@/components/ui/hero-landing-page";
import { Navbar } from "@/components/navbar";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <TuringLanding />
    </main>
  );
}
