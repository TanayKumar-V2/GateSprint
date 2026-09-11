import type { NextConfig } from "next";
import { getSecurityHeaders } from "./lib/security/headers";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
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
