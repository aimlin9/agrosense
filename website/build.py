"""Build the AgroSense website into docs/ (served by GitHub Pages).

    python website/build.py                 # production (base path /agrosense/)
    python website/build.py --base /        # serve from a domain root

Templates live in website/templates, static files in website/static. The
crop guide pages are generated from backend/app/data/disease_guide.json —
the same file that powers the app — so content never drifts.
"""
import argparse
import json
import math
import shutil
from datetime import date
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = ROOT / "docs"
GUIDE = ROOT / "backend" / "app" / "data" / "disease_guide.json"
SITE_HOST = "https://aimlin9.github.io"

ICONS = {
    "camera": '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    "cloud-rain": '<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/><path d="M8 19v2M8 13v2M16 19v2M16 13v2M12 21v2M12 15v2"/>',
    "trending-up": '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
    "message": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    "map": '<path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16M16 6v16"/>',
    "book": '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    "shield": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    "zap": '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
    "check": '<path d="M20 6L9 17l-5-5"/>',
    "check-circle": '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>',
    "arrow-right": '<path d="M5 12h14M12 5l7 7-7 7"/>',
    "chevron-down": '<path d="M6 9l6 6 6-6"/>',
    "leaf": '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    "users": '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    "globe": '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    "cpu": '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
    "lock": '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    "sun": '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
    "droplet": '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    "wind": '<path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>',
    "eye": '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    "help": '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
    "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    "smartphone": '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    "mail": '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/>',
    "file": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    "award": '<circle cx="12" cy="8" r="7"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/>',
    "activity": '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    "layers": '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
    "target": '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    "heart": '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    "clock": '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    "search": '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
    "alert": '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    "wifi-off": '<path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>',
    "thermometer": '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',
    "bar-chart": '<path d="M12 20V10M18 20V4M6 20v-4"/>',
    "feather": '<path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><path d="M16 8L2 22M17.5 15H9"/>',
    "github": '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>',
    "phone": '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    "calendar": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    "x": '<path d="M18 6L6 18M6 6l12 12"/>',
}

FEATURES = [
    {
        "slug": "diagnose", "icon": "camera", "name": "Crop doctor", "tagline": "Diagnosis from one photo",
        "title": "Know what’s wrong with your crop in seconds.",
        "lead": "Photograph one sick leaf. AgroSense names the disease, rates how serious it is, and gives a treatment plan written for Ghanaian farms — organic options first.",
        "shot": "result", "shot2": "confirm",
        "points": [
            ("Crop-aware", "You choose the crop first, so the model only weighs diseases that affect it — far fewer wrong answers."),
            ("Honest confidence", "Every result shows how sure the model is. Below 60%, AgroSense asks for a better photo and an expert’s opinion before anyone buys chemicals."),
            ("A plan, not just a name", "What to do today, organic and chemical treatments sold in Ghana, and how to prevent it next season."),
            ("Fast on slow networks", "Photos are compressed on the phone before upload, so a diagnosis sends quickly even on 3G."),
        ],
    },
    {
        "slug": "weather", "icon": "cloud-rain", "name": "Weather & spray outlook", "tagline": "Advice for your crop and farm",
        "title": "Weather that tells you what to do.",
        "lead": "A 7-day forecast for your exact farm, turned into plain advice for the crop you grow — plus a three-day spray outlook so treatments don’t wash off.",
        "shot": "weather", "shot2": "home-scrolled",
        "points": [
            ("Your farm, not the nearest city", "Uses your phone’s location or the coordinates you save for each field."),
            ("Advice for your crop", "Tomato, maize, pepper or cassava — the advisory adapts to what you’re growing."),
            ("Spray outlook", "Good, fair or avoid for the next three days, based on rain chance and wind."),
            ("Works when services don’t", "If the forecast service is down, AgroSense shows the last good forecast and says so."),
        ],
    },
    {
        "slug": "market", "icon": "trending-up", "name": "Market prices", "tagline": "Five markets, one screen",
        "title": "Know the market before you travel to it.",
        "lead": "Prices per kilogram across Kumasi, Techiman, Makola, Tamale and Kaneshie, with the week’s trend and the best place to sell.",
        "shot": "market", "shot2": "home",
        "points": [
            ("Best place to sell", "See at a glance which market is paying most for your crop today."),
            ("Real weekly change", "Up, down or steady — calculated from the last seven days of prices."),
            ("Two-week trend lines", "Spot whether a price is climbing before you harvest."),
            ("Clear about the source", "During the beta, prices are indicative daily estimates and are labelled that way."),
        ],
    },
    {
        "slug": "sms", "icon": "message", "name": "SMS for any phone", "tagline": "No smartphone needed",
        "title": "No smartphone? Text us.",
        "lead": "The same diagnosis, prices and weather services work over SMS, so farmers with feature phones aren’t left out.",
        "shot": None, "shot2": None,
        "points": [
            ("Send a photo by MMS", "Add the crop name — “tomato” — and get the diagnosis and the first thing to do."),
            ("Text “price tomato”", "Get the latest prices from the top markets in one message."),
            ("Text “weather”", "Today’s high, low and rain, with a one-line tip."),
            ("Your history carries over", "If you later download the app with the same number, your SMS diagnoses are already there."),
        ],
    },
    {
        "slug": "farms", "icon": "map", "name": "My farms", "tagline": "Fields, seasons and history",
        "title": "Every field, every season, in your pocket.",
        "lead": "Record each field’s crop, size and planting date. AgroSense tracks the season to harvest and keeps every diagnosis so you — or an extension officer — can look back.",
        "shot": "farms", "shot2": "farm-edit",
        "points": [
            ("Season tracking", "Day of the season and days to harvest, with a suggested harvest date for each crop."),
            ("Field locations", "Save GPS for a field so its weather advice is exact."),
            ("Full scan history", "Every diagnosis is saved with its photo, filterable by problems and healthy plants."),
            ("Crop guide built in", "Symptoms and treatment for all 26 diseases, available even before you scan."),
        ],
    },
]

