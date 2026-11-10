/**
 * Isolated recall-operator browser regression. No application server, credentials, store or providers.
 * Real React components consume pure POJO fixtures; every /api request is fulfilled by Playwright.
 * Run: npx tsx scripts/test-business-journey.ts
 */
import { build, type Plugin } from "esbuild";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, extname } from "node:path";
import { pathToFileURL } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

async function main() {
const repo = process.cwd();
const out = await mkdtemp(join(tmpdir(), "remedy-business-journey-"));
console.log(`Artifacts: ${out}`);
const aliases = { "@": join(repo, "src") };
const forbidden = /src\/(?:lib\/(?:env\.ts|store\/(?:index|local|blob|cache)\.ts|paypal\/|demo\/index\.ts)|app\/api\/)/;
const pureOnly: Plugin = {
  name: "no-server-capabilities",
  setup(b) {
    b.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "qa-empty" }));
    b.onLoad({ filter: /.*/, namespace: "qa-empty" }, () => ({ contents: "export {};" }));
    // drawer.ts also exports duplicateFor, which this harness never calls. Its pipeline import would otherwise
    // retain the PayPal error class and env schema; fail closed if that unused helper ever becomes required here.
    b.onResolve({filter:/api\/claims\/_lib\/pipeline$/},()=>({path:"pipeline",namespace:"qa-no-pipeline"}));
    b.onLoad({filter:/.*/,namespace:"qa-no-pipeline"},()=>({contents:"export const duplicateOf=()=>{throw new Error('Pipeline prohibited in business fixture')};"}));
    b.onResolve({filter:/^sharp$/},()=>({path:"sharp",namespace:"qa-no-image-processing"}));
    b.onLoad({filter:/.*/,namespace:"qa-no-image-processing"},()=>({contents:"export default ()=>{throw new Error('Image processing prohibited in business fixture')};"}));
  },
};
const fixtureBuild = await build({
  absWorkingDir: repo, bundle: true, platform: "node", format: "esm", treeShaking: true,
  write: false, metafile: true, alias: aliases, plugins: [pureOnly],
  stdin: { resolveDir: repo, loader: "ts", contents: `
    import { previewProps, previewSeed, reportPreview } from "./src/components/console/preview";
    import { summarize } from "./src/lib/store/store";
    import { toRow } from "./src/app/console/_lib/view";
    import { toDrawerClaim } from "./src/app/console/_lib/drawer";
    import { buildInsights } from "./src/app/console/insights/facts";
    const {recall, claims: base} = previewSeed();
    const genuine = base.find(c=>c.id === "RM-0442")!;
    const synthetic = [
      {...genuine, id:"RM-9001", seeded:false, payout:{...genuine.payout!,status:"PENDING"},events:genuine.events.filter(e=>e.type!=="payout_updated"),createdAt:"2026-11-10T14:01:00.000Z"},
      {...genuine, id:"RM-9002", seeded:false, payout:null,events:genuine.events.filter(e=>!e.type.startsWith("payout_")),createdAt:"2026-11-10T14:02:00.000Z"}
    ];
    const claims = [...synthetic,...base];
    const photo = (key:string)=>"/demo/"+key.slice("seed/".length);
    const rows = claims.map(c=>toRow(summarize(c),recall,key=>({thumb:photo(key),large:photo(key)}))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const drawers = Object.fromEntries(claims.map(c=>[c.id,{...toDrawerClaim(c,recall),photos:c.photos.map(p=>photo(p.key))}]));
    export default {recall,rows,drawers,report:reportPreview(),insights:buildInsights(claims,recall,new Date()),previewCount:previewProps(500,{asConsole:true}).rows.length};
  ` },
});
const fixtureInputs = Object.values(fixtureBuild.metafile!.outputs).flatMap(x=>Object.entries(x.inputs).filter(([,v])=>v.bytesInOutput>0).map(([k])=>k));
const badFixture = fixtureInputs.filter(p=>forbidden.test(p));
if (badFixture.length) throw new Error("Fixture has forbidden runtime imports: " + badFixture.join(", "));
await writeFile(join(out, "fixtures.mjs"), fixtureBuild.outputFiles[0].contents);
const fixture = (await import(pathToFileURL(join(out, "fixtures.mjs")).href)).default;
await writeFile(join(out, "module-audit.json"), JSON.stringify({ fixtureInputs, forbiddenRuntimeInputs: badFixture }, null, 2));

