// Marketing is always dark. Its scoped tokens do not overwrite the owner's saved app theme.
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-theme="dark" className="relative isolate min-h-dvh bg-bg text-text">
      {children}
    </div>
  );
}
