"""
generate_from_kb.py — Template-based QA pair generator from knowledge base files.

Generates 5000+ QA pairs programmatically using templates (no Ollama/LLM needed).
Reads all JSON data files and creates factual Q&A pairs in English and Hindi.

Usage:
    python generate/generate_from_kb.py
    python generate/generate_from_kb.py --target 10000
"""

from __future__ import annotations

import json
import logging
import random
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR     = PROJECT_ROOT / "data"
QA_OUT_DIR   = DATA_DIR / "synthetic_qa"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Question templates — English and Hindi
# ---------------------------------------------------------------------------

# Templates take named format fields: {name}, {name_hi}, {category}, {location}, etc.
# Each template: (question_template, answer_fields_to_use, qa_type)

EN_TEMPLATES_PLACE = [
    ("What is {name}?", ["description_en"], "factual"),
    ("Tell me about {name}.", ["description_en", "significance_en", "history"], "factual"),
    ("Where is {name} located?", ["address", "location", "area", "coordinates_text"], "factual"),
    ("How to reach {name}?", ["how_to_reach_en"], "procedural"),
    ("What are the timings for {name}?", ["timings", "timing", "opening_hours", "darshan_timings"], "factual"),
    ("What is the entry fee for {name}?", ["entry_fee", "ticket", "cost"], "factual"),
    ("Best time to visit {name}?", ["tips_en", "best_time", "best_season"], "recommendation"),
    ("What is special about {name}?", ["significance_en", "highlights", "features", "description_en"], "factual"),
    ("What facilities are available at {name}?", ["facilities", "amenities", "services"], "factual"),
    ("Is {name} good for families?", ["tips_en", "description_en"], "recommendation"),
    ("How far is {name} from Ramkund?", ["distance_from_ramkund", "distance"], "factual"),
    ("How far is {name} from Nashik?", ["distance_from_nashik", "distance", "location"], "factual"),
    ("What is the history of {name}?", ["history", "mythology", "legend", "description_en"], "factual"),
    ("What are the rules at {name}?", ["bathing_rules_en", "rules", "dress_code"], "procedural"),
    ("What is the crowd level at {name} during Kumbh?", ["crowd_level_kumbh", "crowd_level", "estimated_pilgrims"], "factual"),
    ("What should I know before visiting {name}?", ["tips_en", "rules", "bathing_rules_en", "dress_code"], "recommendation"),
    ("Can you describe {name} in detail?", ["description_en", "significance_en", "history", "architecture"], "factual"),
    ("What is the significance of {name}?", ["significance_en", "description_en"], "factual"),
    ("What are the nearby attractions to {name}?", ["nearest_facilities", "nearby", "nearby_places"], "recommendation"),
    ("How crowded is {name}?", ["crowd_level_normal", "crowd_level_kumbh", "capacity"], "factual"),
]

HI_TEMPLATES_PLACE = [
    ("{name_hi} क्या है?", ["description_hi"], "factual"),
    ("{name_hi} के बारे में बताइए।", ["description_hi", "significance_hi"], "factual"),
    ("{name_hi} कहाँ है?", ["address", "location", "how_to_reach_hi"], "factual"),
    ("{name_hi} कैसे पहुँचें?", ["how_to_reach_hi"], "procedural"),
    ("{name_hi} का समय क्या है?", ["timings", "timing", "darshan_timings"], "factual"),
    ("{name_hi} का प्रवेश शुल्क कितना है?", ["entry_fee", "ticket", "cost"], "factual"),
    ("{name_hi} जाने का सबसे अच्छा समय कब है?", ["tips_hi", "tips_en", "best_time"], "recommendation"),
    ("{name_hi} की क्या विशेषता है?", ["significance_hi", "description_hi"], "factual"),
    ("{name_hi} में क्या सुविधाएं उपलब्ध हैं?", ["facilities", "amenities"], "factual"),
    ("{name_hi} रामकुंड से कितना दूर है?", ["distance_from_ramkund", "distance"], "factual"),
    ("{name_hi} का इतिहास क्या है?", ["history", "description_hi", "significance_hi"], "factual"),
    ("{name_hi} में भीड़ कितनी होती है?", ["crowd_level_kumbh", "crowd_level_normal"], "factual"),
    ("{name_hi} के नियम क्या हैं?", ["bathing_rules_hi", "rules", "bathing_rules_en"], "procedural"),
    ("{name_hi} के बारे में विस्तार से बताइए।", ["description_hi", "significance_hi", "history"], "factual"),
    ("{name_hi} की पूजा का समय क्या है?", ["darshan_timings", "timings"], "factual"),
    ("क्या {name_hi} परिवार के लिए अच्छा है?", ["tips_hi", "tips_en", "description_hi"], "recommendation"),
    ("{name_hi} के पास क्या क्या है?", ["nearest_facilities", "nearby", "nearby_places"], "recommendation"),
    ("{name_hi} कुंभ मेले में कैसा रहता है?", ["crowd_level_kumbh", "significance_hi"], "factual"),
]

EN_TEMPLATES_EVENT = [
    ("When is {name}?", ["date_approx", "date", "start", "end"], "factual"),
    ("What is {name}?", ["description_en", "significance", "significance_en"], "factual"),
    ("Tell me about {name}.", ["description_en", "significance", "significance_en", "details"], "factual"),
    ("Where does {name} take place?", ["ghats", "location", "venue"], "factual"),
    ("How many people attend {name}?", ["estimated_pilgrims", "crowd_level"], "factual"),
    ("What is the significance of {name}?", ["significance", "significance_en"], "factual"),
    ("What should I know about {name}?", ["significance", "significance_en", "tips_en", "crowd_level"], "recommendation"),
]

HI_TEMPLATES_EVENT = [
    ("{name_hi} कब है?", ["date_approx", "date"], "factual"),
    ("{name_hi} क्या है?", ["significance_hi", "significance", "description_hi"], "factual"),
    ("{name_hi} के बारे में बताइए।", ["significance_hi", "description_hi", "significance"], "factual"),
    ("{name_hi} कहाँ होता है?", ["ghats", "location", "venue"], "factual"),
    ("{name_hi} में कितने लोग आते हैं?", ["estimated_pilgrims", "crowd_level"], "factual"),
    ("{name_hi} का महत्व क्या है?", ["significance_hi", "significance"], "factual"),
]

