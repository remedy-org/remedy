import { SmoothScroll } from "@/components/home/SmoothScroll";

// The homepage follows the theme like every other page (dark by default). The root is its own stacking context so
// each section's light and fade stay under its content; grain lies over everything.
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grain relative isolate min-h-dvh bg-bg text-text">
      <SmoothScroll />
      {children}
    </div>
  );
}
