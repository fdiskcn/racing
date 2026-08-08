import * as THREE from 'three';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export function horizontalDir(from: THREE.Vector3, to: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
  out.subVectors(to, from);
  out.y = 0;
  if (out.lengthSq() < 1e-6) {
    out.set(0, 0, -1);
  } else {
    out.normalize();
  }
  return out;
}

export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
