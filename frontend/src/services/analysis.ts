import { analyzeImage } from './api';
import type { MarkResult } from '../types';

// Keep a small in-memory cache for route back navigation and StrictMode mounts.
const photos = new Map<string, { promise: Promise<MarkResult>; itemName?: string }>();

export function analyzePhotoOnce(image: string): Promise<MarkResult> {
  const cached = photos.get(image);
  if (cached) return cached.promise;
  const promise = analyzeImage(image).catch(error => {
    photos.delete(image);
    throw error;
  });
  if (photos.size >= 3) photos.delete(photos.keys().next().value!);
  photos.set(image, { promise });
  return promise;
}

export function rememberPhotoItem(image: string, itemName: string) {
  const cached = photos.get(image);
  if (cached) cached.itemName = itemName;
}

export function photoItemDraft(image: string) {
  return photos.get(image)?.itemName;
}
