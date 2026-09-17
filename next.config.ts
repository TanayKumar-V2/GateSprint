import type { NextConfig } from "next";
import { getSecurityHeaders } from "./lib/security/headers";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "standalone",
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
