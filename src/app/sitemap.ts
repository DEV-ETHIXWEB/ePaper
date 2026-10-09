import type { MetadataRoute } from "next";
import { listIssues, listPublications } from "@/lib/db/queries";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Every edition that is ready to read.
 *
 * A newspaper archive is worth very little if it cannot be found, and these
 * pages are not reachable by crawling: the only paths to a given day are the
 * calendar and a search box, neither of which a crawler will work through.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const publications = listPublications();

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/search/`, changeFrequency: "monthly", priority: 0.3 },
  ];

  for (const p of publications) {
    entries.push({
      url: `${base}/${p.slug}/`,
      changeFrequency: "daily",
      priority: 0.9,
    });
    entries.push({
      url: `${base}/${p.slug}/archive/`,
      changeFrequency: "daily",
      priority: 0.6,
    });
  }

  // A sitemap has a 50,000 URL ceiling. At nine titles a day that is years of
  // archive, so one file is enough; if it is ever outgrown this needs
  // splitting by year rather than silently truncating.
  const { items } = listIssues({ status: "ready", limit: 200 });
  for (const issue of items) {
    entries.push({
      url: `${base}/${issue.publication_slug}/${issue.publish_date}/`,
      lastModified: issue.published_at ? new Date(issue.published_at) : undefined,
      changeFrequency: "yearly",
      priority: 0.7,
    });
  }

  return entries;
}
