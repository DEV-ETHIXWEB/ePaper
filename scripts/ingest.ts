import { readFile } from "node:fs/promises";
import { ingestEdition } from "@/lib/ingest";
import { getIssue, listPages } from "@/lib/db/queries";

async function main(): Promise<void> {
  const [, , slug, date, file] = process.argv;
  if (!slug || !date || !file) {
    console.error("usage: pnpm ingest <publication-slug> <YYYY-MM-DD> <file.pdf>");
    process.exit(1);
  }

  const pdf = new Uint8Array(await readFile(file));
  process.stdout.write(`  ingesting ${slug} ${date} ... `);

  const result = await ingestEdition({
    publicationSlug: slug,
    publishDate: date,
    pdf,
    onProgress: (n, total) =>
      process.stdout.write(`\r  ingesting ${slug} ${date} ... page ${n}/${total}`),
  });

  const issue = getIssue(slug, date);
  const pages = listPages(result.issueId);
  console.log(
    `\r  done: ${result.pageCount} pages, ` +
      `${(result.bytesStored / 1024 / 1024).toFixed(2)} MB stored, ` +
      `${(result.durationMs / 1000).toFixed(1)}s ` +
      `(${Math.round(result.durationMs / result.pageCount)}ms/page)   `,
  );
  console.log(`  issue status: ${issue?.status}, pages in db: ${pages.length}`);
}

main().catch((err) => {
  console.error("\n  FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