const mockNext: Plugin = {
  name: "mock-next-router",
  setup(b) {
    b.onResolve({ filter: /^next\/(link|navigation)$/ }, a=>({path:a.path,namespace:"qa-next"}));
    b.onLoad({filter:/.*/,namespace:"qa-next"}, a=>({loader:"tsx",resolveDir:repo,contents:a.path.endsWith("navigation")
      ? `export const useRouter=()=>({refresh(){},push(){},replace(){}}); export const usePathname=()=>"/";`
      : `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({children,href,prefetch,...p}){return <a href={href} {...p}>{children}</a>}` }));
  },
};
const browserBuild = await build({
  absWorkingDir: repo, bundle: true, platform: "browser", format: "esm", treeShaking: true, outfile:"fixture.js",
  jsx: "automatic", write: false, metafile: true, alias: aliases, plugins:[mockNext],
  define: { "process.env.NODE_ENV": '"production"' },
  stdin:{resolveDir:repo,loader:"tsx",contents:`
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {ClaimsQueue} from './src/components/console/ClaimsQueue';
    import {ProgressReport} from './src/components/console/ProgressReport';
    import {PrintButton} from './src/components/console/PrintButton';
    import {InsightsReport} from './src/components/insights/InsightsReport';
    const fixture=${JSON.stringify(fixture)};
    window.__fixture=fixture;
    const view=new URLSearchParams(location.search).get('view');
    const root=createRoot(document.getElementById('root'));
    window.__renderQueue=rows=>root.render(<ClaimsQueue recall={fixture.recall} rows={rows} at={new Date().toISOString()}/>);
    if(!view)window.__renderQueue(fixture.rows);
    else root.render(view==='report'?<><style>{'@media print{html,body{background:#fff!important}}@page{margin:16mm 16mm 18mm}'}</style><div className="print:hidden"><PrintButton/></div><ProgressReport {...fixture.report}/></>:<InsightsReport data={fixture.insights}/>);
  `},
});
const browserInputs = Object.values(browserBuild.metafile!.outputs).flatMap(x=>Object.entries(x.inputs).filter(([,v])=>v.bytesInOutput>0).map(([k])=>k));
const badBrowser = browserInputs.filter(p=>forbidden.test(p));
if (badBrowser.length) throw new Error("Browser has forbidden runtime imports: " + badBrowser.join(", "));
await writeFile(join(out, "module-audit.json"),JSON.stringify({fixtureInputs,browserInputs,forbiddenRuntimeInputs:[...badFixture,...badBrowser]},null,2));
const script = browserBuild.outputFiles.find(f=>f.path.endsWith(".js")) ?? browserBuild.outputFiles[0];
const componentCss = browserBuild.outputFiles.find(f=>f.path.endsWith(".css"))?.text ?? "";
const globalCss = await postcss([tailwind({base:repo})]).process(await readFile(join(repo,"src/app/globals.css"),"utf8"),{from:join(repo,"src/app/globals.css")});
const css = globalCss.css + componentCss;
const server = createServer(async(req,res)=>{
  const path = new URL(req.url!,"http://fixture.local").pathname;
  if(req.method !== "GET") {res.writeHead(405);res.end("Fixture: writes disabled");return;}
  if(path==="/app.js") {res.setHeader("Content-Type","text/javascript");res.end(script.contents);return;}
  if(path==="/app.css") {res.setHeader("Content-Type","text/css");res.end(css);return;}
  if(path.startsWith("/demo/") || path.startsWith("/fonts/")) {
    try {const data=await readFile(join(repo,"public",path));res.setHeader("Content-Type",extname(path)===".woff2"?"font/woff2":"image/jpeg");res.end(data);}catch{res.writeHead(404);res.end();}return;
  }
  if(path!=="/"){res.writeHead(404);res.end("Fixture: no application routes");return;}
  res.setHeader("Content-Type","text/html");res.end(`<!doctype html><html data-theme="dark" data-fonts="diatype"><head><link rel="stylesheet" href="/app.css"></head><body><main id="root" class="page flex h-dvh min-h-0 flex-col py-6"></main><script type="module" src="/app.js"></script></body></html>`);
});
await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));
const address=server.address();if(!address || typeof address==="string")throw new Error("No fixture port");
const origin=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage();
const requests:{method:string;url:string;synthetic:boolean}[]=[];
const errors:string[]=[];
page.on("pageerror",e=>errors.push(e.message));
page.setDefaultTimeout(8000);
let errorMode: "none" | "drawer" | "review" = "none";
await context.route("**/*",async route=>{
  const req=route.request(), url=new URL(req.url());
  if(url.pathname.startsWith("/api/")) {
    requests.push({method:req.method(),url:req.url(),synthetic:true});
    const id=url.pathname.match(/^\/api\/console\/claims\/(RM-\d+)$/)?.[1];
    if(req.method()==="GET" && id) {await route.fulfill({status:errorMode==="drawer"?503:200,json:errorMode==="drawer"?{error:"Synthetic evidence load failure"}:fixture.drawers[id]});return;}
    if(req.method()==="GET" && url.pathname==="/api/console/claims") {await route.fulfill({json:{recallId:fixture.recall.id,rows:fixture.rows,at:new Date().toISOString()}});return;}
    if(req.method()==="POST" && /\/(approve|reject)$/.test(url.pathname)) {await new Promise(r=>setTimeout(r,500));await route.fulfill({status:503,json:{error:"Synthetic review failure: nothing was saved"}});return;}
    await route.fulfill({status:500,json:{error:"Unexpected API call blocked by isolated fixture"}});return;
  }
  if(url.origin!==origin || req.method()!=="GET") {requests.push({method:req.method(),url:req.url(),synthetic:false});await route.abort();return;}
  await route.continue();
});
const results:{name:string;pass:boolean;detail?:string}[]=[];
async function check(name:string,run:()=>Promise<void>) {try{await run();results.push({name,pass:true});console.log("PASS",name);}catch(e){results.push({name,pass:false,detail:String(e)});await page.screenshot({path:join(out,`failed-${results.length}.png`),fullPage:true});console.log("FAIL",name,String(e));}}
const assert=(ok:unknown,message:string)=>{if(!ok)throw new Error(message)};
const rows=()=>page.locator(".claims-grid .ag-row[row-id]");
async function load(view="") {await page.goto(origin+"/"+(view?"?view="+view:""));await page.locator(view==="report"?".report-sheet":view==="insights"?"[aria-label='Decisions']":".claims-grid .ag-row[row-id]").first().waitFor();}
async function open(id:string) {await page.locator(`.claims-grid .ag-row[row-id='${id}']`).first().click();await page.getByRole("complementary",{name:`Evidence for ${id}`}).waitFor();await page.getByRole("complementary").locator("img").first().waitFor();}

