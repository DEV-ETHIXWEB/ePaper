import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getClip, getPageById, getIssueById } from "@/lib/db/queries";
import { clipUrl } from "@/lib/clip";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const url = clipUrl(id);
  if (!url) return { title: "Clip not found" };
  // The image tag is the point: a shared link should preview the clipping
  // itself in WhatsApp and Facebook, not a generic site card.
  return {
    title: "ਖ਼ਬਰ ਦੀ ਕਲਿੱਪ",
    openGraph: { images: [url], type: "article" },
    twitter: { card: "summary_large_image", images: [url] },
  };
}

export default async function ClipPage({ params }: Props) {
  const { id } = await params;
  const clip = getClip(id);
  const url = clipUrl(id);
  if (!clip || !url) notFound();

  const page = getPageById(clip.page_id);
  const issue = page ? getIssueById(page.issue_id) : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="ਖ਼ਬਰ ਦੀ ਕਲਿੱਪ"
        className="w-full rounded-xl border border-line" />

      {issue && page && (
        <div className="mt-4 text-sm text-ink-faint">
          <p className="font-semibold text-ink">
            {issue.publication_name_local ?? issue.publication_name}
          </p>
          <p>
            {formatDate(issue.publish_date, issue.publication_language)} · ਸਫ਼ਾ {page.page_number}
          </p>
          <Link href={`/${issue.publication_slug}/${issue.publish_date}/`}
            className="mt-3 inline-block underline">
            ਪੂਰਾ ਅਖ਼ਬਾਰ ਪੜ੍ਹੋ →
          </Link>
        </div>
      )}
    </main>
  );
}
