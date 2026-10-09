/**
 * The public address of this deployment.
 *
 * Canonical URLs, sitemaps and share links all have to be absolute, and
 * getting this wrong is the kind of mistake that only shows up once something
 * is live and pointing at localhost. So the configured value wins, the
 * platform's own hostname is the fallback, and localhost is only ever used in
 * development.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return `http://localhost:${process.env.PORT ?? 3000}`;
}
