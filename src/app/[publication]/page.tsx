import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLatestIssue, getPublicationBySlug } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * Opening a publication means "today's paper", so this resolves to the most
 * recent ready edition and hands off to the dated URL. Readers then get a
 * shareable link to a specific day rather than one that silently changes.
 */
export default async function PublicationPage({
  params,
}: {
  params: Promise<{ publication: string }>;
}) {
  const { publication } = await params;
  if (!getPublicationBySlug(publication)) notFound();

  const latest = getLatestIssue(publication);
  if (!latest) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-ink">ਅਜੇ ਕੋਈ ਅੰਕ ਨਹੀਂ</h1>
        <p className="mt-2 text-sm text-ink-faint">
          ਇਸ ਅਖ਼ਬਾਰ ਦਾ ਕੋਈ ਅੰਕ ਅਜੇ ਪ੍ਰਕਾਸ਼ਿਤ ਨਹੀਂ ਹੋਇਆ।
        </p>
        <Link href="/" className="mt-6 inline-block text-sm underline">
          ਸਾਰੇ ਅਖ਼ਬਾਰ
        </Link>
      </main>
    );
  }

  redirect(`/${publication}/${latest.publish_date}/`);
}
