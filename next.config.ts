import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/", // Incoming request path
        destination: "/mint", // Path to serve content from
      },
    ];
  },
};

export default nextConfig;
