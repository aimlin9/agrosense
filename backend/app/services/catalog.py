"""Human-friendly names and offline fallback advice for the 38 model classes.

The database stores PlantVillage-style names ("Corn (maize)", "Pepper, bell",
"Corn (maize) Cercospora leaf spot Gray leaf spot"). Everything user-facing
goes through these helpers so farmers see "Maize" and "Gray leaf spot".

Fallback advice is used when Gemini is unavailable or slow, so a diagnosis
never comes back empty. It is deliberately conservative and points to an
extension officer before anything chemical.
"""

CROP_DISPLAY = {
    "Corn (maize)": "Maize",
    "Pepper, bell": "Bell pepper",
    "Cherry (including sour)": "Cherry",
}


def crop_display_name(name: str | None) -> str | None:
    if name is None:
        return None
    return CROP_DISPLAY.get(name, name)


# class_name -> (disease name, pathogen type)
# pathogen types: fungal | bacterial | viral | pest | oomycete | healthy
CLASS_INFO: dict[str, tuple[str, str]] = {
    "Apple___Apple_scab": ("Apple scab", "fungal"),
    "Apple___Black_rot": ("Black rot", "fungal"),
    "Apple___Cedar_apple_rust": ("Cedar apple rust", "fungal"),
    "Apple___healthy": ("Healthy", "healthy"),
    "Blueberry___healthy": ("Healthy", "healthy"),
    "Cherry_(including_sour)___Powdery_mildew": ("Powdery mildew", "fungal"),
    "Cherry_(including_sour)___healthy": ("Healthy", "healthy"),
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": ("Gray leaf spot", "fungal"),
    "Corn_(maize)___Common_rust_": ("Common rust", "fungal"),
    "Corn_(maize)___Northern_Leaf_Blight": ("Northern leaf blight", "fungal"),
    "Corn_(maize)___healthy": ("Healthy", "healthy"),
    "Grape___Black_rot": ("Black rot", "fungal"),
    "Grape___Esca_(Black_Measles)": ("Esca (black measles)", "fungal"),
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": ("Leaf blight", "fungal"),
    "Grape___healthy": ("Healthy", "healthy"),
    "Orange___Haunglongbing_(Citrus_greening)": ("Citrus greening", "bacterial"),
    "Peach___Bacterial_spot": ("Bacterial spot", "bacterial"),
    "Peach___healthy": ("Healthy", "healthy"),
    "Pepper,_bell___Bacterial_spot": ("Bacterial spot", "bacterial"),
    "Pepper,_bell___healthy": ("Healthy", "healthy"),
    "Potato___Early_blight": ("Early blight", "fungal"),
    "Potato___Late_blight": ("Late blight", "oomycete"),
    "Potato___healthy": ("Healthy", "healthy"),
    "Raspberry___healthy": ("Healthy", "healthy"),
    "Soybean___healthy": ("Healthy", "healthy"),
    "Squash___Powdery_mildew": ("Powdery mildew", "fungal"),
    "Strawberry___Leaf_scorch": ("Leaf scorch", "fungal"),
    "Strawberry___healthy": ("Healthy", "healthy"),
    "Tomato___Bacterial_spot": ("Bacterial spot", "bacterial"),
    "Tomato___Early_blight": ("Early blight", "fungal"),
    "Tomato___Late_blight": ("Late blight", "oomycete"),
    "Tomato___Leaf_Mold": ("Leaf mold", "fungal"),
    "Tomato___Septoria_leaf_spot": ("Septoria leaf spot", "fungal"),
    "Tomato___Spider_mites Two-spotted_spider_mite": ("Spider mites", "pest"),
    "Tomato___Target_Spot": ("Target spot", "fungal"),
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": ("Yellow leaf curl virus", "viral"),
    "Tomato___Tomato_mosaic_virus": ("Mosaic virus", "viral"),
    "Tomato___healthy": ("Healthy", "healthy"),
}

_SEVERE = {
    "Potato___Late_blight",
    "Tomato___Late_blight",
    "Orange___Haunglongbing_(Citrus_greening)",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
}


def is_healthy_class(class_name: str) -> bool:
    return "healthy" in class_name.lower()


def disease_display_name(class_name: str) -> str:
    """'Tomato___Late_blight' -> 'Late blight'; any healthy class -> 'Healthy'.

    The crop is always shown alongside, so repeating it here is noise.
    """
    info = CLASS_INFO.get(class_name)
    if info:
        return info[0]
    _, _, disease = class_name.partition("___")
    return disease.replace("_", " ").strip().capitalize() or class_name


