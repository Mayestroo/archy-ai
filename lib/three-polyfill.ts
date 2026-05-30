import * as THREE from "three";

interface ThreeWithTimer {
  Timer?: unknown;
  Clock?: { __isPolyfill?: boolean };
}

// Silence the Clock deprecation warning emitted by downstream Three.js integrations.
if (typeof window !== "undefined") {
  const three = THREE as ThreeWithTimer;
  if (three.Timer && !three.Clock?.__isPolyfill) {
    const warn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("THREE.Clock: This module has been deprecated")) return;
      warn(...args);
    };
  }
}
