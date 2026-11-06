import { join } from "node:path";
import { env } from "../env";
import { blobStore } from "./blob";
import { localStore } from "./local";
import type { Store } from "./store";

export type { ClaimSummary, Store } from "./store";

let store: Store | undefined;

// Vercel Blob when a token is set, else local files under data/.
export function getStore(): Store {
  if (!store) {
    const token = env().BLOB_READ_WRITE_TOKEN;
    store = token ? blobStore(token) : localStore(join(process.cwd(), "data"));
  }
  return store;
}
