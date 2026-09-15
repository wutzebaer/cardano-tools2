import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
