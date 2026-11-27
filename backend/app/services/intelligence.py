"""Small deterministic language and hazard rules; never generates safety advice."""

import re
import unicodedata
from typing import Literal


Language = Literal["en", "ta", "hi"]
Intent = Literal[
    "repeat_instruction", "explain_simply", "report_hazard", "raise_sos",
    "help", "safety_question", "unknown",
]

_COMMANDS: dict[str, dict[Language, tuple[str, ...]]] = {
    "raise_sos": {
        "en": ("sos", "emergency", "i need help now", "send help"),
        "ta": ("எஸ்ஓஎஸ்", "அவசரம்", "உடனே உதவி", "avasaram"),
        "hi": ("एसओएस", "आपातकाल", "तुरंत मदद", "aapatkal"),
    },
    "report_hazard": {
        "en": ("report a hazard", "report hazard", "i see a hazard", "log a hazard"),
        "ta": ("ஆபத்தை புகாரளி", "அபாயத்தை தெரிவி", "ஆபத்து அறிக்கை", "aabathu sollunga", "apathu report"),
        "hi": ("खतरे की रिपोर्ट", "खतरा दर्ज करें", "जोखिम की रिपोर्ट", "khatre ki report", "khatra darj karo"),
    },
    "explain_simply": {
        "en": ("explain simply", "explain in simple words", "make it simpler", "simplify this"),
        "ta": ("எளிமையாக விளக்குங்கள்", "எளிய வார்த்தைகளில் சொல்லுங்கள்", "சுலபமாக சொல்லுங்கள்", "simple ah sollunga", "elimaiya sollunga"),
        "hi": ("आसान भाषा में समझाएं", "सरल शब्दों में बताएं", "आसान तरीके से समझाओ", "aasaan bhasha me samjhao", "saral shabdon me batao"),
    },
    "repeat_instruction": {
        "en": ("repeat", "say that again", "read it again", "repeat the instruction"),
        "ta": ("மீண்டும் சொல்லுங்கள்", "மீண்டும் சொல்லு", "திரும்பச் சொல்லுங்கள்", "மீண்டும் படிக்கவும்", "meendum sollunga", "thirumba sollunga"),
        "hi": ("दोबारा बताएं", "फिर से बताएं", "दोहराएं", "फिर से सुनाएं", "dobara batao", "phir se batao"),
    },
    "safety_question": {
        "en": ("what should i do", "what do i do", "what if", "is it safe to"),
        "ta": ("நான் என்ன செய்ய வேண்டும்", "என்ன செய்ய வேண்டும்", "பாதுகாப்பானதா", "naan enna seiyanum", "enna seiyanum"),
        "hi": ("मुझे क्या करना चाहिए", "क्या करना चाहिए", "क्या यह सुरक्षित है", "mujhe kya karna chahiye"),
    },
    "help": {
        "en": ("help me", "how do i use this", "what can i say"),
        "ta": ("எனக்கு உதவி வேண்டும்", "இதை எப்படி பயன்படுத்துவது", "udhavi venum"),
        "hi": ("मेरी मदद करें", "इसे कैसे इस्तेमाल करें", "मैं क्या बोल सकता हूं", "meri madad karein"),
    },
}