EN_TEMPLATES_TRANSPORT = [
    ("How to reach {name}?", ["description_en", "details", "how_to_reach_en"], "procedural"),
    ("Tell me about {name}.", ["description_en", "details"], "factual"),
    ("What is {name}?", ["description_en", "details"], "factual"),
    ("Where is {name}?", ["address", "location"], "factual"),
    ("What are the {name} timings?", ["timings", "frequency", "schedule"], "factual"),
    ("How much does {name} cost?", ["cost", "fare", "entry_fee", "price"], "factual"),
]

HI_TEMPLATES_TRANSPORT = [
    ("{name_hi} कैसे पहुँचें?", ["description_hi", "details", "how_to_reach_hi"], "procedural"),
    ("{name_hi} के बारे में बताइए।", ["description_hi", "details"], "factual"),
    ("{name_hi} कहाँ है?", ["address", "location"], "factual"),
    ("{name_hi} का समय क्या है?", ["timings", "frequency"], "factual"),
]

EN_TEMPLATES_EMERGENCY = [
    ("What is the emergency number for {name}?", ["number", "phone", "local"], "emergency"),
    ("How to contact {name}?", ["number", "phone", "local", "address"], "emergency"),
    ("Where is {name}?", ["address", "location"], "emergency"),
    ("Tell me about {name}.", ["description_en", "services", "specialties"], "emergency"),
    ("What services does {name} provide?", ["services", "specialties"], "emergency"),
]

HI_TEMPLATES_EMERGENCY = [
    ("{name_hi} का आपातकालीन नंबर क्या है?", ["number", "phone", "local"], "emergency"),
    ("{name_hi} से कैसे संपर्क करें?", ["number", "phone", "address"], "emergency"),
    ("{name_hi} कहाँ है?", ["address", "location"], "emergency"),
    ("{name_hi} क्या सेवाएं प्रदान करता है?", ["services", "specialties"], "emergency"),
]

EN_TEMPLATES_FOOD = [
    ("What is {name}?", ["description_en", "details", "content"], "factual"),
    ("Tell me about {name}.", ["description_en", "details", "content", "ingredients"], "factual"),
    ("Where can I find {name} in Nashik?", ["location", "address", "where_to_find"], "recommendation"),
    ("What are the ingredients of {name}?", ["ingredients", "recipe"], "factual"),
    ("Is {name} vegetarian?", ["type", "category", "description_en"], "factual"),
    ("How much does {name} cost?", ["cost", "price", "price_range"], "factual"),
]

HI_TEMPLATES_FOOD = [
    ("{name_hi} क्या है?", ["description_hi", "details"], "factual"),
    ("{name_hi} के बारे में बताइए।", ["description_hi", "details", "ingredients"], "factual"),
    ("नाशिक में {name_hi} कहाँ मिलेगा?", ["location", "address", "where_to_find"], "recommendation"),
    ("{name_hi} शाकाहारी है?", ["type", "category", "description_hi"], "factual"),
]

# Category-based grouped questions
EN_CATEGORY_QUESTIONS = [
    ("What temples are there in Nashik?", "temple"),
    ("What ghats are there in Nashik?", "ghat"),
    ("Tell me about the ghats on Godavari River.", "ghat"),
    ("What are the important Kumbh Mela bathing dates?", "shahi_snan"),
    ("What are the popular tourist places in Nashik?", "tourist"),
    ("What food should I try in Nashik?", "food"),
    ("What wines can I try in Nashik?", "wine"),
    ("Where can I stay in Nashik during Kumbh?", "accommodation"),
    ("What are the emergency numbers for Kumbh Mela?", "emergency"),
    ("What hospitals are near Ramkund?", "hospital"),
    ("How to get around Nashik during Kumbh?", "transport"),
    ("What are the Shahi Snan dates in Kumbh 2027?", "shahi_snan"),
    ("Which Akharas participate in Kumbh Mela?", "akhara"),
    ("What are the best vineyards near Nashik?", "vineyard"),
    ("Tell me about caves and forts near Nashik.", "fort"),
]

HI_CATEGORY_QUESTIONS = [
    ("नाशिक में कौन कौन से मंदिर हैं?", "temple"),
    ("नाशिक में कौन कौन से घाट हैं?", "ghat"),
    ("गोदावरी नदी के घाटों के बारे में बताइए।", "ghat"),
    ("कुंभ मेले की शाही स्नान की तारीखें क्या हैं?", "shahi_snan"),
    ("नाशिक के प्रसिद्ध पर्यटन स्थल कौन से हैं?", "tourist"),
    ("नाशिक में क्या खाना चाहिए?", "food"),
    ("कुंभ मेले के दौरान नाशिक में कहाँ रुकें?", "accommodation"),
    ("कुंभ मेला के आपातकालीन नंबर क्या हैं?", "emergency"),
    ("रामकुंड के पास कौन से अस्पताल हैं?", "hospital"),
    ("कुंभ 2027 में शाही स्नान की तारीखें क्या हैं?", "shahi_snan"),
    ("कुंभ मेले में कौन कौन से अखाड़े भाग लेते हैं?", "akhara"),
    ("नाशिक के पास कौन से किले हैं?", "fort"),
]

