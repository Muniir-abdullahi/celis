"use client";

import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";

const router = getRouter();

export function MarketplaceRouter() {
  return <RouterProvider router={router} />;
}
