import { readFile } from "node:fs/promises";
import { ingestEdition } from "@/lib/ingest";
import { getIssue, listIssues, listPages } from "@/lib/db/queries";

const out: Array<[string, boolean, string]> = [];
const ok = (n: string, pass: boolean, d = "") => out.push([n, pass, d]);

/** Returns the thrown message, or null if it unexpectedly succeeded. */
async function threw(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function main(): Promise<void> {
  const pdf = new Uint8Array(await readFile("samples/test-edition.pdf"));
  const P = "chardikala-punjab";

  // Re-uploading a day is a normal correction, not a duplicate.
  await ingestEdition({ publicationSlug: P, publishDate: "2026-10-06", pdf });
  const same = listIssues({ publicationSlug: P }).items.filter(
    (i) => i.publish_date === "2026-10-06",
  );
  ok("re-upload replaces, no duplicate", same.length === 1, `${same.length} row(s)`);
  ok("pages not duplicated", listPages(same[0].id).length === 8, `${listPages(same[0].id).length} pages`);

  const badDate = await threw(() =>
    ingestEdition({ publicationSlug: P, publishDate: "06-10-2026", pdf }));
  ok("rejects bad date format", badDate !== null, badDate ?? "did not throw");

  const badPub = await threw(() =>
    ingestEdition({ publicationSlug: "no-such-paper", publishDate: "2026-10-06", pdf }));
  ok("rejects unknown publication", badPub !== null, badPub ?? "did not throw");

  const empty = await threw(() =>
    ingestEdition({ publicationSlug: "chardikala-haryana", publishDate: "2026-10-06", pdf: new Uint8Array(0) }));
  ok("rejects empty pdf", empty !== null, empty ?? "did not throw");

  const corrupt = await threw(() =>
    ingestEdition({
      publicationSlug: "chardikala-haryana",
      publishDate: "2026-10-07",
      pdf: new Uint8Array(Buffer.from("not a pdf at all")),
    }));
  ok("rejects corrupt pdf", corrupt !== null, (corrupt ?? "did not throw").slice(0, 50));

  // A failure must be visible, not a silent gap in the archive.
  const failed = getIssue("chardikala-haryana", "2026-10-07");
  ok("failure recorded as 'failed'", failed?.status === "failed", `status=${failed?.status}`);
  ok("failure stores a reason", Boolean(failed?.error), (failed?.error ?? "").slice(0, 40));

  const good = await ingestEdition({ publicationSlug: "bdh-punjab", publishDate: "2026-10-06", pdf });
  ok("recovers after a failure", good.pageCount === 8, `${good.pageCount} pages`);

  ok("lists across publications", listIssues({}).total >= 2, `${listIssues({}).total} issues`);
  ok("date filter works",
     listIssues({ from: "2026-10-06", to: "2026-10-06" }).items.every((i) => i.publish_date === "2026-10-06"));
  ok("status filter works",
     listIssues({ status: "ready" }).items.every((i) => i.status === "ready"));

  const passed = out.filter((r) => r[1]).length;
  console.log(`\n  ${passed}/${out.length} passed\n`);
  for (const [n, p, d] of out) console.log(`  ${p ? "PASS" : "FAIL"}  ${n.padEnd(32)} ${d}`);
  if (passed !== out.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error("  harness error:", e);
  process.exitCode = 1;
});
