import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit .next/standalone for the Docker image (see Dockerfile).
  // Vercel ignores this and uses its own bundling path.
  output: "standalone",
  allowedDevOrigins: [
    "easiness-bulge-expansive.ngrok-free.dev",
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
  ],
};

export default nextConfig;