_MESSAGES: dict[Language, dict[str, str]] = {
    "en": {
        "raise_sos": "SOS request recognized. This app only creates a simulated demo alert. For an actual emergency, follow site procedures immediately.",
        "report_hazard": "Hazard report request recognized. Review the suggested fields; nothing has been submitted.",
        "explain_simply": "No separately approved simpler explanation is available. Ask the supervisor; this app will not invent safety instructions.",
        "repeat_instruction": "Repeat request recognized. Only the currently approved, published instruction may be repeated.",
        "safety_question": "No approved answer is available for that safety question. Ask the supervisor for review.",
        "help": "You can ask to repeat an instruction, request a simpler approved explanation, report a hazard, or open the simulated SOS screen.",
        "unknown": "I could not match that request. Try a supported command or use the visible text controls.",
        "ambiguous": "More than one hazard type or location was mentioned. Choose the correct fields manually before continuing.",
    },
    "ta": {
        "raise_sos": "SOS கோரிக்கை கண்டறியப்பட்டது. இந்த பயன்பாடு மாதிரி எச்சரிக்கையை மட்டுமே உருவாக்கும். உண்மையான அவசரத்தில், தளத்தின் நடைமுறைகளை உடனடியாகப் பின்பற்றுங்கள்.",
        "report_hazard": "ஆபத்து அறிக்கை கோரிக்கை கண்டறியப்பட்டது. பரிந்துரைக்கப்பட்ட விவரங்களைச் சரிபார்க்கவும்; எதுவும் சமர்ப்பிக்கப்படவில்லை.",
        "explain_simply": "தனியாக அங்கீகரிக்கப்பட்ட எளிய விளக்கம் இல்லை. பாதுகாப்பு வழிமுறைகளை இந்த பயன்பாடு உருவாக்காது; மேற்பார்வையாளரிடம் கேளுங்கள்.",
        "repeat_instruction": "மீண்டும் கூறும் கோரிக்கை கண்டறியப்பட்டது. தற்போது அங்கீகரித்து வெளியிடப்பட்ட வழிமுறையை மட்டுமே மீண்டும் கூறலாம்.",
        "safety_question": "இந்த பாதுகாப்புக் கேள்விக்கு அங்கீகரிக்கப்பட்ட பதில் இல்லை. மேற்பார்வையாளரிடம் மதிப்பாய்வு கேளுங்கள்.",
        "help": "வழிமுறையை மீண்டும் கூறச் சொல்லலாம், அங்கீகரிக்கப்பட்ட எளிய விளக்கத்தைக் கேட்கலாம், ஆபத்தைப் புகாரளிக்கலாம் அல்லது மாதிரி SOS திரையைத் திறக்கலாம்.",
        "unknown": "கோரிக்கையைப் புரிந்துகொள்ள முடியவில்லை. ஆதரிக்கப்படும் கட்டளையை முயற்சிக்கவும் அல்லது திரையில் உள்ள உரைக் கட்டுப்பாடுகளைப் பயன்படுத்தவும்.",
        "ambiguous": "ஒன்றுக்கும் மேற்பட்ட ஆபத்து வகை அல்லது இடம் குறிப்பிடப்பட்டுள்ளது. தொடர்வதற்கு முன் சரியான விவரங்களை நீங்களே தேர்ந்தெடுக்கவும்.",
    },
    "hi": {
        "raise_sos": "SOS अनुरोध पहचाना गया। यह ऐप केवल डेमो अलर्ट बनाता है। वास्तविक आपातकाल में तुरंत साइट की प्रक्रिया अपनाएं।",
        "report_hazard": "खतरे की रिपोर्ट का अनुरोध पहचाना गया। सुझाए गए विवरण जांचें; कुछ भी जमा नहीं किया गया है।",
        "explain_simply": "अलग से स्वीकृत सरल विवरण उपलब्ध नहीं है। सुपरवाइज़र से पूछें; यह ऐप सुरक्षा निर्देश नहीं बनाएगा।",
        "repeat_instruction": "दोहराने का अनुरोध पहचाना गया। केवल मौजूदा स्वीकृत और प्रकाशित निर्देश ही दोहराया जा सकता है।",
        "safety_question": "इस सुरक्षा प्रश्न का कोई स्वीकृत उत्तर उपलब्ध नहीं है। समीक्षा के लिए सुपरवाइज़र से पूछें।",
        "help": "आप निर्देश दोहराने, स्वीकृत सरल विवरण मांगने, खतरे की रिपोर्ट करने या सिम्युलेटेड SOS स्क्रीन खोलने को कह सकते हैं।",
        "unknown": "यह अनुरोध समझ नहीं आया। समर्थित कमांड बोलें या स्क्रीन पर दिए गए टेक्स्ट विकल्प चुनें।",
        "ambiguous": "एक से अधिक खतरे का प्रकार या स्थान बताया गया है। आगे बढ़ने से पहले सही विवरण खुद चुनें।",
    },
}

_HAZARD_TERMS: dict[str, tuple[str, ...]] = {
    "oil_leak": (
        "oil leak", "oil leaking", "oil spill", "leaking oil", "எண்ணெய் கசிவு", "எண்ணெய் கசிகிறது",
        "तेल का रिसाव", "तेल रिस रहा", "ennai kasivu", "tel ka risav",
    ),
    "gas_alarm": (
        "gas alarm", "gas alarm is sounding", "வாயு அலாரம்", "வாயு எச்சரிக்கை", "गैस अलार्म", "गैस का अलार्म",
    ),
    "unsafe_scaffold": (
        "unsafe scaffold", "scaffold is unsafe", "scaffold unsafe", "பாதுகாப்பற்ற சாரம்", "असुरक्षित मचान", "asurakshit machan",
    ),
}

_HAZARD_WORDS: dict[Language, tuple[str, ...]] = {
    "en": ("hazard", "unsafe", "spill", "leak", "alarm"),
    "ta": ("ஆபத்து", "அபாயம்", "கசிவு", "அலாரம்", "aabathu", "apathu", "kasivu"),
    "hi": ("खतरा", "जोखिम", "रिसाव", "अलार्म", "khatra", "jokhim", "risav"),
}

