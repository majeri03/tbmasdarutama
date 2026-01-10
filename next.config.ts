import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "flat-art-975br2-upload-worker.kirinxe00.workers.dev",
      },
    ],
    unoptimized: process.env.NODE_ENV === "development",
  },
};


export default nextConfig;
