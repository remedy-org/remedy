import type { Metadata } from "next";
import { Checks } from "@/components/home/Checks";
import { Companies } from "@/components/home/Companies";
import { Footer } from "@/components/home/Footer";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Nav } from "@/components/home/Nav";
import { Problem } from "@/components/home/Problem";
import { Proof } from "@/components/home/Proof";

export const metadata: Metadata = {
  title: { absolute: "Remedy · Recall refunds, proven and paid through PayPal" },
};

export default function Home() {
  return (
    <>
      <Nav />
      {/* clip, not hidden: the light table runs past the edges without a horizontal scrollbar or breaking sticky. */}
      <main className="overflow-x-clip">
        <Hero />
        <Problem />
        <HowItWorks />
        <Checks />
        <Proof />
        <Companies />
      </main>
      <Footer />
    </>
  );
}
