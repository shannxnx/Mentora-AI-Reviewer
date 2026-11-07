import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  async redirects() {
    const sections = ["subjects", "materials", "generate", "flashcards", "profile", "progress", "practice"];
    return [
      ...sections.map(section => ({
        source: "/demo/student/" + section, destination: "/dashboard/" + section, permanent: false,
      })),
      ...["/demo/:path*", "/Home", "/protected"].map(source => ({
        source, destination: "/dashboard", permanent: false,
      })),
    ];
  },
  experimental: {
    // A 10 MB PDF needs a little extra room for multipart form metadata.
    proxyClientMaxBodySize: "11mb",
  },
};

export default nextConfig;
