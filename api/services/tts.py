"""TTS service — AI4Bharat TTS for Indian languages, fallback to gTTS."""

import io
import logging
import re
from functools import lru_cache
from typing import Optional

log = logging.getLogger(__name__)

# Map language codes to gTTS/Coqui language tags
GTTS_LANG_MAP = {
    "en": "en", "hi": "hi", "mr": "mr", "gu": "gu",
    "ta": "ta", "te": "te", "kn": "kn", "ml": "ml",
}

# Sentence split regex — handles Devanagari, Tamil, Telugu, etc.
SENT_SPLIT = re.compile(r'(?<=[।॥.!?।\n])\s+')


def split_sentences(text: str, max_chars: int = 500) -> list[str]:
    """Split text into sentence chunks for TTS."""
    raw = SENT_SPLIT.split(text.strip())
    chunks, current = [], ""
    for sentence in raw:
        if len(current) + len(sentence) > max_chars:
            if current:
                chunks.append(current.strip())
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    if current:
        chunks.append(current.strip())
    return chunks or [text]


class TTSService:
    def __init__(self):
        self._indic_tts = None
        self._gtts_available = self._check_gtts()

    def _check_gtts(self) -> bool:
        try:
            import gtts  # noqa
            return True
        except ImportError:
            log.warning("gTTS not installed — TTS will be limited")
            return False

    def _try_load_indic_tts(self):
        """Lazy-load AI4Bharat IndicTTS (Coqui backend)."""
        if self._indic_tts is not None:
            return self._indic_tts

        try:
            from TTS.api import TTS as CoquiTTS
            # ai4bharat/indic-tts supports: hi, mr, gu, ta, te, kn, ml
            tts = CoquiTTS("tts_models/multilingual/multi-dataset/xtts_v2")
            self._indic_tts = tts
            log.info("IndicTTS (Coqui XTTS v2) loaded")
            return tts
        except Exception as e:
            log.warning(f"Could not load IndicTTS: {e}. Will use gTTS fallback.")
            return None

    @lru_cache(maxsize=200)
    def _synthesize_cached(self, text: str, language: str) -> bytes:
        return self._synthesize_uncached(text, language)

    def _synthesize_uncached(self, text: str, language: str) -> bytes:
        # Try Coqui XTTS v2 (higher quality)
        tts = self._try_load_indic_tts()
        if tts:
            try:
                import tempfile, os
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                    tmp_path = f.name
                tts.tts_to_file(
                    text=text,
                    language=GTTS_LANG_MAP.get(language, "hi"),
                    file_path=tmp_path,
                )
                with open(tmp_path, "rb") as f:
                    audio = f.read()
                os.unlink(tmp_path)
                return audio
            except Exception as e:
                log.warning(f"Coqui TTS failed: {e}. Falling back to gTTS.")

        # gTTS fallback
        if self._gtts_available:
            from gtts import gTTS

            lang_code = GTTS_LANG_MAP.get(language, "hi")
            tts_obj = gTTS(text=text, lang=lang_code, slow=False)
            mp3_buf = io.BytesIO()
            tts_obj.write_to_fp(mp3_buf)
            mp3_buf.seek(0)
            return mp3_buf.read()

        raise RuntimeError("No TTS backend available")

    def synthesize(self, text: str, language: str) -> bytes:
        """Convert text to MP3 audio bytes. Handles long texts by splitting."""
        text = text.strip()
        if not text:
            return b""

        # For short texts use cache
        if len(text) <= 500:
            return self._synthesize_cached(text, language)

        # For long texts: split into sentences and concatenate
        sentences = split_sentences(text)
        audio_parts = []
        for sentence in sentences:
            if sentence.strip():
                part = self._synthesize_cached(sentence.strip(), language)
                audio_parts.append(part)

        if not audio_parts:
            return b""
        if len(audio_parts) == 1:
            return audio_parts[0]

        # Concatenate MP3 bytes directly (MP3 frames are self-contained)
        return b"".join(audio_parts)


_tts_instance: Optional[TTSService] = None


def get_tts() -> TTSService:
    global _tts_instance
    if _tts_instance is None:
        _tts_instance = TTSService()
    return _tts_instance
