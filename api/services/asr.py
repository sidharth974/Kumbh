"""Whisper ASR service using faster-whisper for all 8 Indian languages."""

import io
import logging
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")
LANG_HINTS = {
    "hi": "hindi", "mr": "marathi", "gu": "gujarati",
    "ta": "tamil",  "te": "telugu",  "kn": "kannada",
    "ml": "malayalam", "en": "english",
}


class ASRService:
    def __init__(self, model_size: str = WHISPER_MODEL, device: str = "auto"):
        log.info(f"Loading Whisper {model_size}...")
        from faster_whisper import WhisperModel
        import torch

        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"
        compute = "float16" if device == "cuda" else "int8"
        self.model = WhisperModel(model_size, device=device, compute_type=compute)
        log.info("Whisper ready")

    def _convert_to_wav(self, audio_bytes: bytes, src_format: str = "m4a") -> bytes:
        """Convert any audio format to 16kHz mono WAV using ffmpeg."""
        with tempfile.NamedTemporaryFile(suffix=f".{src_format}", delete=False) as inp:
            inp.write(audio_bytes)
            inp_path = inp.name

        out_path = inp_path.replace(f".{src_format}", ".wav")
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", inp_path, "-ar", "16000", "-ac", "1", out_path],
                capture_output=True, check=True,
            )
            with open(out_path, "rb") as f:
                return f.read()
        finally:
            Path(inp_path).unlink(missing_ok=True)
            Path(out_path).unlink(missing_ok=True)

    def transcribe(
        self,
        audio_bytes: bytes,
        hint_language: Optional[str] = None,
        audio_format: str = "m4a",
    ) -> dict:
        """Transcribe audio bytes. Returns {text, language, confidence, segments}."""
        wav_bytes = self._convert_to_wav(audio_bytes, audio_format)

        # Whisper expects ISO codes (hi, mr, gu, ta, te, kn, ml, en)
        # If hint_language is already an ISO code and valid, use it directly
        VALID_WHISPER_CODES = {"hi", "mr", "gu", "ta", "te", "kn", "ml", "en",
                               "af", "am", "ar", "as", "az", "ba", "be", "bg",
                               "bn", "bo", "br", "bs", "ca", "cs", "cy", "da",
                               "de", "el", "es", "et", "eu", "fa", "fi", "fo",
                               "fr", "gl", "ha", "haw", "he", "hr", "ht", "hu",
                               "hy", "id", "is", "it", "ja", "jw", "ka", "kk",
                               "km", "ko", "la", "lb", "ln", "lo", "lt", "lv",
                               "mg", "mi", "mk", "mn", "ms", "mt", "my", "ne",
                               "nl", "nn", "no", "oc", "pa", "pl", "ps", "pt",
                               "ro", "ru", "sa", "sd", "si", "sk", "sl", "sn",
                               "so", "sq", "sr", "su", "sv", "sw", "tg", "th",
                               "tk", "tl", "tr", "tt", "uk", "ur", "uz", "vi",
                               "yi", "yo", "zh", "yue"}
        whisper_lang = None
        if hint_language:
            if hint_language in VALID_WHISPER_CODES:
                whisper_lang = hint_language
            elif hint_language in LANG_HINTS:
                # LANG_HINTS maps "hi" -> "hindi", but Whisper wants "hi"
                whisper_lang = hint_language  # use the key, not the value

        import numpy as np
        import io as _io
        import wave

        # Load wav bytes into numpy array
        with wave.open(_io.BytesIO(wav_bytes)) as wf:
            frames = wf.readframes(wf.getnframes())
            audio_np = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0

        segments, info = self.model.transcribe(
            audio_np,
            language=whisper_lang,
            beam_size=5,
            vad_filter=True,
        )

        segments_list = list(segments)
        text = " ".join(s.text.strip() for s in segments_list).strip()
        confidence = float(info.language_probability) if hasattr(info, "language_probability") else 0.9
        detected_lang = info.language if hasattr(info, "language") else (hint_language or "hi")

        return {
            "text": text,
            "language": detected_lang,
            "confidence": round(confidence, 3),
            "segments": [
                {"start": s.start, "end": s.end, "text": s.text}
                for s in segments_list
            ],
        }

    def transcribe_file(self, file_path: str) -> dict:
        with open(file_path, "rb") as f:
            audio_bytes = f.read()
        ext = Path(file_path).suffix.lstrip(".")
        return self.transcribe(audio_bytes, audio_format=ext)


_asr_instance: Optional[ASRService] = None


def get_asr() -> ASRService:
    global _asr_instance
    if _asr_instance is None:
        _asr_instance = ASRService()
    return _asr_instance
