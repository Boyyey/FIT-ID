import cv2
import numpy as np

from app.db.schemas import ScanInput


def process_quick_scan(scan: ScanInput) -> dict:
    chest_estimate = round(scan.shoulder_width_cm * 2.2, 1)
    torso_len = round(float(scan.height_cm) * 0.31, 1)
    avatar_model = {
        "model_type": "parametric-v1",
        "height_cm": float(scan.height_cm),
        "weight_kg": float(scan.weight_kg),
        "scale": {
            "shoulders": round(float(scan.shoulder_width_cm) / 44.0, 2),
            "torso": round(torso_len / 55.0, 2),
            "hips": round(float(scan.hip_cm) / 95.0, 2),
        },
    }
    body_data = {
        "height_cm": scan.height_cm,
        "weight_kg": scan.weight_kg,
        "shoulder_width_cm": scan.shoulder_width_cm,
        "chest_cm": chest_estimate,
        "waist_cm": scan.waist_cm,
        "hip_cm": scan.hip_cm,
        "inseam_cm": scan.inseam_cm,
        "torso_length_cm": torso_len,
        "avatar_model": avatar_model,
    }
    return {
        "body_measurements": body_data,
        "posture": scan.posture_hint,
        "skin_tone": scan.skin_tone_hint,
        "confidence_score": 0.78,
    }


def _clamp(v: float, lo: float, hi: float) -> float:
    return float(max(lo, min(hi, v)))


def _ellipse_circumference(a: float, b: float) -> float:
    """
    Ramanujan approximation for ellipse circumference.
    a,b are semi-axes (cm).
    """
    a = max(0.1, float(a))
    b = max(0.1, float(b))
    import math

    h = ((a - b) ** 2) / ((a + b) ** 2)
    return math.pi * (a + b) * (1.0 + (3.0 * h) / (10.0 + math.sqrt(4.0 - 3.0 * h)))


def process_live_scan(front_image_bytes: bytes, side_image_bytes: bytes, height_cm: float, weight_kg: float) -> dict:
    front_image = _decode_image(front_image_bytes)
    side_image = _decode_image(side_image_bytes)
    front_bbox = _body_bbox(front_image)
    side_bbox = _body_bbox(side_image)

    if front_bbox is None or side_bbox is None:
        raise ValueError("Could not detect body silhouette in one or more scan images.")

    # Build silhouette masks so measurements come from body spans, not bbox heuristics.
    f_mask, f_box = _silhouette_mask(front_image)
    s_mask, s_box = _silhouette_mask(side_image)
    if f_mask is None or s_mask is None:
        raise ValueError("Could not isolate silhouette. Use a plain background and retry.")

    fx, fy, fw, fh = f_box
    sx, sy, sw, sh = s_box

    # px->cm scale from height, averaged between views to reduce bias.
    body_height_px = max(1.0, float(0.55 * fh + 0.45 * sh))
    cm_per_px = float(height_cm) / body_height_px

    def _span_at(mask: np.ndarray, box: tuple[int, int, int, int], rel_y: float) -> float:
        x0, y0, bw, bh = box
        yy = int(y0 + _clamp(rel_y, 0.05, 0.95) * bh)
        # sample a small vertical window and take median span
        win = max(3, int(0.015 * bh))
        spans: list[int] = []
        h_img, w_img = mask.shape[:2]
        for y in range(max(0, yy - win), min(h_img - 1, yy + win) + 1):
            row = mask[y, x0 : x0 + bw]
            xs = np.where(row > 0)[0]
            if xs.size < max(12, int(0.06 * bw)):
                continue
            spans.append(int(xs.max() - xs.min() + 1))
        if not spans:
            return float(bw) * 0.3
        return float(np.median(spans))

    # Key levels inside the silhouette bbox.
    shoulder_w_px = _span_at(f_mask, f_box, 0.18)
    chest_w_px = _span_at(f_mask, f_box, 0.28)
    waist_w_px = _span_at(f_mask, f_box, 0.46)
    hip_w_px = _span_at(f_mask, f_box, 0.58)

    chest_d_px = _span_at(s_mask, s_box, 0.28)
    waist_d_px = _span_at(s_mask, s_box, 0.46)
    hip_d_px = _span_at(s_mask, s_box, 0.58)

    shoulder_width_cm = shoulder_w_px * cm_per_px
    torso_length_cm = (fh * 0.31) * cm_per_px
    inseam_cm = float(height_cm) * 0.45

    # Convert to ellipse circumference at each region.
    chest_cm = _ellipse_circumference((chest_w_px * cm_per_px) / 2.0, (chest_d_px * cm_per_px) / 2.0)
    waist_cm = _ellipse_circumference((waist_w_px * cm_per_px) / 2.0, (waist_d_px * cm_per_px) / 2.0)
    hip_cm = _ellipse_circumference((hip_w_px * cm_per_px) / 2.0, (hip_d_px * cm_per_px) / 2.0)

    # Safety clamps: keep outputs plausible for adult bodies, scaled by height.
    h = float(height_cm)
    shoulder_width_cm = _clamp(shoulder_width_cm, 32.0, 60.0)
    torso_length_cm = _clamp(torso_length_cm, 42.0, 72.0)
    inseam_cm = _clamp(inseam_cm, 58.0, 112.0)

    # Circumference bounds scale with height (prevents 300cm+ nonsense).
    chest_cm = _clamp(chest_cm, 0.43 * h, 0.78 * h)
    waist_cm = _clamp(waist_cm, 0.34 * h, 0.72 * h)
    hip_cm = _clamp(hip_cm, 0.42 * h, 0.82 * h)

    # Mild stabilization using weight: heavier implies larger girths (small adjustment only).
    wkg = float(weight_kg)
    bmi = wkg / max(1e-6, (h / 100.0) ** 2)
    adj = _clamp((bmi - 23.0) / 80.0, -0.04, 0.08)
    chest_cm *= 1.0 + adj
    waist_cm *= 1.0 + adj * 1.15
    hip_cm *= 1.0 + adj * 0.9

    shoulder_width_cm = round(float(shoulder_width_cm), 1)
    torso_length_cm = round(float(torso_length_cm), 1)
    inseam_cm = round(float(inseam_cm), 1)
    chest_cm = round(float(chest_cm), 1)
    waist_cm = round(float(waist_cm), 1)
    hip_cm = round(float(hip_cm), 1)

    skin_tone_hex = _estimate_skin_tone_hex(front_image)
    posture = _estimate_posture(front_bbox, side_bbox)

    avatar_model = {
        "model_type": "parametric-v1",
        "height_cm": height_cm,
        "weight_kg": weight_kg,
        "scale": {
            "shoulders": round(shoulder_width_cm / 44.0, 2),
            "torso": round(torso_length_cm / 55.0, 2),
            "hips": round((hip_cm / (2 * 3.14159)) / 38.0, 2),
        },
    }

    return {
        "body_measurements": {
            "height_cm": height_cm,
            "weight_kg": weight_kg,
            "shoulder_width_cm": shoulder_width_cm,
            "chest_cm": chest_cm,
            "waist_cm": waist_cm,
            "hip_cm": hip_cm,
            "inseam_cm": inseam_cm,
            "torso_length_cm": torso_length_cm,
            "avatar_model": avatar_model,
        },
        "posture": posture,
        "skin_tone": skin_tone_hex,
        "confidence_score": 0.88,
    }


