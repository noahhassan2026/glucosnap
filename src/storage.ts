import { useEffect, useState } from "react";

// localStorage can throw (private mode, blocked storage); the app must work without it.
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function loadArray<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function useStored<T>(key: string, initial: () => T) {
  const [v, setV] = useState<T>(initial);
  useEffect(() => save(key, v), [key, v]);
  return [v, setV] as const;
}
