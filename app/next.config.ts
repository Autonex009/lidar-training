import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a second dev server / build use its own output folder (never touch the running dev server's .next).
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Pin the workspace root (a stray lockfile in a parent directory otherwise triggers a warning).
  outputFileTracingRoot: path.join(__dirname),
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
