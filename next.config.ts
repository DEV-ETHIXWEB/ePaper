import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