# General conversational questions about Kumbh / Nashik
GENERAL_QA_EN = [
    {
        "instruction": "What is Kumbh Mela?",
        "output": "Kumbh Mela is the largest religious gathering in the world, held every 12 years at four sacred locations in India: Prayagraj (Allahabad), Haridwar, Nashik-Trimbakeshwar, and Ujjain. The Nashik Kumbh (Simhastha) happens when Jupiter enters Leo (Simha Rashi). Millions of pilgrims bathe in the sacred rivers to wash away sins and attain moksha.",
        "domain": "schedule", "type": "factual",
    },
    {
        "instruction": "When is the next Kumbh Mela in Nashik?",
        "output": "The next Nashik Simhastha Kumbh Mela is scheduled for 2027. The main bathing period is expected from mid-July to late August 2027 (approximately July 15 to August 29, 2027). Exact dates depend on astronomical calculations and official Maharashtra government announcement.",
        "domain": "schedule", "type": "factual",
    },
    {
        "instruction": "Which river is sacred for Kumbh Mela in Nashik?",
        "output": "The Godavari River is sacred for the Kumbh Mela in Nashik. It is also known as Dakshin Ganga (Ganges of the South). The main bathing ghats are Ramkund and Kushavart Kund at Trimbakeshwar, both on the Godavari.",
        "domain": "schedule", "type": "factual",
    },
    {
        "instruction": "How many people visit Kumbh Mela in Nashik?",
        "output": "An estimated 30-35 million pilgrims visit the Nashik Simhastha Kumbh Mela over its full duration of approximately 45 days. On Shahi Snan (royal bathing) days, 5-8 million people can gather at the ghats in a single day.",
        "domain": "schedule", "type": "factual",
    },
    {
        "instruction": "What should I pack for Kumbh Mela?",
        "output": "For Kumbh Mela, pack: comfortable walking shoes, light cotton clothes (dhoti/saree for bathing), waterproof bag for valuables, sunscreen, hat, water bottle, basic medicines, torch/flashlight, phone charger/power bank, ID proof (mandatory), and some cash in small denominations. Avoid carrying expensive jewelry or large amounts of cash.",
        "domain": "general", "type": "recommendation",
    },
    {
        "instruction": "Is Nashik safe during Kumbh Mela?",
        "output": "Yes, Nashik is generally safe during Kumbh Mela with heavy police deployment, CCTV surveillance, and medical camps. However, be cautious about: pickpockets in crowded areas, stampede risk at ghats during Shahi Snan, dehydration and heat stroke, slippery ghat steps. Keep emergency numbers saved: Police 100, Ambulance 108, Kumbh Helpline 1800-120-2027.",
        "domain": "emergency", "type": "recommendation",
    },
    {
        "instruction": "What is Panchavati?",
        "output": "Panchavati is a sacred neighborhood in Nashik on the banks of the Godavari River. According to the Ramayana, Lord Ram, Sita, and Lakshman lived here during their 14-year exile. The name means 'Five Banyan Trees'. It houses key religious sites including Ramkund, Kalaram Temple, Sita Gufa, and Tapovan. It is the main area for Kumbh Mela activities.",
        "domain": "places", "type": "factual",
    },
    {
        "instruction": "What is Nashik famous for?",
        "output": "Nashik is famous as: the Wine Capital of India (home to major vineyards like Sula and York), City of Temples with ancient sacred sites, host of the Nashik Kumbh Mela on the Godavari River, Grape City producing 60% of India's grapes, and a city with rich mythology connections to the Ramayana. It is also known for Trimbakeshwar (one of 12 Jyotirlingas) located 28 km away.",
        "domain": "places", "type": "factual",
    },
]

GENERAL_QA_HI = [
    {
        "instruction": "कुंभ मेला क्या है?",
        "output": "कुंभ मेला दुनिया का सबसे बड़ा धार्मिक आयोजन है जो हर 12 साल में भारत के चार पवित्र स्थानों पर आयोजित होता है: प्रयागराज, हरिद्वार, नाशिक-त्र्यंबकेश्वर और उज्जैन। नाशिक कुंभ (सिंहस्थ) तब होता है जब बृहस्पति सिंह राशि में प्रवेश करता है। लाखों श्रद्धालु पापों को धोने और मोक्ष प्राप्त करने के लिए पवित्र नदियों में स्नान करते हैं।",
        "domain": "schedule", "type": "factual",
    },
    {
        "instruction": "नाशिक में अगला कुंभ मेला कब है?",
        "output": "नाशिक सिंहस्थ कुंभ मेला 2027 में होगा। मुख्य स्नान अवधि जुलाई के मध्य से अगस्त 2027 के अंत तक (लगभग 15 जुलाई से 29 अगस्त 2027) होने की उम्मीद है। सटीक तिथियां खगोलीय गणना और महाराष्ट्र सरकार की आधिकारिक घोषणा पर निर्भर हैं।",
        "domain": "schedule", "type": "factual",
    },
    {
        "instruction": "कुंभ मेले में कितने लोग आते हैं?",
        "output": "नाशिक सिंहस्थ कुंभ मेले में लगभग 45 दिनों की अवधि में अनुमानित 3-3.5 करोड़ श्रद्धालु आते हैं। शाही स्नान के दिनों में एक ही दिन में 50-80 लाख लोग घाटों पर इकट्ठा हो सकते हैं।",
        "domain": "schedule", "type": "factual",
    },
    {
        "instruction": "नाशिक किसलिए प्रसिद्ध है?",
        "output": "नाशिक प्रसिद्ध है: भारत की वाइन राजधानी (सुला, यॉर्क जैसी प्रमुख वाइनरी), मंदिरों का शहर, गोदावरी नदी पर नाशिक कुंभ मेला, अंगूर शहर (भारत के 60% अंगूर का उत्पादन), और रामायण से जुड़ी पौराणिक कथाएं। त्र्यंबकेश्वर (12 ज्योतिर्लिंगों में से एक) 28 किमी दूर है।",
        "domain": "places", "type": "factual",
    },
    {
        "instruction": "पंचवटी क्या है?",
        "output": "पंचवटी नाशिक में गोदावरी नदी के तट पर एक पवित्र इलाका है। रामायण के अनुसार, भगवान राम, सीता और लक्ष्मण ने अपने 14 वर्ष के वनवास के दौरान यहां निवास किया था। इसका नाम 'पांच बरगद के पेड़' से आया है। यहां रामकुंड, कालाराम मंदिर, सीता गुफा और तपोवन जैसे प्रमुख धार्मिक स्थल हैं।",
        "domain": "places", "type": "factual",
    },
    {
        "instruction": "कुंभ मेले के लिए क्या सामान लाना चाहिए?",
        "output": "कुंभ मेले के लिए: आरामदायक जूते, हल्के सूती कपड़े (स्नान के लिए धोती/साड़ी), कीमती सामान के लिए वॉटरप्रूफ बैग, सनस्क्रीन, टोपी, पानी की बोतल, बुनियादी दवाइयां, टॉर्च, फोन चार्जर/पावर बैंक, पहचान पत्र (अनिवार्य), और छोटे नोटों में नकदी रखें। महंगे गहने या ज्यादा नकदी न ले जाएं।",
        "domain": "general", "type": "recommendation",
    },
    {
        "instruction": "कुंभ मेले में सुरक्षा कैसी है?",
        "output": "कुंभ मेले में भारी पुलिस तैनाती, CCTV निगरानी और चिकित्सा शिविरों के साथ सुरक्षा अच्छी है। सावधानियां: भीड़ वाले क्षेत्रों में जेबकतरों से सावधान, शाही स्नान के दिन भगदड़ का खतरा, गर्मी और निर्जलीकरण, फिसलन भरी सीढ़ियां। आपातकालीन नंबर: पुलिस 100, एम्बुलेंस 108, कुंभ हेल्पलाइन 1800-120-2027।",
        "domain": "emergency", "type": "recommendation",
    },
    {
        "instruction": "गोदावरी नदी का महत्व क्या है?",
        "output": "गोदावरी नदी दक्षिण भारत की सबसे लंबी नदी है और इसे दक्षिण गंगा भी कहते हैं। नाशिक में इसके तट पर कुंभ मेला आयोजित होता है। रामकुंड और त्र्यंबकेश्वर का कुशावर्त कुंड इसके सबसे पवित्र स्नान स्थल हैं। इसका उद्गम त्र्यंबकेश्वर के पास ब्रह्मगिरी पर्वत से होता है।",
        "domain": "places", "type": "factual",
    },
]


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _str(val: Any) -> str:
    """Convert any value to a readable string."""
    if val is None:
        return ""
    if isinstance(val, str):
        return val.strip()
    if isinstance(val, bool):
        return "Yes" if val else "No"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, (list, tuple)):
        items = [_str(v) for v in val if v]
        return ", ".join(items)
    if isinstance(val, dict):
        parts = []
        for k, v in val.items():
            sv = _str(v)
            if sv:
                parts.append(f"{k}: {sv}")
        return "; ".join(parts)
    return str(val).strip()