def _silhouette_mask(image: np.ndarray) -> tuple[np.ndarray | None, tuple[int, int, int, int]]:
    """
    Return a cleaned silhouette mask (uint8 0/255) and its bbox.
    Uses Otsu + largest contour, then closes holes.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (7, 7), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if np.mean(thresh) > 127:
        thresh = cv2.bitwise_not(thresh)
    kernel = np.ones((7, 7), np.uint8)
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None, (0, 0, image.shape[1], image.shape[0])
    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) < 5000:
        return None, (0, 0, image.shape[1], image.shape[0])
    x, y, w, h = cv2.boundingRect(largest)
    mask = np.zeros_like(cleaned)
    cv2.drawContours(mask, [largest], -1, 255, thickness=-1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    return mask, (x, y, w, h)


def _decode_image(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Invalid scan image provided.")
    return image


def _body_bbox(image: np.ndarray) -> tuple[int, int, int, int] | None:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (7, 7), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Ensure human body (dark on light or vice versa) is foreground.
    if np.mean(thresh) > 127:
        thresh = cv2.bitwise_not(thresh)
    kernel = np.ones((7, 7), np.uint8)
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) < 5000:
        return None
    x, y, w, h = cv2.boundingRect(largest)
    return (x, y, w, h)


def _estimate_skin_tone_hex(image: np.ndarray) -> str:
    h, w = image.shape[:2]
    crop = image[int(h * 0.2) : int(h * 0.42), int(w * 0.35) : int(w * 0.65)]
    if crop.size == 0:
        crop = image
    avg_bgr = np.mean(crop.reshape(-1, 3), axis=0)
    b, g, r = [int(np.clip(v, 0, 255)) for v in avg_bgr]
    return f"#{r:02X}{g:02X}{b:02X}"


def _estimate_posture(front_bbox: tuple[int, int, int, int], side_bbox: tuple[int, int, int, int]) -> str:
    _, _, fw, fh = front_bbox
    _, _, sw, sh = side_bbox
    width_ratio = (sw / sh) if sh else 0.0
    if width_ratio > 0.43:
        return "forward_head"
    if fw / fh < 0.24:
        return "slouched"
    return "neutral"
