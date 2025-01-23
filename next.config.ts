import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/", // Incoming request path
        destination: "/browse", // Path to serve content from
      },
    ];
  },
  webpack: (config) => {
    // Enable async WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    config.ignoreWarnings = config.ignoreWarnings || [];
    config.ignoreWarnings.push(
      /The generated code contains 'async\/await' because this module is using "asyncWebAssembly"/
    );
    return config;
  },
};

export default nextConfig;
