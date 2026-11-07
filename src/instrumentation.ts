// Runs once when the server starts. Says so when a local review server is on review replay (src/lib/review/replay.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { replayNotice } = await import("./lib/review/replay");
  const notice = replayNotice();
  if (notice) console.warn(notice);
}
