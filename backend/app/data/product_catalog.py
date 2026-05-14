"""
FitID catalog: each SKU owns exactly one unique image URL (never reused globally).
Gap URLs in cards point to working Gap browse pages (no legacy /search error page).

Gap card photos use a fixed pool of Unsplash fashion stills (real clothing on models / flat lays).
This avoids loremflickr random tags (animals, unrelated scenes) while keeping stable, fast CDN URLs.
"""

from __future__ import annotations

import urllib.parse
from typing import Any

import numpy as np

CATEGORIES = ("tshirts", "shirts", "pants", "jackets", "hoodies", "formal")

_GAP_PIDS_VERIFIED = [
    56879188,
    56879190,
    56879191,
    56879192,
    56879193,
    56879194,
    56879195,
    56879196,
    56879197,
    56879199,
    56879200,
    56879201,
    56879202,
    56879204,
    56879205,
    56879206,
    56879207,
    56879208,
    56879209,
    56879210,
    56879211,
    56879212,
    56879213,
    56879214,
    56879215,
    56879216,
    56879217,
    56879218,
    56879219,
    56879220,
    56879221,
    56879222,
    56879223,
    56879224,
    56879225,
    56879226,
    56879227,
    56879228,
    56879229,
    56879230,
    56879232,
    56879233,
    56879234,
    56879235,
    56879236,
    56879237,
    56879238,
    56879240,
    56879241,
    56879242,
    56879243,
    56879244,
    56879245,
]

_LEVI_STYLES: list[tuple[str, str, str, str]] = [
    ("005010165", "501 Original Fit Jeans", "male", "pants"),
    ("125010384", "Ribcage Straight Ankle Jeans", "female", "pants"),
    ("196270010", "Type III Trucker Jacket", "male", "jackets"),
    ("295070438", "Ex-Boyfriend Trucker Jacket", "female", "jackets"),
    ("188850062", "511 Slim Jeans", "male", "pants"),
    ("726930002", "High Loose Jeans", "female", "pants"),
    ("726930011", "High Loose Taper Jeans", "female", "pants"),
    ("290370052", "502 Taper Jeans", "male", "pants"),
]

M_TEMPLATES = {
    "tshirts": ["Men's Classic Pocket Tee", "Men's Everyday Crewneck Tee", "Men's Garment Dyed Tee"],
    "shirts": ["Men's Oxford Shirt", "Men's Stretch Poplin Shirt", "Men's Casual Button-Down Shirt"],
    "pants": ["Men's Straight Chino", "Men's Slim Taper Chino", "Men's Athletic Taper Pants"],
    "jackets": ["Men's Utility Jacket", "Men's Lightweight Bomber Jacket", "Men's Field Jacket"],
    "hoodies": ["Men's Fleece Pullover Hoodie", "Men's Zip Hoodie", "Men's Oversized Logo Hoodie"],
    "formal": ["Men's Slim Blazer", "Men's Suit Jacket", "Men's Formal Dress Pants"],
}

W_TEMPLATES = {
    "tshirts": ["Women's Fitted Tee", "Women's Relaxed Everyday Tee", "Women's Lightweight Jersey Tee"],
    "shirts": ["Women's Poplin Shirt", "Women's Oversized Shirt", "Women's Linen Blend Shirt"],
    "pants": ["Women's High-Rise Straight Chino", "Women's Slim Ankle Pants", "Women's Wide-Leg Trouser"],
    "jackets": ["Women's Denim Trucker Jacket", "Women's Cropped Jacket", "Women's Utility Jacket"],
    "hoodies": ["Women's Crop Hoodie", "Women's Zip Hoodie", "Women's Fleece Pullover"],
    "formal": ["Women's Tailored Blazer", "Women's Suit Jacket", "Women's Formal Trousers"],
}


