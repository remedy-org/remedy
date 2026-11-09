"use client";

/**
 * The root layout's pre-paint theme script. The server renders an ordinary script, so it runs before the first paint. A
 * page Next renders again in the browser (a notFound() under /r/*, see ThemeSync) inserts it from React, where it never
 * runs and React's development build warns about it: there it is marked as data, and ThemeSync sets the theme.
 */
export function ThemeScript({ code }: { code: string }) {
  return <script suppressHydrationWarning type={typeof window === "undefined" ? undefined : "text/plain"} dangerouslySetInnerHTML={{ __html: code }} />;
}
