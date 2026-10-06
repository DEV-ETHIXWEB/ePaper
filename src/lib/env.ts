import { z } from "zod";

/**
 * Environment is validated once, at startup, and the process refuses to run if
 * anything required is missing or malformed.
 *
 * The alternative — reading process.env where it is needed — fails at the worst
 * possible moment: a newsroom uploads the morning edition and discovers the
 * storage credentials were never set. Failing loudly on boot is cheaper.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** Where the SQLite file lives. Relative paths resolve from the project root. */
  DATABASE_PATH: z.string().min(1).default("./data/epaper.db"),

  /**
   * Object storage. Any S3-compatible provider works: Backblaze B2, Cloudflare
   * R2, Wasabi, MinIO. Keeping it S3-shaped means the provider is a config
   * change, not a rewrite, which matters when the bill is the deciding factor.
   */
  STORAGE_DRIVER: z.enum(["s3", "local"]).default("local"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /** Public base URL that serves the bucket, usually a CDN in front of it. */
  STORAGE_PUBLIC_URL: z.string().url().optional(),
  /** Where the local driver writes, for development. */
  LOCAL_STORAGE_DIR: z.string().default("./data/storage"),

  /** Admin sign-in. */
  AUTH_SECRET: z.string().min(32).optional(),
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),

  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }

  const env = parsed.data;

  // Cross-field rules zod cannot express on its own.
  if (env.STORAGE_DRIVER === "s3") {
    const missing = (
      ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "STORAGE_PUBLIC_URL"] as const
    ).filter((k) => !env[k]);
    if (missing.length) {
      throw new Error(
        `STORAGE_DRIVER is "s3" but these are not set: ${missing.join(", ")}`,
      );
    }
  }

  return env;
}

export const env = load();
export const isProduction = env.NODE_ENV === "production";
