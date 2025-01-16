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

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude the library from the server-side build
      config.externals.push("@emurgo/cardano-serialization-lib-browser");
    }

    // Enable WebAssembly support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
    };

    return config;
  },
};

export default nextConfig;
