// Seeds the Kikea demo recall and its sample claims into the app's store: local files under data/, or Vercel Blob when
// BLOB_READ_WRITE_TOKEN is set. Idempotent; --reset rewrites the sample claims with fresh times.
//   npm run seed
//   npm run seed -- --reset
import { parseArgs } from "node:util";
import { ensureDemoData } from "../src/lib/demo/seed";
import { env } from "../src/lib/env";
import { getStore } from "../src/lib/store";

const { values } = parseArgs({ options: { reset: { type: "boolean", default: false } } });

async function main() {
  const where = env().BLOB_READ_WRITE_TOKEN ? "Vercel Blob" : "data/";
  const result = await ensureDemoData(getStore(), { reset: values.reset });
  console.log(`Kikea recall ${result.recall}; ${result.count} sample claims ${result.claims} (${where})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