_BY_TYPE = {
    "fungal": {
        "summary": "This looks like a fungal leaf disease. Fungi spread through spores carried by wind, rain splash and tools, and thrive when leaves stay wet.",
        "immediate_actions": [
            "Remove and burn or bury the worst-affected leaves. Do not compost them.",
            "Water at the base of the plant in the morning so leaves dry quickly.",
            "Wash hands and tools after touching sick plants.",
        ],
        "organic_treatment": "Spray neem oil, or a baking-soda solution (1 tablespoon per 4 litres of water with a little liquid soap), every 7 days.",
        "chemical_treatment": "A copper- or mancozeb-based fungicide (for example Kocide or Dithane M-45) from a certified agro-input dealer. Follow the label and wear protection.",
        "prevention": "Space plants for airflow, rotate crops each season, and clear crop debris after harvest.",
    },
    "oomycete": {
        "summary": "This looks like late blight, a fast-moving water-mould disease. In wet, cool weather it can destroy a field within days, so act now.",
        "immediate_actions": [
            "Pull out and destroy badly infected plants today. Burn or bury them.",
            "Do not work in the field while plants are wet.",
            "Check neighbouring plants every day for dark, water-soaked spots.",
        ],
        "organic_treatment": "Copper-based sprays are accepted in organic farming. Apply before rain and repeat every 5 to 7 days in wet weather.",
        "chemical_treatment": "A systemic fungicide such as Ridomil Gold (metalaxyl + mancozeb). Ask an extension officer about rotating products to avoid resistance.",
        "prevention": "Use certified disease-free seedlings, stake plants off the ground, and never plant tomato and potato side by side.",
    },
    "bacterial": {
        "summary": "This looks like a bacterial disease. Bacteria enter through wounds and spread by splashing water, hands and tools. Infected tissue cannot be cured, so focus on stopping the spread.",
        "immediate_actions": [
            "Remove infected leaves or fruit and destroy them away from the field.",
            "Avoid overhead watering and do not handle plants when wet.",
            "Disinfect tools with a bleach solution between plants.",
        ],
        "organic_treatment": "Copper sprays slow the spread on new growth. Apply every 7 to 10 days during wet periods.",
        "chemical_treatment": "Copper hydroxide (for example Kocide 2000). Antibiotics are not recommended for farm use.",
        "prevention": "Use clean seed, keep the same crop family off that land for 2 to 3 seasons, and control weeds that host the bacteria.",
    },
    "viral": {
        "summary": "This looks like a viral disease. Viruses are carried by insects such as whiteflies and aphids, or by hands and tools. Infected plants cannot be cured.",
        "immediate_actions": [
            "Uproot and destroy infected plants to protect the rest of the field.",
            "Control whiteflies and aphids. Check the underside of leaves.",
            "Wash hands with soap after handling sick plants.",
        ],
        "organic_treatment": "Yellow sticky traps and neem-based sprays reduce the insects that carry the virus.",
        "chemical_treatment": "There is no chemical cure for the virus itself. An extension officer can recommend an insecticide if whitefly numbers are high.",
        "prevention": "Plant resistant varieties, raise seedlings under insect-proof netting, and remove weeds around the field.",
    },
    "pest": {
        "summary": "This looks like spider mite damage. Mites are tiny pests that suck sap from the underside of leaves and multiply fast in hot, dry weather.",
        "immediate_actions": [
            "Spray the underside of leaves with a strong jet of clean water.",
            "Remove heavily infested leaves.",
            "Keep the soil moist. Mites thrive in dusty, dry conditions.",
        ],
        "organic_treatment": "Neem oil or insecticidal soap sprayed under the leaves every 5 to 7 days.",
        "chemical_treatment": "A registered miticide such as abamectin. Rotate products to prevent resistance.",
        "prevention": "Avoid water stress, control weeds, and avoid broad-spectrum insecticides that kill the mites' natural enemies.",
    },
    "healthy": {
        "summary": "Good news: this plant looks healthy. Keep checking regularly so you catch any problem early.",
        "immediate_actions": [
            "Inspect both sides of the leaves once or twice a week.",
            "Water consistently and early in the day.",
            "Keep the field free of weeds and old crop debris.",
        ],
        "organic_treatment": None,
        "chemical_treatment": None,
        "prevention": "Rotate crops each season and use certified seed to keep your field disease-free.",
    },
}

LOW_CONFIDENCE_THRESHOLD = 0.6


def fallback_advice(class_name: str, confidence: float) -> dict:
    """Curated advice used when the LLM isn't available."""
    ptype = CLASS_INFO.get(class_name, ("", "fungal"))[1]
    base = dict(_BY_TYPE.get(ptype, _BY_TYPE["fungal"]))
    base["immediate_actions"] = list(base["immediate_actions"])
    if ptype == "healthy":
        base["severity"] = "none"
    elif class_name in _SEVERE:
        base["severity"] = "high"
    else:
        base["severity"] = "moderate"
    if confidence < LOW_CONFIDENCE_THRESHOLD and ptype != "healthy":
        base["immediate_actions"].insert(
            0,
            "The AI is not sure about this result. Take a second photo in good light and show an extension officer before spraying.",
        )
    return base


def normalize_advice(raw: dict | None, class_name: str, confidence: float) -> dict:
    """Coerce whatever the LLM returned into the TreatmentAdvice shape.

    Missing or malformed fields are filled from the curated fallback so the
    response model never fails validation.
    """
    fb = fallback_advice(class_name, confidence)
    if not isinstance(raw, dict):
        return fb

    def text(key: str) -> str | None:
        v = raw.get(key)
        if v is None or (isinstance(v, str) and v.strip().lower() in {"", "null", "none", "n/a"}):
            return None
        return str(v).strip()

    actions = raw.get("immediate_actions")
    if not isinstance(actions, list):
        actions = fb["immediate_actions"]
    actions = [str(a).strip() for a in actions if str(a).strip()][:6] or fb["immediate_actions"]

    severity = str(raw.get("severity") or fb["severity"]).lower().strip()
    if severity not in {"none", "low", "moderate", "high"}:
        severity = fb["severity"]

    return {
        "severity": severity,
        "summary": text("summary") or fb["summary"],
        "immediate_actions": actions,
        "organic_treatment": text("organic_treatment"),
        "chemical_treatment": text("chemical_treatment"),
        "prevention": text("prevention") or fb["prevention"],
    }
