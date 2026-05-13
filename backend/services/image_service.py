import base64
import re
from pathlib import Path

import numpy as np
import cv2
from ultralytics import YOLO
import easyocr

_yolo = None
_ocr = None
BASE_DIR = Path(__file__).resolve().parent.parent
YOLO_MODEL_PATH = BASE_DIR / "yolov8n.pt"

# 재활용 마크 → (대분류, 세부재질) 매핑
# 출처: 환경부 분리배출 표시에 관한 지침
RECYCLE_MARK_MAP = {
    # 세부 재질 코드 (우선 매핑)
    "PET":      ("페트",    "PET"),
    "PETE":     ("페트",    "PET"),
    "HDPE":     ("플라스틱", "HDPE"),
    "LDPE":     ("비닐류",  "LDPE"),
    "PVC":      ("플라스틱", "PVC"),
    "PP":       ("플라스틱", "PP"),
    "PS":       ("비닐류",  "PS"),
    "OTHER":    ("플라스틱", "OTHER"),
    # 바이오 플라스틱
    "바이오PET":  ("페트",    "바이오PET"),
    "바이오HDPE": ("플라스틱", "바이오HDPE"),
    "바이오LDPE": ("비닐류",  "바이오LDPE"),
    "바이오PP":   ("플라스틱", "바이오PP"),
    "바이오PS":   ("비닐류",  "바이오PS"),
    # 금속
    "철":    ("캔류", "철"),
    "알미늄": ("캔류", "알루미늄"),
    "AL":    ("캔류", "알루미늄"),
    # 대분류 한글 (보조 매핑)
    "무색페트": ("페트",    None),
    "페트":    ("페트",    None),
    "플라스틱": ("플라스틱", None),
    "비닐류":  ("비닐류",  None),
    "캔류":   ("캔류",   None),
    "종이":   ("종이",   None),
    "일반팩":  ("종이팩",  None),
    "멸균팩":  ("종이팩",  "멸균"),
    "종이팩":  ("종이팩",  None),
    "유리":   ("유리",   None),
    "도포":   ("도포첩합", None),
    "첩합":   ("도포첩합", None),
    # 무시
    "재활용":  None,
}


def _get_yolo():
    global _yolo
    if _yolo is None:
        _yolo = YOLO(str(YOLO_MODEL_PATH))
    return _yolo


def _get_ocr():
    global _ocr
    if _ocr is None:
        _ocr = easyocr.Reader(["ko", "en"], gpu=True, verbose=False)
    return _ocr


def _decode_image(base64_image: str) -> np.ndarray:
    _, data = base64_image.split(",", 1) if "," in base64_image else ("", base64_image)
    img_bytes = base64.b64decode(data)
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("이미지를 디코딩할 수 없어요")
    return img


def _resize(img: np.ndarray, max_size: int = 1024) -> np.ndarray:
    h, w = img.shape[:2]
    if max(h, w) > max_size:
        scale = max_size / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def _encode(img: np.ndarray) -> str:
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode()


def _sharpen(img: np.ndarray) -> np.ndarray:
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    return cv2.filter2D(img, -1, kernel)


def preprocess_image(base64_image: str) -> str:
    img = _decode_image(base64_image)
    img = _resize(img)
    img = _sharpen(img)
    return _encode(img)


def detect_objects(base64_image: str) -> list[str]:
    """YOLOv8으로 물체 형태 감지 → 클래스명 리스트"""
    img = _decode_image(base64_image)
    img = _resize(img)
    results = _get_yolo()(img, verbose=False)
    labels = []
    for r in results:
        for cls_id in r.boxes.cls.tolist():
            name = r.names[int(cls_id)]
            if name not in labels:
                labels.append(name)
    return labels


def extract_text(base64_image: str) -> list[str]:
    """EasyOCR로 전체 텍스트 추출"""
    img = _decode_image(base64_image)
    img = _resize(img)
    result = _get_ocr().readtext(img)
    return [text for _, text, conf in result if conf > 0.3]


def detect_recycle_mark(base64_image: str) -> dict:
    """
    재활용 마크 영역을 찾아 OCR로 재질 코드 인식.
    반환: { "material": "페트", "code": "PET", "texts": [...] }
    """
    img = _decode_image(base64_image)
    img = _resize(img)

    # 대비 향상 (마크 인식률 높이기)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    enhanced = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)

    # OCR 실행
    result = _get_ocr().readtext(enhanced)
    texts = [text.strip().upper() for _, text, conf in result if conf > 0.3 and text.strip()]

    raw_texts = [text.strip() for _, text, conf in result if conf > 0.3 and text.strip()]

    category = None
    material = None

    # 1순위: 대분류 한글 (비닐류/플라스틱/캔류 등 먼저 확정)
    CATEGORY_KEYS = ["무색페트","멸균팩","일반팩","종이팩","비닐류","캔류","페트","플라스틱","종이","유리","도포","첩합"]
    for text in raw_texts:
        for key in CATEGORY_KEYS:
            if key in text:
                val = RECYCLE_MARK_MAP.get(key)
                if val:
                    category, _ = val
                    break
        if category:
            break

    # 2순위: 세부 재질 코드 (영문)
    PRIORITY_CODES = ["바이오PET","바이오HDPE","바이오LDPE","바이오PP","바이오PS",
                      "PETE","HDPE","LDPE","PVC","PP","PS","PET","OTHER","AL","철","알미늄"]
    for text in raw_texts:
        for key in PRIORITY_CODES:
            if key.upper() in text.upper():
                val = RECYCLE_MARK_MAP.get(key)
                if val:
                    if not category:
                        category = val[0]
                    material = val[1]
                    break
        if material:
            break

    return {
        "category": category,
        "material": material,
        "texts": [t for t in raw_texts if t and "재활용" not in t],
    }