def _get_answer(entry: dict, field_keys: list[str]) -> str:
    """Get the first non-empty answer from a list of field keys."""
    parts: list[str] = []
    for key in field_keys:
        val = entry.get(key)
        if val is not None:
            text = _str(val)
            if text and len(text) > 2:
                parts.append(text)
    return "\n".join(parts) if parts else ""


def _get_name(entry: dict, lang: str = "en") -> str:
    """Get the best name for an entry in the given language."""
    suffix = f"_{lang}" if lang != "en" else "_en"
    name = entry.get(f"name{suffix}") or entry.get(f"name_{lang}") or entry.get("name") or entry.get("name_en") or ""
    return _str(name)


def _make_record(question: str, answer: str, lang: str, domain: str, qa_type: str) -> dict | None:
    """Create a QA record, returning None if answer is too short."""
    answer = answer.strip()
    question = question.strip()
    if not answer or len(answer) < 15 or not question:
        return None
    return {
        "instruction": question,
        "input": "",
        "output": answer,
        "language": lang,
        "domain": domain,
        "type": qa_type,
    }


# ---------------------------------------------------------------------------
# Extraction from different file types
# ---------------------------------------------------------------------------

def extract_places(data: dict) -> list[dict]:
    """Extract place entries from nashik_places.json-like structure."""
    places = data.get("places", [])
    if not places and isinstance(data, list):
        places = data
    return [p for p in places if isinstance(p, dict)]


def extract_events(data: dict) -> list[dict]:
    """Extract event/snan entries from schedule JSON."""
    events = []
    for key in ("shahi_snan", "events", "bathing_dates", "schedule", "ceremonies"):
        items = data.get(key, [])
        if isinstance(items, list):
            events.extend(i for i in items if isinstance(i, dict))
    return events


def extract_ghats(data: dict) -> list[dict]:
    """Extract ghats from ghats_and_transport.json-like structure."""
    return [g for g in data.get("ghats", []) if isinstance(g, dict)]


def extract_transport(data: dict) -> list[dict]:
    """Extract transport entries."""
    entries = []
    transport = data.get("transport", {})
    if isinstance(transport, dict):
        for mode, info in transport.items():
            if isinstance(info, dict):
                info.setdefault("name", mode)
                info.setdefault("name_en", mode)
                entries.append(info)
                # Check nested entries (e.g., transport.railways.main_station)
                for sub_key, sub_val in info.items():
                    if isinstance(sub_val, dict) and ("name" in sub_val or "description_en" in sub_val):
                        sub_val.setdefault("name", sub_key)
                        entries.append(sub_val)
                    elif isinstance(sub_val, list):
                        for item in sub_val:
                            if isinstance(item, dict):
                                entries.append(item)
    return entries


def extract_hospitals(data: dict) -> list[dict]:
    """Extract hospital/emergency entries."""
    entries = []
    for key in ("hospitals", "police_stations", "medical_camps"):
        items = data.get(key, [])
        if isinstance(items, list):
            entries.extend(i for i in items if isinstance(i, dict))
    return entries


def extract_emergency_scenarios(data: dict) -> list[dict]:
    """Extract emergency scenario entries."""
    entries = []
    for key in ("scenarios", "emergencies", "emergency_scenarios"):
        val = data.get(key)
        if isinstance(val, list):
            entries.extend(i for i in val if isinstance(i, dict))
        elif isinstance(val, dict):
            for scenario_key, scenario in val.items():
                if isinstance(scenario, dict):
                    scenario.setdefault("name", scenario_key)
                    scenario.setdefault("name_en", scenario_key.replace("_", " ").title())
                    entries.append(scenario)
    return entries


