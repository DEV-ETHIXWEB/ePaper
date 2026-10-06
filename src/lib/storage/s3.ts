import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import type { Storage } from "./index";

/**
 * S3-compatible driver: Backblaze B2, Cloudflare R2, Wasabi, MinIO.
 *
 * `forcePathStyle` is on because B2 and MinIO address buckets by path while
 * AWS uses a subdomain. Path style works on all of them.
 */
export class S3Storage implements Storage {
  private client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  });

  private bucket = env.S3_BUCKET!;

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Pages never change once rendered, so they can be cached hard. The key
        // includes the date, so a re-upload writes a new object rather than
        // needing a purge.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  /** Delete every object under a prefix, a page at a time. */
  async delete(prefix: string): Promise<void> {
    let token: string | undefined;
    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      const keys = (listed.Contents ?? [])
        .map((o) => o.Key)
        .filter((k): k is string => Boolean(k));
      if (keys.length) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })) },
          }),
        );
      }
      token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (token);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  url(key: string): string {
    return `${env.STORAGE_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
  }
}