# Curated Unsplash IDs verified HTTP 200 — apparel/fashion; exactly one per Gap SKU (36).
_GAP_APPAREL_PHOTOS: tuple[str, ...] = (
    "photo-1521572163474-6864f9cf17ab",
    "photo-1618354691373-d851c5c3a990",
    "photo-1586790170083-2f9ceadc732d",
    "photo-1594938298603-c8148c4dae35",
    "photo-1607344645866-009c320b63e0",
    "photo-1516826957135-700dedea698c",
    "photo-1542272604-787c3835535d",
    "photo-1490481651871-ab68de25d43d",
    "photo-1551028719-00167b16eac5",
    "photo-1434389677669-e08b4cac3105",
    "photo-1591047139829-d91aecb6caea",
    "photo-1469334031218-e382a71b716b",
    "photo-1445205170230-053b83016050",
    "photo-1504198458649-3128b932f49e",
    "photo-1586363104862-3a5e2ab60d99",
    "photo-1571945153237-4929e783af4a",
    "photo-1525507119028-ed4c629a60a3",
    "photo-1552374196-c4e7ffc6e126",
    "photo-1507679799987-c73779587ccf",
    "photo-1556821840-3a63f95609a7",
    "photo-1562157873-818bc0726f68",
    "photo-1515886657613-9f3515b0c78f",
    "photo-1503341504253-dff4815485f1",
    "photo-1553062407-98eeb64c6a62",
    "photo-1558769132-cb1aea458c5e",
    "photo-1503341455253-b2e723bb3dbb",
    "photo-1558171813-4c088753af8f",
    "photo-1594633312681-425c7b97ccd1",
    "photo-1601925260368-ae2f83cf8b7f",
    "photo-1617137968427-85924c800a22",
    "photo-1539109136881-3be0616acf4b",
    "photo-1582555172866-f73bb12a2ab3",
    "photo-1529626455594-4ff0802cfb7e",
    "photo-1539533018447-63fcce2678e3",
    "photo-1595777457583-95e059d581b8",
    "photo-1603252109303-2751441dd157",
)


def _unsplash_fashion_url(photo_id_path: str) -> str:
    return f"https://images.unsplash.com/{photo_id_path}?auto=format&fit=crop&w=640&h=900&q=82"


def _gap_browse_url(gender: str, title: str) -> str:
    """Stable Gap category pages (avoid broken /search) + soft search hint."""
    if gender == "female":
        base = "https://www.gap.com/browse/women?cid=5643"
    else:
        base = "https://www.gap.com/browse/men?cid=5063"
    hint = title.replace("Men's ", "").replace("Women's ", "").strip()
    return f"{base}&searchText={urllib.parse.quote_plus(hint)}"


def _levis_browse_url(gender: str, category: str, title: str) -> str:
    """Stable Levi's category PLPs + soft search hint (same idea as Gap browse + searchText)."""
    hint = urllib.parse.quote_plus(title.replace("Men's ", "").replace("Women's ", "").strip())
    if category == "pants":
        if gender == "female":
            base = "https://www.levi.com/US/en_US/womens/jeans/c/levi_clothing_womens_jeans"
        else:
            base = "https://www.levi.com/US/en_US/mens/jeans/c/levi_clothing_mens_jeans"
    else:
        if gender == "female":
            base = "https://www.levi.com/US/en_US/womens/clothing/jackets/c/levi_clothing_womens_jackets"
        else:
            base = "https://www.levi.com/US/en_US/mens/clothing/jackets/c/levi_clothing_mens_jackets"
    return f"{base}?searchText={hint}"


def _levi_img(code: str) -> str:
    return (
        f"https://lsco.scene7.com/is/image/lsco/{code}-front-pdp"
        f"?fmt=jpeg&qlt=80,1&op_sharpen=0&resMode=sharp2&op_usm=0.9,1.0,8,0&fit=crop,0&wid=1200&hei=1500"
    )


def _silhouette_vec(fit: str) -> dict[str, float]:
    base = {"slim": 0.0, "regular": 0.0, "relaxed": 0.0, "oversized": 0.0}
    if fit in base:
        base[fit] = 1.0
    return base


