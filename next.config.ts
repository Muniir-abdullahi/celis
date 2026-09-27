import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres", "firebase-admin"],
};

export default nextConfig;
