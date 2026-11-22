import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // self contained server in .next/standalone for the Docker image
  output: "standalone",

  experimental: {
    serverActions: {
      bodySizeLimit: "110mb",
    },
  },

  async rewrites() {
    return [
      {
        source: "/", // Incoming request path
        destination: "/browse", // Path to serve content from
      },
    ];
  },

  cleanDistDir: false,

  images: {
    remotePatterns: [
      {
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
