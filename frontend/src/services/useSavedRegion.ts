import { useSyncExternalStore } from 'react';
import { parseSavedRegion, REGION_CHANGED, REGION_KEY, type SavedRegion } from './region';

let lastRaw: string | null | undefined;
let lastRegion: SavedRegion | null = null;
function snapshot() {
  let raw: string | null = null;
  try { raw = localStorage.getItem(REGION_KEY); } catch { /* Storage may be unavailable. */ }
  if (raw !== lastRaw) { lastRaw = raw; lastRegion = parseSavedRegion(raw); }
  return lastRegion;
}
function subscribe(changed: () => void) {
  window.addEventListener('storage', changed);
  window.addEventListener(REGION_CHANGED, changed);
  return () => {
    window.removeEventListener('storage', changed);
    window.removeEventListener(REGION_CHANGED, changed);
  };
}
export function useSavedRegion() {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
