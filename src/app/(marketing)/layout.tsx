import { SmoothScroll } from "@/components/home/SmoothScroll";

// The marketing canvas is dark; the saved app preference is preserved by ThemeSync.
// Isolation keeps each scene's physical lighting beneath its content.
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div id="top" className="grain relative isolate min-h-dvh bg-bg text-text">
      <SmoothScroll />
      {children}
    </div>
  );
}
