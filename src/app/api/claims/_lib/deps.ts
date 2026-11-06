import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getAppStore } from "@/lib/demo";
import type { DemoSample } from "@/lib/demo";
import { env } from "@/lib/env";
import { dHash } from "@/lib/fingerprint";
import { sendPayout } from "@/lib/paypal/payouts";
import { runVisionCheck } from "@/lib/vision/check";
import type { PipelineDeps } from "./pipeline";

// The real outside world for the pipeline: the app store, the vision model, PayPal Payouts.
export async function liveDeps(): Promise<PipelineDeps> {
  return {
    store: await getAppStore(),
    vision: async ({ images, spec, code }) => {
      const r = await runVisionCheck({ images, spec, code });
      return { verdict: r.verdict, seconds: r.seconds, model: r.model };
    },
    pay: sendPayout,
    hash: dHash,
    now: () => new Date(),
  };
}

// The sample's photos as bytes. From disk when the deployment ships public/, else over HTTP from the app itself.
export async function samplePhotos(sample: DemoSample, origin: string): Promise<Buffer[]> {
  return Promise.all(
    sample.photos.map(async (path) => {
      const name = path.match(/^\/demo\/([a-z0-9-]+\.jpg)$/)?.[1];
      if (!name) throw new Error(`Unexpected sample path ${path}`);
      try {
        // Scoped to public/demo so the build traces only the sample photos.
        return await readFile(join(process.cwd(), "public/demo", name));
      } catch {
        const res = await fetch(new URL(path, origin || env().APP_URL));
        if (!res.ok) throw new Error(`Sample photo ${path} -> ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      }
    }),
  );
}
