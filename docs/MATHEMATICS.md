# FitID Mathematical Foundations

This document explains the mathematical principles and algorithms used throughout the FitID application.

---

## Table of Contents

1. [Body Measurement Extraction](#1-body-measurement-extraction)
2. [Avatar Model Generation](#2-avatar-model-generation)
3. [Recommendation Scoring](#3-recommendation-scoring)
4. [Size Recommendation](#4-size-recommendation)
5. [Image Processing](#5-image-processing)
6. [Statistical Analysis](#6-statistical-analysis)

---

## 1. Body Measurement Extraction

### 1.1 Pixel-to-Real-World Scale

The fundamental challenge: converting pixel measurements to centimeters without a reference object.

**Formula**:
```
cm_per_px = height_cm / body_height_px
```

Where:
- `height_cm`: User-provided actual height
- `body_height_px`: Pixel height of detected body in image

**Implementation Details**:
```python
body_height_px = max(1.0, 0.55 * front_height_px + 0.45 * side_height_px)
cm_per_px = height_cm / body_height_px
```

The weighted average (0.55 front, 0.45 side) reduces bias from posture variations between views.

### 1.2 Measurement Points (Anatomical Landmarks)

Measurements are taken at specific relative heights within the silhouette:

| Measurement | Relative Y Position | Description |
|-------------|---------------------|-------------|
| Shoulders | 0.18 (18% from top) | Shoulder width |
| Chest | 0.28 (28% from top) | Chest circumference |
| Waist | 0.46 (46% from top) | Waist circumference |
| Hip | 0.58 (58% from top) | Hip circumference |

These percentages are derived from standard anthropometric proportions for adult human bodies.

### 1.3 Ellipse Circumference Approximation

The body cross-section at any point is approximated as an ellipse.

**Ramanujan Approximation** (used in `services/scan.py`):
```
C ≈ π(a + b) × [1 + (3h)/(10 + √(4 - 3h))]

where:
- a = semi-major axis (half of width measurement)
- b = semi-minor axis (half of depth measurement)
- h = (a - b)² / (a + b)²
```

**Why this matters**:
- Front view gives us width (major axis)
- Side view gives us depth (minor axis)
- Ellipse circumference approximates the actual body girth

**Code Implementation**:
```python
def _ellipse_circumference(a: float, b: float) -> float:
    a = max(0.1, float(a))  # Prevent division by zero
    b = max(0.1, float(b))
    
    h = ((a - b) ** 2) / ((a + b) ** 2)
    return math.pi * (a + b) * (1.0 + (3.0 * h) / (10.0 + math.sqrt(4.0 - 3.0 * h)))
```

### 1.4 Span Measurement Algorithm

At each measurement level, we calculate the body span:

```python
def _span_at(mask, box, rel_y):
    x0, y0, bw, bh = box
    yy = y0 + clamp(rel_y, 0.05, 0.95) * bh  # Target row
    
    # Sample window around target (robust to noise)
    win = max(3, int(0.015 * bh))
    spans = []
    
    for y in range(yy - win, yy + win + 1):
        row = mask[y, x0:x0 + bw]
        xs = np.where(row > 0)[0]  # Find non-zero pixels
        if len(xs) >= threshold:   # Sufficient body detected
            spans.append(xs.max() - xs.min() + 1)
    
    return median(spans) if spans else default_value
```

**Key mathematical choices**:
- **Median filtering**: Robust to outliers (noise, shadows)
- **Vertical window**: Accounts for body curvature over small height ranges
- **Minimum threshold**: Filters out spurious detections

### 1.5 Plausibility Clamping

Measurements are constrained to biologically plausible ranges, scaled by height:

```python
# Bounds as fractions of height
CHEST_MIN = 0.43 * height
cHEST_MAX = 0.78 * height
WAIST_MIN = 0.34 * height
WAIST_MAX = 0.72 * height
HIP_MIN = 0.42 * height
HIP_MAX = 0.82 * height

# Absolute bounds for other measurements
SHOULDER_MIN, SHOULDER_MAX = 32.0, 60.0  # cm
TORSO_MIN, TORSO_MAX = 42.0, 72.0        # cm
INSEAM_MIN, INSEAM_MAX = 58.0, 112.0     # cm
```

### 1.6 BMI-Based Adjustment

Weight provides additional signal for body composition:

```python
BMI = weight_kg / (height_m)²
adjustment = clamp((BMI - 23.0) / 80.0, -0.04, 0.08)

# Apply proportional adjustments
chest *= 1.0 + adjustment
waist *= 1.0 + adjustment * 1.15  # Waist more affected by weight
hip *= 1.0 + adjustment * 0.9
```

**Rationale**:
- Normal BMI ≈ 23
- Positive adjustment for above-average BMI (larger girths)
- Negative adjustment for below-average BMI
- Waist is most weight-sensitive (hence 1.15x multiplier)

---

## 2. Avatar Model Generation

### 2.1 Parametric Scaling

The 3D avatar uses normalized scale factors derived from measurements:

```python
avatar_model = {
    "model_type": "parametric-v1",
    "height_cm": height_cm,
    "weight_kg": weight_kg,
    "scale": {
        "shoulders": round(shoulder_width_cm / 44.0, 2),
        "torso": round(torso_length_cm / 55.0, 2),
        "hips": round((hip_cm / (2 * π)) / 38.0, 2),
    }
}
```

**Reference Values**:
| Dimension | Reference | Typical Range |
|-----------|-----------|---------------|
| Shoulders | 44 cm | 0.7 - 1.4 (scale) |
| Torso | 55 cm | 0.8 - 1.3 (scale) |
| Hips | 38 cm radius | 0.6 - 1.5 (scale) |

### 2.2 Quick Scan Estimates

For manual input (no images), measurements are estimated from provided values:

```python
chest_estimate = shoulder_width_cm × 2.2
torso_length = height_cm × 0.31
inseam = height_cm × 0.45  # Standard leg proportion
```

---

## 3. Recommendation Scoring

### 3.1 Composite Score Formula

The recommendation engine calculates a fit score (0-100) for each product:

```
Score = 60 + Fit_Bonus + Material_Penalty

Where:
- Base_Score = 60 (represents "likely to fit")
- Fit_Bonus = 15 if preferred_fit in product.fit_tags else 5
- Material_Penalty = -25 if any blocked_material in product.material_tags else 0

Final_Score = clamp(Score, 0, 100)
```

### 3.2 Component Breakdown

**Fit Preference Matching**:
```python
fit_preferences = {
    "silhouette": "regular"  # or "slim", "oversized", "fitted"
}

fit_bonus = 15 if preferred_fit in product.fit_tags else 5
```

**Material Allergy Check**:
```python
blocked_materials = set(material.lower() for material in profile.allergies)
product_materials = set(tag.lower() for tag in product.material_tags)

material_penalty = -25 if blocked_materials ∩ product_materials ≠ ∅ else 0
```

### 3.3 Scoring Examples

| Scenario | Fit Bonus | Material Penalty | Final Score | Reason |
|----------|-----------|------------------|-------------|--------|
| Matches preference, no conflicts | +15 | 0 | 75 | "Matches profile fit preference" |
| Neutral fit, no conflicts | +5 | 0 | 65 | "General fit compatibility" |
| Matches preference, has allergen | +15 | -25 | 50 | "Reduced score due to allergy-sensitive materials" |
| Neutral fit, has allergen | +5 | -25 | 40 | "Reduced score due to allergy-sensitive materials" |

---

## 4. Size Recommendation

### 4.1 Size Mapping Algorithm

Size is determined primarily from waist circumference:

```python
def _size_from_measurements(waist_cm: float) -> str:
    if waist_cm < 72:
        return "XS"
    if waist_cm < 80:
        return "S"
    if waist_cm < 92:
        return "M"
    if waist_cm < 104:
        return "L"
    return "XL"
```

**Size Thresholds**:
| Size | Waist Range (cm) | Approximate (inches) |
|------|------------------|---------------------|
| XS | < 72 | < 28" |
| S | 72 - 80 | 28" - 31" |
| M | 80 - 92 | 31" - 36" |
| L | 92 - 104 | 36" - 41" |
| XL | ≥ 104 | ≥ 41" |

### 4.2 Size Label Variations

The system can be extended to support:
- Numeric sizes (0, 2, 4, 6...)
- Alpha-numeric (S-Tall, M-Petite)
- Brand-specific sizing
- Regional standards (US, UK, EU, JP)

---

## 5. Image Processing

### 5.1 Otsu's Thresholding

Used for automatic foreground/background separation:

```python
# Convert to grayscale
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

# Apply Gaussian blur to reduce noise
blur = cv2.GaussianBlur(gray, (7, 7), 0)

# Otsu's automatic thresholding
_, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
```

**Mathematical Basis**:
Otsu's method minimizes intra-class variance:
```
σ²_w(t) = ω₀(t)σ²₀(t) + ω₁(t)σ²₁(t)

Where:
- ω₀, ω₁: Class probabilities
- σ²₀, σ²₁: Class variances
- t: Threshold being tested
```

### 5.2 Morphological Operations

Cleaning the silhouette mask:

```python
kernel = np.ones((7, 7), np.uint8)

# Close small holes and gaps
cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
```

**Closing Operation**:
```
Closing = Dilation followed by Erosion
```

Fills small holes and connects nearby regions while preserving overall shape.

### 5.3 Contour Detection and Filtering

Finding the body silhouette:

```python
contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
largest_contour = max(contours, key=cv2.contourArea)

# Minimum area threshold (filters noise)
MIN_CONTOUR_AREA = 5000  # pixels
```

### 5.4 Skin Tone Extraction

Average color from the neck/upper chest region:

```python
def _estimate_skin_tone_hex(image):
    h, w = image.shape[:2]
    
    # Crop neck/chest region (empirically determined ROI)
    y_start = int(h * 0.20)
    y_end = int(h * 0.42)
    x_start = int(w * 0.35)
    x_end = int(w * 0.65)
    
    crop = image[y_start:y_end, x_start:x_end]
    avg_bgr = np.mean(crop.reshape(-1, 3), axis=0)
    
    b, g, r = [int(clamp(v, 0, 255)) for v in avg_bgr]
    return f"#{r:02X}{g:02X}{b:02X}"
```

### 5.5 Posture Estimation

Simple posture detection from bounding box ratios:

```python
def _estimate_posture(front_bbox, side_bbox):
    _, _, fw, fh = front_bbox
    _, _, sw, sh = side_bbox
    
    width_ratio = sw / sh  # Side view width-to-height
    
    if width_ratio > 0.43:
        return "forward_head"  # Head protruding forward
    if fw / fh < 0.24:
        return "slouched"      # Shoulders hunched, narrow front
    return "neutral"
```

**Reference Ratios**:
- Normal side width/height ≈ 0.35-0.40
- Normal front width/height ≈ 0.28-0.32

---

## 6. Statistical Analysis

### 6.1 Business Insights Calculations

The business dashboard provides aggregate statistics:

**KPIs**:
```python
kpis = {
    "total_profiles": count(FitProfile),
    "avg_confidence": mean(profile.confidence_score),
    "opt_in_rate": count(PartnerConsent) / count(FitProfile) * 100,
}
```

**Size Demand Index**:
```python
# Calculate size distribution
counts = {
    "XS": count(where waist < 72),
    "S": count(where 72 ≤ waist < 80),
    "M": count(where 80 ≤ waist < 92),
    "L": count(where 92 ≤ waist < 104),
    "XL": count(where waist ≥ 104),
}

# Index relative to uniform distribution
total = sum(counts.values())
uniform_share = total / 5  # Expected if evenly distributed

index = {
    size: (count / uniform_share) * 100 
    for size, count in counts.items()
}
```

An index of 100 = average demand, 150 = 50% above average, etc.

**Chest-Waist Clustering**:
```python
# Simple heuristic clustering
chest = profile.measurements["chest_cm"]
waist = profile.measurements["waist_cm"]
ratio = chest / waist

if ratio > 1.15:
    cluster = "Athletic (V-taper)"
elif ratio < 0.95:
    cluster = "Fuller midsection"
else:
    cluster = "Balanced proportions"
```

### 6.2 Confidence Score Calculation

Current implementation uses fixed confidence levels:

```python
# Quick scan (manual measurements)
confidence_score = 0.78

# Live scan (computer vision)
confidence_score = 0.88
```

**Future Enhancement**:
```python
def calculate_confidence(scan_result):
    factors = {
        "image_quality": measure_sharpness(images),
        "silhouette_clarity": contour_confidence(mask),
        "measurement_variance": std_dev(across_frames),
        "user_input_reliability": validate_self_reported(height, weight),
    }
    
    # Weighted combination
    return weighted_average(factors, weights)
```

---

## 7. Constants and Reference Values

### 7.1 Anthropometric References

| Measurement | Male Reference | Female Reference |
|-------------|---------------|------------------|
| Shoulder Width | 44 cm | 40 cm |
| Chest | 96 cm | 88 cm |
| Waist | 84 cm | 70 cm |
| Hip | 98 cm | 96 cm |
| Torso Length | 55 cm | 50 cm |
| Inseam | 80 cm | 76 cm |

### 7.2 Proportional Relationships

```
Torso Length ≈ 0.31 × Height
Inseam ≈ 0.45 × Height
Arm Span ≈ 1.01 × Height (wingspan)
Head Height ≈ 0.13 × Height
```

### 7.3 BMI Categories

| Category | BMI Range |
|----------|-----------|
| Underweight | < 18.5 |
| Normal | 18.5 - 24.9 |
| Overweight | 25.0 - 29.9 |
| Obese | ≥ 30.0 |

---

## 8. Future Mathematical Enhancements

### 8.1 Machine Learning Recommendations

Transition from rule-based to learned scoring:

```python
# Current: Rule-based
score = 60 + fit_bonus + material_penalty

# Future: Learned
features = [height, weight, waist, chest, hip, ...]
score = model.predict(features, product_attributes)
```

### 8.2 3D Mesh Fitting

```python
# Parametric model to 3D mesh
def generate_mesh(measurements):
    base_mesh = load_template_mesh()
    
    # Apply morph targets based on measurements
    for target, value in measurements.items():
        base_mesh.apply_morph(target, value / reference[target])
    
    return base_mesh
```

### 8.3 Gaussian Process Regression

For uncertainty quantification in measurements:

```python
# Model measurement uncertainty
mean, variance = gp_regressor.predict(new_scan)
confidence_interval = [mean - 2σ, mean + 2σ]
```

---

## References

1. **Ramanujan, S.** (1914). "Modular Equations and Approximations to π". *Quarterly Journal of Mathematics*.
2. **Otsu, N.** (1979). "A Threshold Selection Method from Gray-Level Histograms". *IEEE Transactions on Systems, Man, and Cybernetics*.
3. **ISO 7250**: Basic human body measurements for technological design.
4. **ANSI/ASTM D6240**: Standard tables of body measurements.

---

*For implementation details, see `backend/app/services/scan.py` and `backend/app/services/recommendation.py`*
