import * as THREE from "three";

interface ThreeWithTimer {
  Timer?: unknown;
  Clock?: { __isPolyfill?: boolean };
}

// Silence known benign Three.js/browser warnings emitted by downstream integrations.
if (typeof window !== "undefined") {
  const three = THREE as ThreeWithTimer;
  if (three.Timer && !three.Clock?.__isPolyfill) {
    const warn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === "string") {
        if (args[0].includes("THREE.Clock: This module has been deprecated")) return;
        if (args[0].includes("THREE.WebGLProgram: Program Info Log") && args[0].includes("warning X4122")) return;
      }
      warn(...args);
    };
  }
}
