import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained production build (.next/standalone) used by the host entry point app.js.
  output: "standalone",
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  serverExternalPackages: ["unpdf", "mammoth", "pdf-lib"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
