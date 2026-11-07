import type { Metadata } from "next";
import { Checks } from "@/components/home/Checks";
import { Companies } from "@/components/home/Companies";
import { Footer } from "@/components/home/Footer";
import { Hero } from "@/components/home/Hero";
import { Nav } from "@/components/home/Nav";
import { Problem } from "@/components/home/Problem";
import { Proof } from "@/components/home/Proof";

export const metadata: Metadata = {
  title: { absolute: "Remedy · Recall refunds, proven and paid through PayPal" },
};

// Nav, then the hero with its Chain of Custody sequence (Hero renders <section id="how">), then the four exhibits:
// A the problem on paper, B the gate pipeline, C proof, D the console. "How it works" is no longer its own section.
export default function Home() {
  return (
    <>
      <Nav />
      {/* clip, not hidden: the light table runs past the edges without a horizontal scrollbar or breaking sticky. */}
      <main className="overflow-x-clip">
        <Hero />
        <Problem />
        <Checks />
        <Proof />
        <Companies />
      </main>
      <Footer />
    </>
  );
}
