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
        <h1 className="text-xl font-bold">No editions yet</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Nothing has been published for this title so far.
        </p>
      </main>
    );
  }

  redirect(`/${publication}/${latest.publish_date}/`);
}
