import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres", "firebase-admin"],
  experimental: { globalNotFound: true },
};

export default nextConfig;
