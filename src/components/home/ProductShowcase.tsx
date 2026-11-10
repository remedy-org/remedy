"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import type { PreviewRow } from "@/components/console/ClaimsGridPreview";
import { Wordmark, CheckIcon } from "@/components/ui";
import { CHECK_NAMES } from "@/lib/fiveChecks";
import { ClaimGlyph, EvidenceGlyph, QueueGlyph } from "./glyphs";
import styles from "./landing.module.css";

const VIEWS = ["Owner claim", "Evidence review", "Company console"];
const LABELS: Record<string, string> = { paid: "Paid", held: "Held for review", blocked: "Blocked", rejected: "Rejected", approved: "Approved", pending: "In progress" };
const CHECKS = [CHECK_NAMES.session, CHECK_NAMES.duplicate, CHECK_NAMES.account, CHECK_NAMES.code("M4T", "X-VESOLJE"), CHECK_NAMES.destroyed("Pillow", true)];

function Photo({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <div className={`${styles.previewPhoto} ${className ?? ""}`}><Image src={src} unoptimized={src.startsWith("/_next/image")} alt={alt} width={800} height={600} sizes="(max-width: 700px) 85vw, 480px" /></div>;
}

function Status({ decision }: { decision: string }) {
  return <span className={styles.previewStatus} data-tone={decision}><span aria-hidden="true">{decision === "paid" ? "✓" : decision === "held" ? "◷" : "⊘"}</span>{LABELS[decision] ?? decision}</span>;
}

export function ProductShowcase({ rows }: { rows: PreviewRow[] }) {
  const [view, setView] = useState(0);
  const [evidenceId, setEvidenceId] = useState("RM-9629");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const panel = useRef<HTMLDivElement>(null);
  const row = rows.find((r) => r.id === evidenceId && r.evidence) ?? rows.find((r) => r.evidence)!;
  const evidence = row.evidence!;
  const observation = evidence.drawer.checks.find((check) => check.outcome !== "pass" && check.evidence?.trim())?.evidence?.trim() || evidence.summary?.trim();
  const reviewMessage = row.decision === "held"
    ? "A person reviews uncertain evidence before an eligible refund is sent."
    : row.decision === "blocked"
      ? "This claim stopped at the pre-checks. No payout was sent."
      : row.decision === "rejected"
        ? "The rule rejected this claim. No payout was sent."
        : "Passing checks allow the eligible refund to proceed through PayPal.";
  const paid = rows.find((r) => r.decision === "paid");
  const key = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : null;
    if (next !== null) { event.preventDefault(); setView(next); tabs.current[next]?.focus(); }
  };
  const inspect = (id: string) => {
    setEvidenceId(id);
    setView(1);
    requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
  };

  return (
    <div className={styles.showcase}>
      <div className={styles.showcaseTop}>
        <div role="tablist" aria-label="Explore Remedy" className={styles.showcaseTabs}>
          {VIEWS.map((name, index) => <button key={name} ref={(el) => { tabs.current[index] = el; }} id={`preview-tab-${index}`} type="button" role="tab" aria-selected={view === index} aria-controls="product-preview" tabIndex={view === index ? 0 : -1} onKeyDown={(event) => key(event, index)} onClick={() => setView(index)}><span className={styles.tabNumber}>{String(index + 1).padStart(2, "0")}</span>{name}</button>)}
        </div>
        <span className={styles.illustrationLabel}>Illustrative product walkthrough</span>
      </div>
      <div className={styles.productWindow}>
        <div className={styles.productBar}><Wordmark size="sm" /><span className={styles.productContext}>X-VESOLJE Nursing Pillows <span>/</span> CPSC 27-071</span><span className={styles.sampleBadge}>Sample workspace</span></div>
        <div className={styles.productLayout}>
          <aside className={styles.productSidebar} aria-label="Preview context">
            <div className={styles.workspaceIcon}>K<span /></div><p>Kikea Store<span>Recall workspace</span></p>
            <div className={styles.sidebarDivider} />
            <span className={styles.sidebarLabel}>RECALL 27-071</span>
            {VIEWS.map((name, i) => <button key={name} type="button" onClick={() => setView(i)} aria-pressed={view === i} data-selected={view === i}><span>{i === 0 ? <ClaimGlyph /> : i === 1 ? <EvidenceGlyph /> : <QueueGlyph />}</span>{name}</button>)}
            <div className={styles.sidebarFoot}><span className={styles.connectionDot} /> Sandbox integration<span>Illustrative workspace</span></div>
          </aside>
          <div ref={panel} role="tabpanel" id="product-preview" aria-labelledby={`preview-tab-${view}`} tabIndex={0} className={styles.productMain}>
            {view === 0 && <div className={styles.ownerPreview}>
              <div className={styles.previewHeading}><div><span className={styles.appEyebrow}>OWNER CLAIM</span><h2>Your evidence, all in one place.</h2></div><span className={styles.codeBadge}>Code <strong>M4T</strong></span></div>
              <div className={styles.ownerColumns}>
                <div className={styles.ownerPhotoWrap}><Photo src="/demo/k01-1.jpg" alt="Prepared photo of the feather-print pillow cut in half with its X-VESOLJE M4T tag" /><div className={styles.photoCaption}><span>Destruction photo</span><span>1 of 1</span></div></div>
                <div className={styles.checkPanel}><div className={styles.checkHeader}><h3>Claim checks</h3><span>5 of 5</span></div><ol>{CHECKS.map((check) => <li key={check}><span className={styles.checkCircle}><CheckIcon size={12} /></span><span>{check}</span></li>)}</ol><div className={styles.refundPreview}><span className={styles.checkCircle}><CheckIcon size={14} /></span><div><span>Refund paid</span><strong>{paid?.amount ?? "$29.99"}</strong><span>To the owner’s PayPal account</span></div><span className={styles.paypalLetter} aria-hidden="true">P</span></div></div>
              </div>
            </div>}
            {view === 1 && <div className={styles.evidencePreview}>
              <div className={styles.previewHeading}><div><span className={styles.appEyebrow}>EVIDENCE REVIEW</span><h2>A decision with a reason.</h2></div><Status decision={row.decision} /></div>
              <div className={styles.evidenceColumns}>
                <div><Photo src={evidence.photos[0] ?? "/demo/k10-1.jpg"} alt={`Prepared evidence photo for ${row.id}`} /><div className={styles.photoCaption}><span className="font-mono">{row.id}</span><span>Photo 1</span></div></div>
                <div className={styles.evidenceReason}><span className={styles.appEyebrow}>DECIDING REASON</span><h3>{row.note ?? row.reason}</h3><p>{evidence.sentence}</p><div className={styles.quote}>{observation ? <><span>AI observation</span><q>{observation}</q></> : <><span>Stopped before AI review</span><p>{row.note ?? row.reason}</p></>}</div><div className={styles.reviewBoundary}><span aria-hidden="true">{row.decision === "held" ? "◷" : "↳"}</span><p>{reviewMessage}</p></div></div>
              </div>
            </div>}
            {view === 2 && <div className={styles.queuePreview}>
              <div className={styles.previewHeading}><div><span className={styles.appEyebrow}>COMPANY CONSOLE</span><h2>Every claim. The full picture.</h2></div><span className={styles.queueCount}>{rows.length} claims</span></div>
              <div className={styles.queueHeader}><span>Claim</span><span>Decision / reason</span><span>Refund</span></div>
              <div className={styles.previewRows}>{rows.map((r) => <button key={r.id} className={styles.previewRow} type="button" disabled={!r.evidence} onClick={() => inspect(r.id)} aria-label={`Inspect sample claim ${r.id}: ${LABELS[r.decision]}`}><span className={styles.rowIdentity}><Image src={r.photos[0]?.thumb ?? "/demo/k01-1.jpg"} unoptimized={r.photos[0]?.thumb.startsWith("/_next/image")} alt="" width={40} height={40} /><strong>{r.id}</strong></span><span className={styles.rowVerdict}><Status decision={r.decision} /><span>{r.note ?? "All five checks passed"}</span></span><span className={styles.rowAmount}>{r.amount ?? "—"}</span></button>)}</div>
              <div className={styles.queueFoot}><span>Sample claims · recorded model observations</span><span>Choose a claim to inspect its evidence <span aria-hidden="true">↗</span></span></div>
            </div>}
          </div>
        </div>
      </div>
      <div className={styles.showcaseFoot}><span>AI describes. Rules decide. PayPal pays.</span><span>Explore a view above <span aria-hidden="true">↑</span></span></div>
    </div>
  );
}