try {
  await load();
  await page.screenshot({path:join(out,"queue-desktop.png")});
  // Tests below intentionally exercise synthetic failure paths, never real decisions or payments.
  await check("settling evidence stays open when selecting its own tab",async()=>{
    await open("RM-9001");await page.getByRole("tab",{name:/^Sent, settling/}).click();
    await page.waitForTimeout(100);assert(await page.getByRole("complementary",{name:"Evidence for RM-9001"}).count()===1,"matching settling evidence was closed");
  });
  await check("settling evidence closes when selecting Paid",async()=>{
    await load();await open("RM-9001");await page.getByRole("tab",{name:/^Paid/}).click();
    await page.waitForTimeout(100);assert(await page.getByRole("complementary").count()===0,"settling evidence remained open outside Paid tab");
  });
  await check("approved evidence stays on Approved and closes on Paid",async()=>{
    await load();await open("RM-9002");await page.getByRole("tab",{name:/^Approved/}).click();
    assert(await page.getByRole("complementary",{name:"Evidence for RM-9002"}).count()===1,"matching approved evidence closed");
    await page.getByRole("tab",{name:/^Paid/}).click();assert(await page.getByRole("complementary").count()===0,"approved evidence remained on Paid");
  });
  await check("status tabs filter actual rows and distinguish all payment states",async()=>{
    await load();for(const [tab,id] of [["paid","RM-0442"],["settling","RM-9001"],["approved","RM-9002"],["held","RM-9629"]]) {
      await page.locator(`#tab-${tab}`).click();await page.waitForTimeout(80);
      assert(await rows().count()===1,`${tab} did not show exactly one row`);assert(await rows().first().getAttribute("row-id")===id,`${tab} showed the wrong payment state`);
    }
  });
  await check("search finds a claim code, reports no matches, and clears",async()=>{
    await load();const search=page.getByRole("searchbox");await search.fill("H9D");await page.waitForTimeout(100);
    assert(await rows().count()===1 && await rows().first().getAttribute("row-id")==="RM-9629","code search mismatch");
    await search.fill("nothing-matches-123");await page.getByText(/No claims in this recall match/).waitFor();
    await page.getByRole("button",{name:"Clear search",exact:true}).first().click();await page.waitForTimeout(100);assert(await rows().count()===9,"clear did not restore claims");
  });
  await check("empty tab search points to matching claim's other status",async()=>{
    await load();await page.locator("#tab-paid").click();await page.getByRole("searchbox").fill("H9D");
    await page.getByRole("button",{name:"1 match in Held"}).click();await page.waitForTimeout(100);assert(await rows().first().getAttribute("row-id")==="RM-9629","suggested Held tab did not locate claim");
  });
  await check("claim sorting and grouping work without losing rows",async()=>{
    await load();await page.getByRole("columnheader",{name:/^Claim/}).first().getByText("Claim",{exact:true}).click();await page.waitForTimeout(100);
    assert(await page.locator(".ag-row[row-id][row-index='0']").getAttribute("row-id")==="RM-9545","ascending claim date sort failed");
    await page.getByRole("combobox",{name:"Group claims by"}).selectOption("day");await page.waitForTimeout(100);
    assert(await page.locator(".ag-row[row-id^='group:']").count()>0,"day group headers missing");
    await page.getByRole("combobox",{name:"Group claims by"}).selectOption("none");await page.waitForTimeout(100);assert(await rows().count()===9,"group reset lost claims");
  });
  await check("held evidence exposes photo, deciding model quote, checks and history",async()=>{
    await load();await open("RM-9629");const panel=page.getByRole("complementary");
    assert((await panel.innerText()).replace(/\s+/g," ").includes("Tag must read H9D"),"claim code not visible beside photo");
    assert((await panel.innerText()).includes("4 of 5 checks passed"),"check summary missing");
    assert(await panel.locator("q").count()>0,"deciding quote not exposed");
    await panel.getByText(/^History/).click();assert(await panel.locator("details[open]").count()>0,"history failed to expand");
    await panel.getByRole("button",{name:"Checks details"}).click();await page.screenshot({path:join(out,"held-evidence.png")});
  });
  await check("photo viewer opens zoomed to tag and returns to held evidence",async()=>{
    await load();await open("RM-9629");await page.getByRole("button",{name:"Zoom to tag"}).click();
    const dialog=page.getByRole("dialog");await dialog.waitFor();assert((await dialog.innerText()).replace(/\s+/g," ").includes("Tag must read H9D"),"viewer lost target code");
    await dialog.getByRole("button",{name:"Back to the evidence"}).click();assert(await page.getByRole("complementary").count()===1,"viewer return lost claim");
  });
  await check("review confirmation cancels and reject reason validates locally",async()=>{
    await load();await open("RM-9629");const panel=page.getByRole("complementary");const before=requests.length;
    await panel.getByRole("button",{name:"Approve…",exact:true}).click();await panel.getByText(/Remedy records your decision/).waitFor();
    await panel.getByRole("button",{name:"Cancel",exact:true}).click();assert(requests.length===before,"cancelling emitted an API request");
    await panel.getByRole("button",{name:"Reject…",exact:true}).click();await panel.getByRole("button",{name:"Reject claim",exact:true}).click();
    await panel.getByText("Say why in a few words, so the owner knows what to fix").first().waitFor();
    assert(await panel.getByRole("textbox").getAttribute("aria-invalid")==="true","short reason not flagged");
    assert(!requests.slice(before).some(r=>r.method==="POST"),"invalid reason emitted POST");
    await panel.getByRole("group",{name:"Quick reasons"}).getByRole("button").first().click();assert((await panel.getByRole("textbox").inputValue()).length>=8,"quick reason did not fill");
    await page.screenshot({path:join(out,"reject-review.png")});
  });
  await check("synthetic approval failure shows busy state and actionable error",async()=>{
    await load();await open("RM-9629");const panel=page.getByRole("complementary");
    await panel.getByRole("button",{name:"Approve…",exact:true}).click();await panel.getByRole("button",{name:"Approve",exact:true}).click();
    await panel.getByRole("button",{name:"Approving",exact:true}).waitFor();assert(await panel.getByRole("button",{name:"Approving",exact:true}).getAttribute("aria-busy")==="true","busy semantics missing");
    await panel.getByText("Synthetic review failure: nothing was saved").waitFor();assert(await panel.getByRole("button",{name:"Approve",exact:true}).count()===1,"error did not preserve retry");
    await page.screenshot({path:join(out,"review-error.png")});
  });
  await check("evidence load failure keeps claim header and retries",async()=>{
    await load();errorMode="drawer";await page.locator(".ag-row[row-id='RM-9629']").first().click();
    await page.getByText("Synthetic evidence load failure").waitFor();assert((await page.getByRole("complementary").innerText()).includes("RM-9629"),"error lost claim identity");
    errorMode="none";await page.getByRole("button",{name:"Try again",exact:true}).click();await page.getByRole("complementary").locator("img").first().waitFor();
  });
  await check("filtered CSV export contains only matching claim and plain payment labels",async()=>{
    await load();await page.locator("#tab-held").click();const [download]=await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name:"Export CSV"}).click()]);
    const file=join(out,"held-export.csv");await download.saveAs(file);const csv=await readFile(file,"utf8");
    assert(csv.includes("RM-9629") && !csv.includes("RM-0442"),"CSV ignored held filter");assert(csv.includes('"Held"'),"CSV lacks plain verdict");
  });
  await check("keyboard search, row opening, dismissal and shortcuts work",async()=>{
    await load();await page.locator("body").click({position:{x:5,y:5}});await page.keyboard.press("/");
    await page.waitForFunction(()=>document.activeElement?.getAttribute("type")==="search");
    assert(await page.getByRole("searchbox").evaluate(el=>el===document.activeElement),"slash did not focus search");
    await page.keyboard.press("Escape");await page.keyboard.press("Enter");await page.getByRole("complementary").waitFor();
    await page.keyboard.press("Escape");assert(await page.getByRole("complementary").count()===0,"Escape failed to close evidence");
    await page.keyboard.press("?");await page.getByRole("dialog",{name:"Keyboard"}).waitFor();await page.keyboard.press("Escape");
    assert(await page.getByRole("dialog").count()===0,"shortcut sheet did not close");
  });
  await check("mobile cards filter, open evidence sheet and cancel review",async()=>{
    await page.setViewportSize({width:390,height:844});await load();await page.locator("#tab-held").click();await page.waitForTimeout(100);
    await page.screenshot({path:join(out,"mobile-queue.png"),fullPage:true});
    await page.locator(".ag-row[row-id='RM-9629']").first().click();const sheet=page.getByRole("dialog");await sheet.waitFor();
    await sheet.getByRole("button",{name:"Approve…",exact:true}).click();await sheet.getByRole("button",{name:"Cancel",exact:true}).click();
    const mobileWidth=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));
    await writeFile(join(out,"mobile-width.json"),JSON.stringify(mobileWidth));
    if(mobileWidth.document>mobileWidth.viewport) await writeFile(join(out,"mobile-overflow.json"),JSON.stringify(mobileWidth));
    await page.screenshot({path:join(out,"mobile-evidence.png"),fullPage:true});await sheet.getByRole("button",{name:"Close the evidence"}).click();
    await page.getByRole("button",{name:"Search claims (/)"}).click();await page.getByRole("searchbox").fill("H9D");assert(await rows().count()===1,"mobile search failed");
    await page.setViewportSize({width:1440,height:1000});
    assert(mobileWidth.document<=mobileWidth.viewport,`mobile page overflowed horizontally: ${JSON.stringify(mobileWidth)}`);
  });
  await check("paid evidence names PayPal confirmation while settling stays waiting",async()=>{
    await page.setViewportSize({width:1440,height:1000});
    await load();await open("RM-0442");let panel=page.getByRole("complementary");assert((await panel.innerText()).includes("Paid through PayPal"),"confirmed payout not named");
    await panel.getByRole("button",{name:"Close the evidence"}).click();await open("RM-9001");panel=page.getByRole("complementary");
    assert((await panel.innerText()).includes("Sent, settling"),"pending payout not labelled settling");assert(!(await panel.innerText()).includes("Paid through PayPal"),"pending payout represented as confirmed");
  });
  await check("same claim id and version reloads evidence when filedAt changes",async()=>{
    await load();await open("RM-9629");const before=requests.length;
    const old=fixture.drawers["RM-9629"], newDate="2026-11-11T13:05:48.000Z";
    fixture.drawers["RM-9629"]={...old,createdAt:newDate,code:"Z9Z"};
    try {
      const changed=fixture.rows.map((r:{id:string})=>r.id==="RM-9629"?{...r,createdAt:newDate}:r);
      await page.evaluate(rows=>(window as unknown as {__renderQueue:(rows:unknown)=>void}).__renderQueue(rows),changed);
      await page.waitForTimeout(200);
      assert(requests.slice(before).some(r=>new URL(r.url).searchParams.get("at")===newDate),"changed filedAt reused cached evidence without reading new fixture");
      assert((await page.getByRole("complementary").innerText()).includes("Z9Z"),"new occurrence showed old code");
    } finally {fixture.drawers["RM-9629"]=old;}
  });
  await check("insights decision cross-filter changes counts and clears",async()=>{
    await load("insights");const decisions=page.getByRole("region",{name:"Decisions"});await decisions.getByRole("button",{name:/^Held/}).click();
    await page.getByText(/1 of 9 claims/).waitFor();await page.getByRole("button",{name:"Clear filter"}).click();
    assert(await decisions.getByRole("button",{name:/^Held/}).getAttribute("aria-pressed")==="false","clear filter failed");
    await page.screenshot({path:join(out,"insights.png"),fullPage:true});
  });
  await check("progress report differentiates sent refunds from accepted evidence and prints",async()=>{
    await load("report");const report=page.locator(".report-sheet");assert((await report.innerText()).includes("Units corrected by refund"),"report correction table missing");
    await page.evaluate(()=>{(window as unknown as {__printed:number}).__printed=0;window.print=()=>{(window as unknown as {__printed:number}).__printed++}});
    await page.getByRole("button",{name:"Print or save as PDF"}).click();assert(await page.evaluate(()=>(window as unknown as {__printed:number}).__printed)===1,"print button did not invoke browser print");
    await page.pdf({path:join(out,"progress-report.pdf"),format:"A4",printBackground:true});
  });
  await check("queue summary stays inside 320px, 768px and 1440px viewports",async()=>{
    for(const width of [320,768,1440]) {
      await page.setViewportSize({width,height:1000});await load();
      const size=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));
      assert(size.document<=size.viewport,`queue overflowed at ${width}px: ${JSON.stringify(size)}`);
    }
  });
} finally {
  await writeFile(join(out,"last-page.html"),await page.content());
  await page.screenshot({path:join(out,"last-page.png"),fullPage:true});
  await writeFile(join(out,"results.json"),JSON.stringify({results,requests,pageErrors:errors},null,2));
  await browser.close();await new Promise<void>(r=>server.close(()=>r()));
}
if(results.some(r=>!r.pass)) process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
