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

  // addresses of the previous Cardano Tools, so old links and bookmarks keep working
  async redirects() {
    const moved: Record<string, string> = {
      "/latest": "/browse",
      "/chien": "/pool",
      "/royaltiescip27": "/royalties",
      "/reward-stakers": "/rewards",
      "/wallet-statement": "/statement",
      "/burn-address": "/burn",
      // the page was called "Move wallet" for a day
      "/move": "/close",
      "/mint-on-demand": "/mint",
      "/drop/:prettyUrl": "/browse",
    };
    return Object.entries(moved).map(([source, destination]) => ({ source, destination, permanent: true }));
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
