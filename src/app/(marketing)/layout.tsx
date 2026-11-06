// The homepage is dark only, by choice (DESIGN.md): pin the dark tokens whatever the app theme is. data-marketing
// lets globals.css pin <html> dark as well, for the scrollbar and overscroll.
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-theme="dark" data-marketing className="min-h-dvh bg-bg text-text">
      {children}
    </div>
  );
}
