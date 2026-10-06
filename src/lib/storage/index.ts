import { env } from "@/lib/env";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";

/**
 * Object storage behind one small interface.
 *
 * The provider is the single biggest cost lever on this project — Backblaze,
 * R2 and Wasabi differ by several times for the same bytes — so it is kept as
 * a config switch rather than something woven through the code. The local
 * driver exists so development needs no cloud account at all.
 */
export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(prefix: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Public URL a browser can fetch, normally through a CDN. */
  url(key: string): string;
}

let instance: Storage | null = null;

export function storage(): Storage {
  if (!instance) {
    instance = env.STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalStorage();
  }
  return instance;
}

/**
 * Where a page's images live.
 *
 * Laid out by publication and date so the bucket stays browsable by a human
 * and a whole edition can be removed with a single prefix delete:
 *   editions/chardikala-punjab/2026/10/06/page-001/
 */
export function pagePrefix(
  publicationSlug: string,
  publishDate: string,
  pageNumber: number,
): string {
  const [y, m, d] = publishDate.split("-");
  const n = String(pageNumber).padStart(3, "0");
  return `editions/${publicationSlug}/${y}/${m}/${d}/page-${n}`;
}

export function issuePrefix(
  publicationSlug: string,
  publishDate: string,
): string {
  const [y, m, d] = publishDate.split("-");
  return `editions/${publicationSlug}/${y}/${m}/${d}`;
}

export function sourceKey(
  publicationSlug: string,
  publishDate: string,
): string {
  return `${issuePrefix(publicationSlug, publishDate)}/source.pdf`;
}
