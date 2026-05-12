export interface WasteInfo {
  시도명: string;
  시군구명: string;
  배출장소: string;
  생활쓰레기배출방법: string;
  음식물쓰레기배출방법: string;
  재활용품배출방법: string;
  생활쓰레기배출요일: string;
  재활용품배출요일: string;
  재활용품배출시작시각: string;
  재활용품배출종료시각: string;
}

export interface WasteInfoSimple {
  배출요일: string;
  배출시작시각: string;
  배출종료시각: string;
  배출장소: string;
  시도명: string;
  시군구명: string;
}

export interface RecyclingResult {
  itemName: string;
  category: string;
  isRecyclable: boolean;
  disposalSteps: string[];
  tips: string[];
  source: string;
  wasteInfo?: WasteInfoSimple;
}

export interface HistoryItem {
  id: string;
  image?: string;
  searchText?: string;
  itemName: string;
  region: string;
  result: RecyclingResult;
  timestamp: number;
}

export interface ScanState {
  image?: string;
  searchText?: string;
  region?: { sido: string; sigungu: string };
  wasteInfo?: WasteInfo;
}