_NUMBER_WORDS: dict[str, int] = {
    "one": 1, "oru": 1, "onnu": 1, "ஒன்று": 1, "ஒரு": 1, "एक": 1,
    "two": 2, "rendu": 2, "irandu": 2, "இரண்டு": 2, "दो": 2,
    "three": 3, "moonu": 3, "மூன்று": 3, "तीन": 3,
    "four": 4, "naalu": 4, "nalu": 4, "நான்கு": 4, "चार": 4,
    "five": 5, "anju": 5, "ஐந்து": 5, "पांच": 5, "पाँच": 5,
    "six": 6, "ஆறு": 6, "छह": 6,
    "seven": 7, "ஏழு": 7, "सात": 7,
    "eight": 8, "எட்டு": 8, "आठ": 8,
    "nine": 9, "ஒன்பது": 9, "नौ": 9,
    "ten": 10, "பத்து": 10, "दस": 10,
}
_NUMBER_PATTERN = "|".join(sorted((re.escape(word) for word in _NUMBER_WORDS), key=len, reverse=True))
_ASSET_PATTERN = (
    r"pump(?:\s+house)?|unit|line|area|tank|boiler|gate|zone|"
    r"பம்ப்\s+ஹவுஸ்|பம்ப்|பம்பு|पंप|पम्प"
)
_LOCATION_RE = re.compile(
    rf"(?<!\w)(?P<asset>{_ASSET_PATTERN})\s*(?:number|no\.?|எண்|नंबर)?\s*"
    rf"(?P<number>\d{{1,3}}|{_NUMBER_PATTERN})(?!\w)", re.IGNORECASE
)
_BOUNDARY_CHARS = re.compile(r"[^\w\s]", flags=re.UNICODE)


def normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text).casefold().replace("_", " ")
    return " ".join(_BOUNDARY_CHARS.sub(" ", normalized).split())


def _contains_phrase(text: str, phrase: str) -> bool:
    normalized_phrase = normalize_text(phrase)
    return f" {normalized_phrase} " in f" {text} "


def _extract_category(text: str) -> tuple[str | None, bool]:
    matches = [category for category, phrases in _HAZARD_TERMS.items()
               if any(_contains_phrase(text, phrase) for phrase in phrases)]
    if len(matches) == 1:
        return matches[0], False
    return None, len(matches) > 1


def _extract_location(text: str) -> tuple[str | None, bool]:
    locations: set[str] = set()
    for match in _LOCATION_RE.finditer(text):
        asset = " ".join(match.group("asset").split()).casefold()
        raw_number = match.group("number").casefold()
        number = str(int(raw_number)) if raw_number.isdigit() else str(_NUMBER_WORDS[raw_number])
        if asset.startswith("pump") or asset.startswith("பம்ப") or asset.startswith("पंप") or asset.startswith("पम्प"):
            label = "Pump"
        else:
            label = asset.title()
        locations.add(f"{label} {number}")
    if len(locations) == 1:
        return next(iter(locations)), False
    return None, len(locations) > 1


def interpret_text(text: str, language: Language, context: Literal["general", "briefing", "hazard"]) -> dict[str, object]:
    normalized = normalize_text(text)
    found = [intent for intent, translations in _COMMANDS.items()
             if any(_contains_phrase(normalized, phrase)
                    for phrases in translations.values() for phrase in phrases)]
    category, category_ambiguous = _extract_category(normalized)
    location, location_ambiguous = _extract_location(normalized)

    if "raise_sos" in found:
        intent: Intent = "raise_sos"
    elif "safety_question" in found and context == "briefing":
        intent = "safety_question"
    elif "report_hazard" in found or category or any(
        _contains_phrase(normalized, word) for words in _HAZARD_WORDS.values() for word in words
    ):
        intent = "report_hazard"
    elif "explain_simply" in found:
        intent = "explain_simply"
    elif "repeat_instruction" in found:
        intent = "repeat_instruction"
    elif "help" in found:
        intent = "help"
    elif "safety_question" in found:
        intent = "safety_question"
    else:
        intent = "unknown"

    ambiguous = category_ambiguous or location_ambiguous
    if ambiguous and intent == "report_hazard":
        message_key = "ambiguous"
    else:
        message_key = intent
    hazard_related = intent == "report_hazard"
    confidence = "none"
    if hazard_related and (category or location):
        confidence = "high" if category and location and not ambiguous else "partial"

    return {
        "intent": intent,
        "confidence": confidence,
        "hazard": {
            "suggested_category": None if ambiguous and category_ambiguous else category,
            "suggested_location": None if ambiguous and location_ambiguous else location,
            "ambiguous": ambiguous,
        },
        "requires_confirmation": hazard_related,
        "requires_supervisor_review": intent in ("explain_simply", "safety_question"),
        "approved_instruction": None,
        "message": _MESSAGES[language][message_key],
    }
