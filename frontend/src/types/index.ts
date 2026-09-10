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

export interface DisposalRule {
  disposalDays: string;
  startTime: string;
  endTime: string;
  place: string;
  method: string;
}

export interface WasteInfoSimple {
  sido: string;
  sigungu: string;
  managementArea?: string | null;
  rules: DisposalRule[];
}

export interface MarkResult {
  category: string | null;
  material: string | null;
  texts: string[];
}

export interface RecyclingResult {
  itemName: string;
  category: string;
  markResult?: MarkResult;
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
  regionInfo?: { sido: string; sigungu: string; managementArea?: string };
  result: RecyclingResult;
  timestamp: number;
}

export interface ScanState {
  image?: string;
  searchText?: string;
  region?: { sido: string; sigungu: string; managementArea?: string };
  wasteInfo?: WasteInfo;
}

export interface RegionListResponse {
  regions: string[];
}

export interface SigunguListResponse {
  sido: string;
  sigungu: string[];
}

export interface AreaListResponse {
  sido: string;
  sigungu: string;
  areas: string[];
  required: boolean;
}
