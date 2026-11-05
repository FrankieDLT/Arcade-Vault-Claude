import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for GitHub Pages: no server, so no route handlers.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Empty locally; CI sets "/Arcade-Vault-Claude".
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  experimental: {
    agentFeedback: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
