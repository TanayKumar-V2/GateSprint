import type { NextConfig } from "next";
import { getSecurityHeaders } from "./lib/security/headers";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Vercel injects its own adapter (NEXT_ADAPTER_PATH), which on Next 16.3
  // skips emitting next-server.js.nft.json while the standalone finalizer
  // still reads it -> ENOENT in onBuildComplete. Vercel never uses the
  // standalone server anyway; keep it for Docker/self-hosted builds only.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  images: {
    // Google is the only OAuth provider, so avatars always come from here.
    // Picsum serves the landing page's duotone-treated editorial imagery.
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  async headers() {
    const security = getSecurityHeaders(isProduction);
    return [
      {
        source: "/:path*",
        headers: Object.entries(security).map(([key, value]) => ({
          key,
          value,
        })),
      },
    ];
  },
};

export default nextConfig;
