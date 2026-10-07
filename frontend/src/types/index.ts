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
  관리번호: string;
  관리구역명: string | null;
  관리구역대상지역명: string | null;
  배출장소유형: string | null;
  배출요일: string | null;
  배출시작시각: string | null;
  배출종료시각: string | null;
  배출장소: string | null;
  재활용품배출방법: string | null;
  데이터기준일자: string;
  오래된정보: boolean;
  시도명: string;
  시군구명: string;
}

export interface WasteRecordOption {
  관리번호: string;
  관리구역명: string;
  관리구역대상지역명: string;
  배출장소유형: string;
  배출장소: string;
}

export interface WasteRecordListResponse {
  total: number;
  records: WasteRecordOption[];
}

export interface RegionSelection {
  sido: string;
  sigungu: string;
  managementId: string;
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
  guideStatus: 'ready' | 'unavailable';
  isRecyclable: boolean | null;
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
  regionSelection?: RegionSelection;
  result: RecyclingResult;
  timestamp: number;
}

export interface ScanState {
  image?: string;
  searchText?: string;
  region?: RegionSelection;
  wasteInfo?: WasteInfo;
}

export interface RegionListResponse {
  regions: string[];
}

export interface SigunguListResponse {
  sido: string;
  sigungu: string[];
}
