
import { HistoryItem } from "../types";

const STORAGE_KEY = 'ecoscan_history';

export const saveHistory = (history: HistoryItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
};

export const loadHistory = (): HistoryItem[] => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
};
