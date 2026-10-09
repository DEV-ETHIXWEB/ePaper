import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Standalone output: the container ships the server and only the modules it
   * actually imports, instead of the whole node_modules tree. Matters here
   * because the dependency set includes sharp, pdfjs and tesseract.js.
   */
  output: "standalone",
  poweredByHeader: false,
  /**
   * Native modules cannot be bundled — they load a platform-specific .node
   * binary at runtime. Turbopack fails with "non-ecmascript placeable asset"
   * if it tries. These stay external and are required normally on the server.
   */
  serverExternalPackages: [
    "better-sqlite3",
    "sharp",
    "@napi-rs/canvas",
    "pdfjs-dist",
  ],
  // Links throughout the app are written with a trailing slash; matching the
  // config means readers get the page directly instead of a redirect hop on
  // every navigation.
  trailingSlash: true,
  async headers() {
    const isHttps = /^https:/i.test(process.env.NEXT_PUBLIC_SITE_URL ?? "");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Only meaningful over TLS, and actively harmful on a plain-http
          // localhost: WebKit honours it and then refuses every asset.
          ...(isHttps
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