JOURNAL = [
    {
        "slug": "spot-late-blight-early", "template": "journal/late-blight.html",
        "title": "How to spot late blight before it takes your field",
        "excerpt": "Late blight can destroy a tomato field in under two weeks. These are the signs to look for in the first few days.",
        "date": "2026-10-16", "read": "6 min read", "tag": "Field guide", "image": "assets/photos/late-blight-lesions.webp",
    },
    {
        "slug": "photos-the-ai-can-read", "template": "journal/photos.html",
        "title": "Taking a photo the AI can actually read",
        "excerpt": "Most uncertain results come from the photo, not the plant. Five habits that make a diagnosis far more reliable.",
        "date": "2026-10-16", "read": "4 min read", "tag": "How-to", "image": "assets/photos/late-blight-curl.webp",
    },
    {
        "slug": "a-crop-doctor-in-2-7mb", "template": "journal/model.html",
        "title": "Building a crop doctor that fits in 2.7 MB",
        "excerpt": "How two-phase transfer learning on MobileNetV2 reached 97.3% validation accuracy — and why we care more about honesty than the headline number.",
        "date": "2026-10-16", "read": "8 min read", "tag": "Engineering", "image": "assets/training-curves.webp",
    },
]

PAGES = [
    ("pages/home.html", "", None, "AgroSense diagnoses crop disease from a single photo and tells Ghanaian farmers exactly what to do — with weather advice and market prices across five major markets.", "home"),
    ("pages/product.html", "product/", "Product", "Crop diagnosis, weather and spray advice, market prices, SMS access and farm records — everything a smallholder farmer checks before a decision.", "product"),
    ("pages/how.html", "how-it-works/", "How it works", "From one photo to a treatment plan in under a minute. See every step of an AgroSense diagnosis.", "how"),
    ("pages/technology.html", "technology/", "Technology", "A 2.7 MB MobileNetV2 model at 97.3% validation accuracy, inside a platform designed to keep working when networks and services don’t.", "tech"),
    ("pages/impact.html", "impact/", "Impact", "Most crop losses in Ghana are preventable. AgroSense puts early, trustworthy advice within reach of every smallholder farmer.", "impact"),
    ("pages/partners.html", "partners/", "Partners", "Pilot AgroSense with your cooperative, extension service, NGO programme or agro-dealer network.", "partners"),
    ("pages/pricing.html", "pricing/", "Pricing", "AgroSense is free for farmers. Organisations can run a free pilot and then choose a programme plan.", "pricing"),
    ("pages/about.html", "about/", "About", "The story behind AgroSense, what we believe, and how it was built.", "about"),
    ("pages/help.html", "help/", "Help centre", "Answers to common questions about diagnosis, accounts, SMS, weather, prices and privacy.", "help"),
    ("pages/download.html", "download/", "Download", "Get the AgroSense Android beta, join the iOS waitlist, or start using AgroSense by SMS.", "download"),
    ("pages/contact.html", "contact/", "Contact", "Talk to the AgroSense team about the beta, partnerships, press or support.", "contact"),
    ("pages/press.html", "press/", "Press", "AgroSense press kit: boilerplate, key facts, logos, colours and product screenshots.", "press"),
    ("pages/guide_index.html", "crop-guide/", "Crop disease guide", "Symptoms, causes and treatment for 26 crop diseases, written for farmers in Ghana and West Africa.", "guide"),
    ("pages/journal_index.html", "journal/", "Journal", "Field guides, how-tos and engineering notes from the AgroSense team.", "journal"),
]


