"use client";

import dynamic from "next/dynamic";

const MarketplaceRouter = dynamic(
  () => import("../legacy-router").then((module) => module.MarketplaceRouter),
  { ssr: false }
);

export default function CatchAllPage() {
  return <MarketplaceRouter />;
}
