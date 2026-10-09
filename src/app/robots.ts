import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The newsroom area and the per-reader clip pages are not content.
        // Clips in particular would be thousands of near-duplicate pages of
        // one cropped image each.
        disallow: ["/admin", "/api/", "/clip/"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
