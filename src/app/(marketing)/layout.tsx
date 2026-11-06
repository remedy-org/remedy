// The homepage is dark only, by choice (DESIGN.md): pin the dark tokens whatever the app theme is.
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-theme="dark" className="min-h-dvh bg-bg text-text">
      {children}
    </div>
  );
}
