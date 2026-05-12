import base64
import numpy as np
import cv2


def preprocess_image(base64_image: str) -> str:
    """base64 이미지를 OpenCV로 전처리 후 다시 base64로 반환"""
    # base64 디코딩
    header, data = base64_image.split(",", 1) if "," in base64_image else ("", base64_image)
    img_bytes = base64.b64decode(data)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("이미지를 디코딩할 수 없어요")

    # 최대 크기 제한 (1024px)
    h, w = img.shape[:2]
    max_size = 1024
    if max(h, w) > max_size:
        scale = max_size / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    # 선명도 향상
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    img = cv2.filter2D(img, -1, kernel)

    # 다시 base64 인코딩
    _, buffer = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    encoded = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/jpeg;base64,{encoded}"