def extract_accommodation(data: dict) -> list[dict]:
    """Extract accommodation entries."""
    entries = []
    for key in ("accommodation", "hotels", "dharamshalas", "stays", "lodging"):
        items = data.get(key, [])
        if isinstance(items, list):
            entries.extend(i for i in items if isinstance(i, dict))
    return entries


def extract_food(data: dict) -> list[dict]:
    """Extract food/wine entries from various structures."""
    entries = []
    for key in ("dishes", "foods", "restaurants", "street_food", "cuisine",
                "wines", "wineries", "vineyards", "items", "places",
                "local_cuisine", "specialties", "food_items"):
        items = data.get(key, [])
        if isinstance(items, list):
            entries.extend(i for i in items if isinstance(i, dict))
    # Also check if top-level is a list
    if isinstance(data, list):
        entries.extend(i for i in data if isinstance(i, dict))
    return entries


def extract_culture(data: dict) -> list[dict]:
    """Extract culture/history entries."""
    entries = []
    for key in ("traditions", "festivals", "art_forms", "history", "mythology",
                "legends", "events", "cultural_sites", "heritage", "items"):
        items = data.get(key, [])
        if isinstance(items, list):
            entries.extend(i for i in items if isinstance(i, dict))
    return entries


def extract_routes(data: dict) -> list[dict]:
    """Extract route entries."""
    entries = []
    for key in ("routes", "buses", "trains", "flights", "connections",
                "bus_routes", "train_routes", "local_transport", "items"):
        items = data.get(key, [])
        if isinstance(items, list):
            entries.extend(i for i in items if isinstance(i, dict))
    return entries


def extract_akharas(data: dict) -> list[dict]:
    """Extract akhara entries."""
    entries = []
    for key in ("akhara_bathing_order", "akharas", "akhara_list"):
        items = data.get(key, [])
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict):
                    entries.append(item)
                elif isinstance(item, str):
                    entries.append({"name": item, "name_en": item})
    return entries


# ---------------------------------------------------------------------------
# QA generation from entries
# ---------------------------------------------------------------------------

def generate_place_qa(entries: list[dict], domain: str = "places") -> list[dict]:
    """Generate QA pairs from place-like entries."""
    records: list[dict] = []

    for entry in entries:
        name_en = _get_name(entry, "en")
        name_hi = _get_name(entry, "hi") or name_en

        if not name_en and not name_hi:
            continue

        # English templates
        for tmpl, answer_fields, qa_type in EN_TEMPLATES_PLACE:
            question = tmpl.format(name=name_en, name_hi=name_hi,
                                   category=entry.get("category", "place"),
                                   location=entry.get("location", "Nashik"))
            answer = _get_answer(entry, answer_fields)
            rec = _make_record(question, answer, "en", domain, qa_type)
            if rec:
                records.append(rec)

        # Hindi templates
        for tmpl, answer_fields, qa_type in HI_TEMPLATES_PLACE:
            hi_fields = []
            for f in answer_fields:
                # Prefer Hindi version of the field
                hi_f = f.replace("_en", "_hi")
                if hi_f != f and entry.get(hi_f):
                    hi_fields.append(hi_f)
                else:
                    hi_fields.append(f)
            question = tmpl.format(name=name_en, name_hi=name_hi,
                                   category=entry.get("category", "place"),
                                   location=entry.get("location", "Nashik"))
            answer = _get_answer(entry, hi_fields)
            rec = _make_record(question, answer, "hi", domain, qa_type)
            if rec:
                records.append(rec)

    return records


def generate_event_qa(entries: list[dict], domain: str = "schedule") -> list[dict]:
    """Generate QA pairs from event entries."""
    records: list[dict] = []

    for entry in entries:
        name_en = entry.get("name") or entry.get("name_en") or ""
        name_hi = entry.get("name_hi") or name_en

        if not name_en:
            continue

        for tmpl, answer_fields, qa_type in EN_TEMPLATES_EVENT:
            question = tmpl.format(name=name_en, name_hi=name_hi)
            answer = _get_answer(entry, answer_fields)
            rec = _make_record(question, answer, "en", domain, qa_type)
            if rec:
                records.append(rec)

        for tmpl, answer_fields, qa_type in HI_TEMPLATES_EVENT:
            hi_fields = [f.replace("_en", "_hi") if entry.get(f.replace("_en", "_hi")) else f
                         for f in answer_fields]
            question = tmpl.format(name=name_en, name_hi=name_hi)
            answer = _get_answer(entry, hi_fields)
            rec = _make_record(question, answer, "hi", domain, qa_type)
            if rec:
                records.append(rec)

    return records


def generate_transport_qa(entries: list[dict]) -> list[dict]:
    """Generate QA pairs from transport entries."""
    records: list[dict] = []

    for entry in entries:
        name_en = entry.get("name") or entry.get("name_en") or ""
        name_hi = entry.get("name_hi") or name_en

        if not name_en:
            continue

        for tmpl, answer_fields, qa_type in EN_TEMPLATES_TRANSPORT:
            question = tmpl.format(name=name_en, name_hi=name_hi)
            answer = _get_answer(entry, answer_fields)
            rec = _make_record(question, answer, "en", "transport", qa_type)
            if rec:
                records.append(rec)

        for tmpl, answer_fields, qa_type in HI_TEMPLATES_TRANSPORT:
            hi_fields = [f.replace("_en", "_hi") if entry.get(f.replace("_en", "_hi")) else f
                         for f in answer_fields]
            question = tmpl.format(name=name_en, name_hi=name_hi)
            answer = _get_answer(entry, hi_fields)
            rec = _make_record(question, answer, "hi", "transport", qa_type)
            if rec:
                records.append(rec)

    return records


