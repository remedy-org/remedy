import { Rails } from "@/components/home/Rails";

// The homepage is dark only, by choice (DESIGN.md): pin the dark tokens whatever the app theme is. data-marketing
// lets globals.css pin <html> dark as well, for the scrollbar and overscroll. The root is its own stacking context so
// the page rails sit above its background and under every section; grain lies over everything.
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-theme="dark" data-marketing className="grain relative isolate min-h-dvh bg-bg text-text">
      <Rails />
      {children}
    </div>
  );
}