def contours_svg() -> str:
    """Deterministic 'topographic field' contour lines — the site's signature motif."""
    paths = []
    centers = [(260, 230, 0.0), (1020, 420, 1.7), (620, 760, 3.1)]
    for cx, cy, ph in centers:
        for ring in range(1, 9):
            r = ring * 34
            pts = []
            for k in range(0, 73):
                a = k / 72 * math.tau
                wob = 1 + 0.12 * math.sin(3 * a + ph + ring * 0.4) + 0.06 * math.sin(5 * a - ph)
                pts.append(f"{cx + math.cos(a) * r * wob * 1.25:.1f},{cy + math.sin(a) * r * wob:.1f}")
            paths.append(f'<path d="M{" L".join(pts)}Z"/>')
    return (
        '<svg class="contours" viewBox="0 0 1280 900" preserveAspectRatio="xMidYMid slice" '
        'fill="none" stroke="currentColor" stroke-width=".8" stroke-opacity=".35">' + "".join(paths) + "</svg>"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="/agrosense/")
    args = ap.parse_args()
    base = args.base if args.base.endswith("/") else args.base + "/"

    guide = json.loads(GUIDE.read_text(encoding="utf-8"))
    crops = []
    for e in guide:
        if e["crop"] not in crops:
            crops.append(e["crop"])

    env = Environment(loader=FileSystemLoader(HERE / "templates"), autoescape=select_autoescape(["html"]), trim_blocks=True, lstrip_blocks=True)
    common = {
        "base": base,
        "site_url": SITE_HOST + base,
        "icons": ICONS,
        "features": FEATURES,
        "journal": JOURNAL,
        "guide": guide,
        "guide_crops": crops,
        "contours": contours_svg(),
        "version": date.today().strftime("%Y%m%d"),
        "year": date.today().year,
    }

    # Globals so imported macros (icons, links) can see them too.
    env.globals.update(common)
    written = []

    def render(template, path, **ctx):
        html = env.get_template(template).render(**common, path=path, **ctx)
        dest = OUT / path / "index.html" if not path.endswith(".html") else OUT / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(html, encoding="utf-8")
        written.append(path)

    for template, path, title, desc, section in PAGES:
        render(template, path, title=title, description=desc, section=section,
               body_class="nav-on-dark" if section == "tech" else "")

    for f in FEATURES:
        render("pages/feature.html", f"product/{f['slug']}/", title=f["name"], description=f["lead"], section="product", f=f)

    for i, e in enumerate(guide):
        same_crop = [g for g in guide if g["crop"] == e["crop"] and g["slug"] != e["slug"]][:3]
        schema = json.dumps({
            "@context": "https://schema.org", "@type": "Article",
            "headline": f"{e['crop']} {e['name'].lower()}: symptoms, causes and treatment",
            "about": e["pathogen"], "publisher": {"@type": "Organization", "name": "AgroSense"},
        })
        render("pages/guide_entry.html", f"crop-guide/{e['slug']}/",
               title=f"{e['crop']} {e['name'].lower()} — symptoms & treatment",
               description=f"{e['summary']} Symptoms, how it spreads, and organic and chemical treatment.",
               section="guide", e=e, related=same_crop, schema=schema, progress=True)

    for post in JOURNAL:
        render(post["template"], f"journal/{post['slug']}/", title=post["title"], description=post["excerpt"],
               section="journal", post=post, progress=True, og_type="article")

    render("pages/404.html", "404.html", title="Page not found", description="This page doesn’t exist.", section=None)

    # Static assets
    for sub in ("css", "js"):
        dst = OUT / "assets" / sub
        dst.mkdir(parents=True, exist_ok=True)
        for f in (HERE / "static" / sub).iterdir():
            shutil.copy2(f, dst / f.name)

    # Sitemap & robots
    urls = [p for p in written if not p.endswith("404.html")] + ["legal/privacy.html", "legal/terms.html"]
    today = date.today().isoformat()
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        sm.append(f"  <url><loc>{SITE_HOST}{base}{u}</loc><lastmod>{today}</lastmod></url>")
    sm.append("</urlset>")
    (OUT / "sitemap.xml").write_text("\n".join(sm) + "\n", encoding="utf-8")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE_HOST}{base}sitemap.xml\n", encoding="utf-8")
    (OUT / ".nojekyll").write_text("", encoding="utf-8")
    print(f"Built {len(written)} pages into {OUT}")


if __name__ == "__main__":
    main()
