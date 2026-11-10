// The browser-side setup Studio needs on any page that runs it (/console/insights, the homepage's Insights step): the
// live theme, every token resolved to the sRGB Studio paints, and the page's font stacks.

export const readTheme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
export function onThemeChange(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Any CSS colour, tokens and color-mix() included, as the sRGB the browser paints: what Studio and its charts need. */
export function colorResolver() {
  const probe = document.createElement("span");
  probe.style.display = "none";
  document.body.appendChild(probe);
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const resolve = (css: string) => {
    probe.style.color = css;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = getComputedStyle(probe).color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
  };
  return { resolve, done: () => probe.remove() };
}

export function fonts() {
  const root = getComputedStyle(document.documentElement);
  const stack = (name: string, fallback: string) => {
    const family = root.getPropertyValue(name).trim();
    return family ? `${family}, ${fallback}` : fallback;
  };
  return {
    sans: stack("--font-sans", "ui-sans-serif, system-ui, sans-serif"),
    display: stack("--font-display", "ui-monospace, monospace"),
  };
}
