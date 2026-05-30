"use client";

import { useEffect } from "react";

/**
 * Loads the THREE.Clock deprecation suppression polyfill on the client only.
 * Used in app/layout.tsx so the suppression is in place before R3F mounts.
 */
export default function ThreePolyfill() {
  useEffect(() => {
    // Dynamic import so three is only loaded on the client
    import("@/lib/three-polyfill").catch(() => {
      /* ignore – polyfill is best-effort */
    });
  }, []);
  return null;
}