def _centers_for_gender(gender: str, n: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    if gender == "male":
        return (
            np.linspace(76, 102, n),
            np.linspace(92, 118, n),
            np.linspace(76, 88, n),
        )
    return (
        np.linspace(64, 92, n),
        np.linspace(82, 108, n),
        np.linspace(71, 83, n),
    )


def build_catalog() -> list[dict[str, Any]]:
    fits_cycle = ("slim", "regular", "relaxed", "oversized")
    materials = ("Cotton", "Organic cotton", "French terry", "Denim", "Linen blend", "Wool blend", "Polyester blend")
    colors = ("Navy", "Black", "White", "Grey", "Blue", "Olive", "Beige")
    products: list[dict[str, Any]] = []
    used_image_urls: set[str] = set()
    gid = 0
    gap_photo_iter = iter(_GAP_APPAREL_PHOTOS)

    for gender in ("male", "female"):
        templates = M_TEMPLATES if gender == "male" else W_TEMPLATES
        waist_line, chest_line, inseam_line = _centers_for_gender(gender, 10)

        for cat in CATEGORIES:
            for variant in range(3):
                if gid >= len(_GAP_PIDS_VERIFIED):
                    raise RuntimeError("Not enough verified Gap asset IDs — extend _GAP_PIDS_VERIFIED.")

                pid = _GAP_PIDS_VERIFIED[gid]
                gid += 1

                title = templates[cat][variant]
                sku = f"GAP-{gender[0].upper()}-{cat}-v{variant}-{pid}"
                try:
                    photo_slot = next(gap_photo_iter)
                except StopIteration as exc:
                    raise RuntimeError("Extend _GAP_APPAREL_PHOTOS — not enough curated images for Gap SKUs.") from exc
                img = _unsplash_fashion_url(photo_slot)
                used_image_urls.add(img)

                fit = fits_cycle[(variant + sum(ord(c) for c in sku)) % 4]
                i = variant
                waist_c = float(waist_line[i])
                chest_c = float(chest_line[i])
                inseam_c = float(inseam_line[i])

                products.append(
                    {
                        "sku": sku,
                        "merchant": "gap",
                        "brand": "Gap",
                        "title": title,
                        "category": cat,
                        "gender": gender,
                        "material": materials[(i + gid) % len(materials)],
                        "fit_profile": fit,
                        "color": colors[(i + gid) % len(colors)],
                        "price_aed": int(89 + (variant * 19 + gid * 7) % 180),
                        "image_url": img,
                        "product_url": _gap_browse_url(gender, title),
                        "waist_center_cm": waist_c,
                        "waist_tolerance_cm": 7.5,
                        "chest_center_cm": chest_c,
                        "chest_tolerance_cm": 9.0,
                        "hip_center_cm": waist_c + (6.0 if gender == "female" else 4.0),
                        "hip_tolerance_cm": 8.0,
                        "inseam_ideal_cm": inseam_c,
                        "inseam_tolerance_cm": 5.0,
                        "shoulder_scale_target": 1.0 + (variant % 5) * 0.04 - 0.08,
                        "silhouette_vector": _silhouette_vec(fit),
                        "formality": 0.9 if cat == "formal" else 0.35 + (variant % 3) * 0.1,
                    }
                )

    for code, title, gender, cat in _LEVI_STYLES:
        img = _levi_img(code)
        if img in used_image_urls:
            continue
        used_image_urls.add(img)
        waist_line, chest_line, inseam_line = _centers_for_gender(gender, 10)
        sku = f"LEVIS-{code}-{gender}"
        fit = fits_cycle[sum(ord(c) for c in code) % 4]

        products.append(
            {
                "sku": sku,
                "merchant": "levis",
                "brand": "Levi's",
                "title": title,
                "category": cat,
                "gender": gender,
                "material": "Denim",
                "fit_profile": fit,
                "color": colors[sum(ord(c) for c in code) % len(colors)],
                "price_aed": int(329 + (sum(ord(c) for c in code) % 120)),
                "image_url": img,
                "product_url": _levis_browse_url(gender, cat, title),
                "waist_center_cm": float(waist_line[3]),
                "waist_tolerance_cm": 8.0,
                "chest_center_cm": float(chest_line[3]),
                "chest_tolerance_cm": 10.0,
                "hip_center_cm": float(waist_line[3]) + (5.5 if gender == "female" else 3.5),
                "hip_tolerance_cm": 8.5,
                "inseam_ideal_cm": float(inseam_line[3]),
                "inseam_tolerance_cm": 5.5,
                "shoulder_scale_target": 1.02,
                "silhouette_vector": _silhouette_vec(fit),
                "formality": 0.35 if cat == "jackets" else 0.25,
            }
        )

    return products


CATALOG: list[dict[str, Any]] = build_catalog()