def generate_emergency_qa(entries: list[dict]) -> list[dict]:
    """Generate QA pairs from emergency/hospital entries."""
    records: list[dict] = []

    for entry in entries:
        name_en = entry.get("name") or entry.get("name_en") or ""
        name_hi = entry.get("name_hi") or name_en

        if not name_en:
            continue

        for tmpl, answer_fields, qa_type in EN_TEMPLATES_EMERGENCY:
            question = tmpl.format(name=name_en, name_hi=name_hi)
            answer = _get_answer(entry, answer_fields)
            rec = _make_record(question, answer, "en", "emergency", qa_type)
            if rec:
                records.append(rec)

        for tmpl, answer_fields, qa_type in HI_TEMPLATES_EMERGENCY:
            hi_fields = [f.replace("_en", "_hi") if entry.get(f.replace("_en", "_hi")) else f
                         for f in answer_fields]
            question = tmpl.format(name=name_en, name_hi=name_hi)
            answer = _get_answer(entry, hi_fields)
            rec = _make_record(question, answer, "hi", "emergency", qa_type)
            if rec:
                records.append(rec)

    return records


def generate_food_qa(entries: list[dict]) -> list[dict]:
    """Generate QA pairs from food/wine entries."""
    records: list[dict] = []

    for entry in entries:
        name_en = entry.get("name") or entry.get("name_en") or ""
        name_hi = entry.get("name_hi") or name_en

        if not name_en:
            continue

        for tmpl, answer_fields, qa_type in EN_TEMPLATES_FOOD:
            question = tmpl.format(name=name_en, name_hi=name_hi)
            answer = _get_answer(entry, answer_fields)
            rec = _make_record(question, answer, "en", "food", qa_type)
            if rec:
                records.append(rec)

        for tmpl, answer_fields, qa_type in HI_TEMPLATES_FOOD:
            hi_fields = [f.replace("_en", "_hi") if entry.get(f.replace("_en", "_hi")) else f
                         for f in answer_fields]
            question = tmpl.format(name=name_en, name_hi=name_hi)
            answer = _get_answer(entry, hi_fields)
            rec = _make_record(question, answer, "hi", "food", qa_type)
            if rec:
                records.append(rec)

    return records


def generate_category_qa(all_entries: dict[str, list[dict]]) -> list[dict]:
    """Generate category-based grouped questions."""
    records: list[dict] = []

    # Build category index
    category_index: dict[str, list[str]] = defaultdict(list)
    for entries in all_entries.values():
        for entry in entries:
            name = entry.get("name") or entry.get("name_en") or ""
            cat = entry.get("category") or entry.get("subcategory") or entry.get("type") or ""
            if name and cat:
                category_index[cat.lower()].append(name)

    # English category questions
    for question, cat_key in EN_CATEGORY_QUESTIONS:
        names = category_index.get(cat_key, [])
        if not names:
            # Try partial matching
            for cat, cat_names in category_index.items():
                if cat_key in cat or cat in cat_key:
                    names.extend(cat_names)
        if names:
            answer = f"Here are the notable ones: {', '.join(names[:15])}."
            if len(names) > 15:
                answer += f" And {len(names) - 15} more."
            rec = _make_record(question, answer, "en", "general", "factual")
            if rec:
                records.append(rec)

    # Hindi category questions
    for question, cat_key in HI_CATEGORY_QUESTIONS:
        names = category_index.get(cat_key, [])
        if not names:
            for cat, cat_names in category_index.items():
                if cat_key in cat or cat in cat_key:
                    names.extend(cat_names)
        if names:
            answer = f"प्रमुख स्थान: {', '.join(names[:15])}।"
            if len(names) > 15:
                answer += f" और {len(names) - 15} और हैं।"
            rec = _make_record(question, answer, "hi", "general", "factual")
            if rec:
                records.append(rec)

    return records


def generate_helpline_qa(data: dict) -> list[dict]:
    """Generate QA pairs from helpline data."""
    records: list[dict] = []
    helplines = data.get("helplines", {})
    if not helplines:
        return records

    # Build a comprehensive helpline text
    lines_en = []
    lines_hi = []
    for key, val in helplines.items():
        label = key.replace("_", " ").title()
        if isinstance(val, dict):
            num = val.get("number", val.get("local", ""))
            lines_en.append(f"{label}: {num}")
            lines_hi.append(f"{label}: {num}")
        elif isinstance(val, str):
            lines_en.append(f"{label}: {val}")
            lines_hi.append(f"{label}: {val}")

    helpline_text_en = "\n".join(lines_en)
    helpline_text_hi = "\n".join(lines_hi)

    en_questions = [
        "What are the emergency numbers for Kumbh Mela?",
        "What is the helpline number for Kumbh Mela 2027?",
        "Who to call in emergency in Nashik?",
        "What is the police number?",
        "What is the ambulance number?",
        "How to report a missing person at Kumbh?",
        "What is the fire brigade number?",
        "What is the women helpline number?",
        "What is the child helpline number?",
        "What is the tourist helpline number?",
    ]

    hi_questions = [
        "कुंभ मेले के आपातकालीन नंबर क्या हैं?",
        "कुंभ मेला 2027 का हेल्पलाइन नंबर क्या है?",
        "नाशिक में आपातकाल में किसे फोन करें?",
        "पुलिस का नंबर क्या है?",
        "एम्बुलेंस का नंबर क्या है?",
        "कुंभ में लापता व्यक्ति की रिपोर्ट कैसे करें?",
        "फायर ब्रिगेड का नंबर क्या है?",
        "महिला हेल्पलाइन नंबर क्या है?",
        "बाल हेल्पलाइन नंबर क्या है?",
    ]

    for q in en_questions:
        rec = _make_record(q, helpline_text_en, "en", "emergency", "emergency")
        if rec:
            records.append(rec)

    for q in hi_questions:
        rec = _make_record(q, helpline_text_hi, "hi", "emergency", "emergency")
        if rec:
            records.append(rec)

    return records


