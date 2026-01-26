
export interface RecyclingResult {
  itemName: string;
  category: string;
  isRecyclable: boolean;
  disposalSteps: string[];
  tips: string;
}

export interface HistoryItem {
  id: string;
  image: string;
  result: RecyclingResult;
  timestamp: number;
}

export enum AppState {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  LOADING = 'LOADING',
  RESULT = 'RESULT',
  ERROR = 'ERROR',
  GALLERY = 'GALLERY'
}

export type ViewType = 'main' | 'gallery';
export type TabType = 'scanner' | 'search';
