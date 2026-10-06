import { mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { dirname, join, resolve, normalize } from "node:path";
import { env } from "@/lib/env";
import type { Storage } from "./index";

/**
 * Filesystem driver for development.
 *
 * Files are served back through an application route rather than a static
 * mount, so the same URL shape works here and in production.
 */
export class LocalStorage implements Storage {
  private root = resolve(process.cwd(), env.LOCAL_STORAGE_DIR);

  /**
   * Resolve a key to a path, refusing anything that escapes the root.
   * Keys are built internally today, but a traversal bug in a future caller
   * should not be able to write over the rest of the disk.
   */
  private pathFor(key: string): string {
    const clean = normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    const full = join(this.root, clean);
    if (!full.startsWith(this.root)) {
      throw new Error(`Refusing key outside storage root: ${key}`);
    }
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(prefix: string): Promise<void> {
    await rm(this.pathFor(prefix), { recursive: true, force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  url(key: string): string {
    return `/media/${key}`;
  }
}
