import type { AgAiHarnessSetup, AgAiPromptStarter, AgStudioApi } from "ag-studio";
import type { Dossier, InsightsData } from "@/app/console/insights/facts";
import { openaiAdapter } from "./openai-adapter";
import type { StudioLib } from "./studio-lib";

// The Recall analyst: a custom primary agent that answers questions about one recall's claims, quotes the model's
// evidence, drafts text for a person to use, and hands charts to Studio's own Page and Widget agents and queries to
// its Data agent. It holds no tool that approves, rejects or pays a claim. That is a design decision, not a gap: in
// Remedy the AI describes and a fixed rule (or a person) decides.

/** Where the adapter posts each turn (`${endpoint}/responses`): Remedy's own proxy, which holds the key. */
const ENDPOINT = "/api/console/ai";

/** The review form's limit (console/_lib/review.ts). */
export const NOTE_LIMIT = 280;

export const claimHref = (id: string) => `/console?claim=${encodeURIComponent(id)}`;

const RULES = `You can't approve, reject or pay a claim. A person does that in the evidence panel on the Claims page, with a second click. If you are asked to approve, reject, pay or refund a claim, say plainly that you can't, name the evidence panel on the Claims page as the place a person does it, and offer to explain the claim or draft a review note instead. Never claim to have changed a claim.`;

function instructions(api: AgStudioApi, data: InsightsData) {
  const n = (k: "remedied" | "refused" | "held") => data.claims.reduce((sum, c) => sum + c[k], 0);
  const samples = data.claims.filter((c) => c.source === "Starter").length;
  const demo = data.claims.filter((c) => c.source === "Demo").length;
  const tables = api
    .getAiContext()
    .schema()
    .tables.map((t) => t.name)
    .join(", ");
  return `${RULES}

## Who you are
You are the Recall analyst in Remedy's company console. Remedy pays recall refunds through PayPal once a photo shows the recalled product destroyed. A vision model describes each claim's photos; a fixed rule decides from its answers: any "no" rejects, any "unclear" holds the claim for a person, and only a claim where every check passes is paid. The model never moves money, and neither do you.

## This recall
CPSC ${data.recall.id}: ${data.recall.product}. ${data.recall.unitsSold.toLocaleString("en-US")} units sold; refund $${data.recall.refund.toFixed(2)}; auto-pay ${data.recall.autoPay ? "on" : "off"}.
Right now: ${data.claims.length} claims, ${n("remedied")} paid, ${n("held")} held for a person, ${n("refused")} refused.
${samples} of them came with every company's console and are never paid out; ${demo} were filed from the try page. Mention this only when the user asks where claims came from, or when a money figure includes refunds that were approved but never sent; call them claims that came with the console, never starter, sample or demo claims. Amounts are USD.
Tables: ${tables}.

## How you work
- Numbers come from data, never from memory: run execute_query yourself for a quick count, or delegate a harder question to Data. Cite the count and what it covers.
- To explain one claim, call explain_claim and quote the model's evidence word for word in quotation marks. You may summarise around a quote, never inside it.
- To show a claim, call open_claim: it shows a card with a link to the claim in the Claims queue.
- To draft a note for a held claim, read it with explain_claim first, then call draft_review_note with a note of at most ${NOTE_LIMIT} characters that names the check and quotes the evidence. Only held claims can be reviewed. The person decides; your note is a draft.
- When asked for a chart: if a widget on the page already shows it, name it by its title ("Why claims were refused") and give the numbers; otherwise build it. Building takes two steps: delegate to Page to place a widget, then to Widget to configure it, passing the widget id Page returns. Prefer a bar chart for reasons and counts; a column chart over calendar::day for time. Use the Remedy widgets (Recall progress, Check funnel, Refusal reasons) when they fit.
- Keep replies short: one or two sentences, then the evidence or the chart. Plain words, no hype. Refer to claims by id (RM-1234).
- Once the conversation's subject is clear, call rename_thread with a 3-5 word name.`;
}

function promptStarters(data: InsightsData): AgAiPromptStarter[] {
  const refused = data.claims.reduce((n, c) => n + c.refused, 0);
  const held = data.claims.find((c) => c.decision === "Held");
  const sameItem = data.claims.filter((c) => c.decision === "Held" && c.failedCheck === "same_item").length;
  const starters: AgAiPromptStarter[] = [];
  if (refused) starters.push({ label: `Why were ${refused} claims refused?`, prompt: `Why were ${refused} claims refused? Chart them by reason.` });
  if (sameItem) starters.push({ label: "Held on the same-item check", prompt: "Show the held claims where only the same-item check was unclear, and quote what the model saw." });
  starters.push({ label: "Chart time to pay by day", prompt: "Chart the median seconds from photo to PayPal payout by day filed." });
  if (held) starters.push({ label: `Draft a review note for ${held.id}`, prompt: `Draft a review note for ${held.id}.` });
  return starters.slice(0, 4);
}

