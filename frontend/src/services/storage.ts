import { HistoryItem } from '../types';

const KEY = 'recycling_history';

export function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveHistory(items: HistoryItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function addHistory(item: HistoryItem): void {
  const history = loadHistory();
  const updated = [item, ...history].slice(0, 30);
  saveHistory(updated);
}

export function deleteHistory(id: string): void {
  const updated = loadHistory().filter(h => h.id !== id);
  saveHistory(updated);
}