def generate_cross_reference_qa(places: list[dict], events: list[dict]) -> list[dict]:
    """Generate cross-referencing QA pairs (e.g., 'temples near Ramkund')."""
    records: list[dict] = []

    # Group places by category
    by_category: dict[str, list[dict]] = defaultdict(list)
    for p in places:
        cat = p.get("category") or p.get("subcategory") or "place"
        by_category[cat.lower()].append(p)

    # "What temples are near X?" style
    landmarks = ["Ramkund", "Panchavati", "Nashik", "Trimbakeshwar"]
    for landmark in landmarks:
        for cat, items in by_category.items():
            if len(items) < 2:
                continue
            cat_label = cat.replace("_", " ").title() + "s"
            names = [_get_name(p, "en") for p in items[:10] if _get_name(p, "en")]
            if names:
                q = f"What {cat_label.lower()} are near {landmark}?"
                a = f"Notable {cat_label.lower()} near {landmark} include: {', '.join(names)}."
                rec = _make_record(q, a, "en", "places", "factual")
                if rec:
                    records.append(rec)

    # Distance-based questions
    for p in places:
        name = _get_name(p, "en")
        dist = p.get("distance_from_ramkund") or p.get("distance")
        if name and dist:
            q = f"How far is {name} from Ramkund?"
            a = f"{name} is {_str(dist)} from Ramkund."
            rec = _make_record(q, a, "en", "places", "factual")
            if rec:
                records.append(rec)

            q_hi = f"{_get_name(p, 'hi') or name} रामकुंड से कितना दूर है?"
            rec_hi = _make_record(q_hi, f"{_get_name(p, 'hi') or name} रामकुंड से {_str(dist)} दूर है।", "hi", "places", "factual")
            if rec_hi:
                records.append(rec_hi)

    return records