const summary = (d: Dossier) => ({
  claim: d.id,
  decision: d.decision,
  source: d.source,
  filedAt: d.filedAt,
  ruleSentence: d.sentence,
  modelSummary: d.summary,
  checks: d.checks.map((k) => ({ check: k.label, outcome: k.outcome, rule: k.rule, evidenceVerbatim: k.evidence })),
  preChecks: d.preChecks.map((p) => ({ check: p.label, state: p.state, detail: p.detail })),
});

export interface ExplainData {
  dossier: Dossier;
}
export interface OpenData {
  dossier: Dossier;
  href: string;
}
export interface NoteData {
  claimId: string;
  note: string;
  href: string;
}

export function buildAnalyst({ createAiHarness, directLlmRunner }: StudioLib, data: InsightsData): AgAiHarnessSetup {
  const adapter = openaiAdapter({ endpoint: ENDPOINT, model: "analyst" });
  const ids = Object.keys(data.dossiers);
  const find = (id: string) => data.dossiers[id.trim().toUpperCase()];

  return ({ api }) => {
    const explainClaim = api.defineAiTool({
      name: "explain_claim",
      description: "Read one claim: its decision, the rule's sentence, every check with the model's evidence verbatim, and the pre-checks. Use before quoting or drafting anything about a claim.",
      params: (s) => s.object({ claimId: s.enum(ids, { description: "The claim id, e.g. RM-9629." }) }),
      execute: ({ claimId }: { claimId: string }, ctx) => {
        const d = find(claimId);
        if (!d) return ctx.error(`There is no claim ${claimId} in this recall.`);
        return ctx.success<ExplainData>(JSON.stringify(summary(d)), { dossier: d });
      },
    });

    const openClaim = api.defineAiTool({
      name: "open_claim",
      description: "Show a claim as a card in the chat, with its decision, photo and a link that opens it in the Claims queue's evidence panel.",
      params: (s) => s.object({ claimId: s.enum(ids, { description: "The claim id." }) }),
      execute: ({ claimId }: { claimId: string }, ctx) => {
        const d = find(claimId);
        if (!d) return ctx.error(`There is no claim ${claimId} in this recall.`);
        return ctx.success<OpenData>(`Showing ${d.id} (${d.decision}). The person can open it in the Claims queue.`, { dossier: d, href: claimHref(d.id) });
      },
    });

    const draftReviewNote = api.defineAiTool({
      name: "draft_review_note",
      description: `Hand a person a review note for a held claim. Write the note yourself from explain_claim's evidence: at most ${NOTE_LIMIT} characters, naming the check and quoting the evidence. It does not approve or reject anything; a person still decides in the evidence panel.`,
      params: (s) =>
        s.object({
          claimId: s.enum(ids, { description: "A held claim's id." }),
          note: s.string({ description: `The note, at most ${NOTE_LIMIT} characters.` }),
        }),
      execute: ({ claimId, note }: { claimId: string; note: string }, ctx) => {
        const d = find(claimId);
        if (!d) return ctx.error(`There is no claim ${claimId} in this recall.`);
        if (!d.reviewable) return ctx.error(`${d.id} is ${d.decision.toLowerCase()}, not held: only held claims wait for a review note.`);
        const text = note.trim();
        if (!text) return ctx.error("The note is empty.");
        if (text.length > NOTE_LIMIT) return ctx.error(`The note is ${text.length} characters; the review form takes at most ${NOTE_LIMIT}. Shorten it.`);
        return ctx.success<NoteData>(`Draft note for ${d.id} handed to the person (${text.length} characters). They decide in the evidence panel.`, { claimId: d.id, note: text, href: claimHref(d.id) });
      },
    });

    return createAiHarness(api, ({ tools, builtIn }) => ({
      agents: [
        directLlmRunner({
          id: "recall-analyst",
          name: "Recall analyst",
          description: "Answers questions about this recall's claims, quotes the model's evidence and drafts text for a person to use. It can't approve, reject or pay.",
          adapter,
          schema: (s) => s.undefined(),
          maxTurns: 24,
          instructions: () => instructions(api, data),
          tools: () => [
            tools.studio.viewSchema(),
            tools.studio.viewPage(),
            tools.studio.executeQuery(),
            explainClaim,
            openClaim,
            draftReviewNote,
            tools.renameThread(),
            tools.delegateTo(["data", "page", "widget"]),
          ],
        }),
        directLlmRunner({ ...builtIn.data, adapter, maxTurns: 12 }),
        directLlmRunner({ ...builtIn.page, adapter, maxTurns: 12 }),
        directLlmRunner({ ...builtIn.widget, adapter, maxTurns: 12 }),
      ],
      primary: "recall-analyst",
      promptStarters: promptStarters(data),
    }));
  };
}
