import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: no `output: "standalone"` — that mode is for Docker/self-hosting
  // and makes `next start` impossible. Vercel (and `next start`) need the
  // regular build output.
  // z-ai-web-dev-sdk (GLM fallback) must stay external to the server bundle.
  serverExternalPackages: ["z-ai-web-dev-sdk"],
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
