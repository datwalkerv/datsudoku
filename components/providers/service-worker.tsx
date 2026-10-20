"use client";

import { SerwistProvider } from "@serwist/turbopack/react";

/** Registers the service worker in production builds. */
export function ServiceWorker() {
  return <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV !== "production"} />;
}