def generate_variant_questions(base_records: list[dict]) -> list[dict]:
    """Generate question variants from existing records to boost count."""
    variants: list[dict] = []

    en_rewrites = [
        (r"^What is (.+)\?$", "Can you tell me about {0}?"),
        (r"^What is (.+)\?$", "I want to know about {0}."),
        (r"^Tell me about (.+)\.$", "What can you tell me about {0}?"),
        (r"^How to reach (.+)\?$", "What is the best way to get to {0}?"),
        (r"^How to reach (.+)\?$", "How do I get to {0}?"),
        (r"^What are the timings for (.+)\?$", "When is {0} open?"),
        (r"^What are the timings for (.+)\?$", "What time does {0} open?"),
        (r"^What is the entry fee for (.+)\?$", "Do I need to pay to visit {0}?"),
        (r"^What is the entry fee for (.+)\?$", "How much is the ticket for {0}?"),
        (r"^Best time to visit (.+)\?$", "When should I visit {0}?"),
        (r"^What is special about (.+)\?$", "Why is {0} famous?"),
        (r"^What is special about (.+)\?$", "What makes {0} unique?"),
        (r"^What is the significance of (.+)\?$", "Why is {0} important?"),
    ]

    hi_rewrites = [
        (r"^(.+) क्या है\?$", "मुझे {0} के बारे में बताइए।"),
        (r"^(.+) कहाँ है\?$", "{0} किधर है?"),
        (r"^(.+) कैसे पहुँचें\?$", "{0} तक कैसे जाएं?"),
        (r"^(.+) का समय क्या है\?$", "{0} कब खुलता है?"),
        (r"^(.+) के बारे में बताइए।$", "{0} क्या है?"),
    ]

    for rec in base_records:
        q = rec["instruction"]
        lang = rec.get("language", "en")
        rewrites = en_rewrites if lang == "en" else hi_rewrites

        for pattern, template in rewrites:
            m = re.match(pattern, q)
            if m:
                new_q = template.format(*m.groups())
                new_rec = dict(rec)
                new_rec["instruction"] = new_q
                new_rec["type"] = "conversational"
                variants.append(new_rec)
                break  # One variant per base record per rewrite pass

    return variants


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    import argparse
    p = argparse.ArgumentParser(description="Generate template-based QA from knowledge base")
    p.add_argument("--target", type=int, default=5000, help="Target number of QA pairs")
    args = p.parse_args()

    QA_OUT_DIR.mkdir(parents=True, exist_ok=True)

    # --- Load all data files ---
    all_data: dict[str, Any] = {}
    data_files = sorted(DATA_DIR.iterdir())
    for path in data_files:
        if path.suffix == ".json" and path.is_file():
            try:
                all_data[path.name] = json.loads(path.read_text(encoding="utf-8"))
                log.info("Loaded: %s", path.name)
            except Exception as exc:
                log.warning("Failed to load %s: %s", path.name, exc)

    if not all_data:
        log.error("No data files found in %s", DATA_DIR)
        return

    # --- Extract structured entries ---
    all_places: list[dict] = []
    all_events: list[dict] = []
    all_ghats: list[dict] = []
    all_transport: list[dict] = []
    all_hospitals: list[dict] = []
    all_emergency: list[dict] = []
    all_accommodation: list[dict] = []
    all_food: list[dict] = []
    all_culture: list[dict] = []
    all_routes: list[dict] = []
    all_akharas: list[dict] = []

    for fname, data in all_data.items():
        if not isinstance(data, dict):
            if isinstance(data, list):
                # Try to classify list items
                for item in data:
                    if isinstance(item, dict):
                        if any(k in item for k in ("description_en", "how_to_reach_en", "category")):
                            all_places.append(item)
                        elif any(k in item for k in ("ingredients", "recipe", "cuisine")):
                            all_food.append(item)
            continue

        all_places.extend(extract_places(data))
        all_events.extend(extract_events(data))
        all_ghats.extend(extract_ghats(data))
        all_transport.extend(extract_transport(data))
        all_hospitals.extend(extract_hospitals(data))
        all_emergency.extend(extract_emergency_scenarios(data))
        all_accommodation.extend(extract_accommodation(data))
        all_akharas.extend(extract_akharas(data))

        fn = fname.lower()
        if "food" in fn or "wine" in fn or "cuisine" in fn:
            all_food.extend(extract_food(data))
        if "culture" in fn or "history" in fn:
            all_culture.extend(extract_culture(data))
        if "route" in fn or "transport" in fn:
            all_routes.extend(extract_routes(data))

    log.info("Extracted: %d places, %d events, %d ghats, %d transport, %d hospitals, "
             "%d emergency, %d accommodation, %d food, %d culture, %d routes, %d akharas",
             len(all_places), len(all_events), len(all_ghats), len(all_transport),
             len(all_hospitals), len(all_emergency), len(all_accommodation),
             len(all_food), len(all_culture), len(all_routes), len(all_akharas))

    # --- Generate QA pairs ---
    all_records: list[dict] = []

    # Places (includes ghats as places too)
    log.info("Generating QA for places...")
    all_records.extend(generate_place_qa(all_places, "places"))
    all_records.extend(generate_place_qa(all_ghats, "places"))
    all_records.extend(generate_place_qa(all_accommodation, "accommodation"))

    # Events
    log.info("Generating QA for events...")
    all_records.extend(generate_event_qa(all_events, "schedule"))
    all_records.extend(generate_event_qa(all_akharas, "schedule"))

    # Transport
    log.info("Generating QA for transport...")
    all_records.extend(generate_transport_qa(all_transport))
    all_records.extend(generate_transport_qa(all_routes))

    # Emergency
    log.info("Generating QA for emergency...")
    all_records.extend(generate_emergency_qa(all_hospitals))
    all_records.extend(generate_emergency_qa(all_emergency))

    # Helplines
    for fname, data in all_data.items():
        if isinstance(data, dict) and "helplines" in data:
            all_records.extend(generate_helpline_qa(data))

    # Food
    log.info("Generating QA for food...")
    all_records.extend(generate_food_qa(all_food))

    # Culture
    log.info("Generating QA for culture...")
    all_records.extend(generate_place_qa(all_culture, "culture"))

    # Cross-reference
    log.info("Generating cross-reference QA...")
    all_records.extend(generate_cross_reference_qa(all_places + all_ghats, all_events))

    # Category questions
    log.info("Generating category QA...")
    entries_by_source = {
        "places": all_places, "ghats": all_ghats,
        "events": all_events, "transport": all_transport,
    }
    all_records.extend(generate_category_qa(entries_by_source))

    # General knowledge QA
    log.info("Adding general QA...")
    all_records.extend(GENERAL_QA_EN)
    all_records.extend(GENERAL_QA_HI)

    log.info("Base QA pairs generated: %d", len(all_records))

    # --- Generate question variants to boost count ---
    if len(all_records) < args.target:
        log.info("Generating question variants to reach target of %d...", args.target)
        variants = generate_variant_questions(all_records)
        random.shuffle(variants)
        needed = args.target - len(all_records)
        all_records.extend(variants[:needed])
        log.info("Added %d variants (had %d available)", min(needed, len(variants)), len(variants))

    # --- Deduplicate ---
    seen: set[str] = set()
    unique_records: list[dict] = []
    for rec in all_records:
        key = rec["instruction"].lower().strip()
        if key not in seen:
            seen.add(key)
            unique_records.append(rec)
    log.info("After dedup: %d unique QA pairs", len(unique_records))

    # --- Split by language and write ---
    en_records = [r for r in unique_records if r.get("language", "en") == "en"]
    hi_records = [r for r in unique_records if r.get("language", "en") == "hi"]
    other_records = [r for r in unique_records if r.get("language", "en") not in ("en", "hi")]

    en_path = QA_OUT_DIR / "template_qa_en.jsonl"
    hi_path = QA_OUT_DIR / "template_qa_hi.jsonl"
    combined_path = QA_OUT_DIR / "all_languages_combined.jsonl"

    # Write English
    with en_path.open("w", encoding="utf-8") as fh:
        for rec in en_records:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    log.info("Wrote %d English QA pairs -> %s", len(en_records), en_path.name)

    # Write Hindi
    with hi_path.open("w", encoding="utf-8") as fh:
        for rec in hi_records:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    log.info("Wrote %d Hindi QA pairs -> %s", len(hi_records), hi_path.name)

    # Update combined file — merge with existing QA pairs
    existing_combined: list[str] = []
    existing_questions: set[str] = set()
    if combined_path.exists():
        with combined_path.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    existing_combined.append(line)
                    try:
                        item = json.loads(line)
                        existing_questions.add(item.get("instruction", "").lower().strip())
                    except json.JSONDecodeError:
                        pass
        log.info("Existing combined file has %d entries", len(existing_combined))

    # Write combined: existing + new (avoiding duplicates)
    new_lines = 0
    with combined_path.open("w", encoding="utf-8") as fh:
        # Write existing entries first
        for line in existing_combined:
            fh.write(line + "\n")

        # Add new unique entries
        for rec in unique_records:
            key = rec["instruction"].lower().strip()
            if key not in existing_questions:
                fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
                existing_questions.add(key)
                new_lines += 1

    total_combined = len(existing_combined) + new_lines
    log.info("Combined file updated: %d total (%d existing + %d new) -> %s",
             total_combined, len(existing_combined), new_lines, combined_path.name)

    # --- Summary ---
    lang_counts: dict[str, int] = defaultdict(int)
    domain_counts: dict[str, int] = defaultdict(int)
    type_counts: dict[str, int] = defaultdict(int)
    for rec in unique_records:
        lang_counts[rec.get("language", "en")] += 1
        domain_counts[rec["domain"]] += 1
        type_counts[rec["type"]] += 1

    print("\n" + "=" * 68)
    print("  TEMPLATE QA GENERATION — SUMMARY")
    print("=" * 68)
    print(f"\n  Total unique QA pairs: {len(unique_records):>6,}")
    print(f"  Target was:           {args.target:>6,}")

    print("\n  Per-language:")
    for lang in ["en", "hi"]:
        print(f"    {lang:<10} {lang_counts.get(lang, 0):>6,}")
    for lang, count in sorted(lang_counts.items()):
        if lang not in ("en", "hi"):
            print(f"    {lang:<10} {count:>6,}")

    print("\n  Per-domain:")
    for domain, count in sorted(domain_counts.items(), key=lambda x: -x[1]):
        print(f"    {domain:<20} {count:>6,}")

    print("\n  Per-type:")
    for qa_type, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"    {qa_type:<20} {count:>6,}")

    print(f"\n  Output files:")
    print(f"    {en_path}")
    print(f"    {hi_path}")
    print(f"    {combined_path} ({total_combined} total entries)")
    print("=" * 68 + "\n")


if __name__ == "__main__":
    main()
