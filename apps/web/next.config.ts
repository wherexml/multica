import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";

// Load root .env so REMOTE_API_URL is available to next.config.ts
config({ path: resolve(__dirname, "../../.env") });

// Client-side (NEXT_PUBLIC_): empty = use relative URLs (go through Next.js rewrites)
// Server-side rewrites must target the backend service, not the frontend's own PORT.
export function resolveRemoteApiUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.BACKEND_REWRITE_URL) {
    return env.BACKEND_REWRITE_URL;
  }

  if (env.NODE_ENV === "development") {
    return `http://localhost:${env.BACKEND_PORT || "22201"}`;
  }

  return "http://backend:8080";
}

const remoteApiUrl = resolveRemoteApiUrl();

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 80, 85],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${remoteApiUrl}/api/:path*`,
      },
      {
        source: "/ws",
        destination: `${remoteApiUrl}/ws`,
      },
      {
        source: "/auth/:path*",
        destination: `${remoteApiUrl}/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
