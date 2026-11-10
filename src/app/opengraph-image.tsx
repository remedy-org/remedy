import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { MARK_STUB, MARK_TAG } from "@/components/ui/markPaths";

export const alt = "Remedy: recall refunds, from proof to PayPal. Evidence checks and traceable refunds.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const photo = await readFile(join(process.cwd(), "public/demo/k01-1.jpg"));
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#000", color: "#fafafa", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 720, padding: "56px 40px 56px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 36, fontWeight: 700, letterSpacing: -1 }}>
          <svg width="40" height="40" viewBox="0 0 24 24"><path fill="#fafafa" fillRule="evenodd" d={`${MARK_TAG}${MARK_STUB}`} /></svg>
          remedy
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#c59eff", fontSize: 20, marginBottom: 24 }}>From recall evidence to a PayPal refund.</div>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -3 }}>Recall refunds.</div>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -3 }}>Proof to PayPal.</div>
          <div style={{ fontSize: 26, color: "#c1bec6", marginTop: 28, lineHeight: 1.4 }}>AI describes. Rules decide. PayPal pays.</div>
        </div>
        <div style={{ display: "flex", fontSize: 18, color: "#c1bec6" }}>PayPal sandbox · prepared demo photos</div>
      </div>
      <div style={{ display: "flex", width: 480, padding: "48px 48px 48px 12px" }}>
        <div style={{ display: "flex", flexDirection: "column", width: "100%", padding: 24, background: "#c59eff", borderRadius: 40 }}>
          <img src={`data:image/jpeg;base64,${photo.toString("base64")}`} alt="" width={372} height={430} style={{ objectFit: "cover", borderRadius: 24 }} />
          <div style={{ display: "flex", marginTop: 20, color: "#211d25", fontSize: 19 }}>Evidence. Decision. Refund.</div>
        </div>
      </div>
    </div>, size,
  );
}
