"""LLM inference — llama-cpp-python (GGUF) with Ollama fallback."""

import logging
import os
from pathlib import Path
from typing import AsyncGenerator, Optional

import httpx

log = logging.getLogger(__name__)

ROOT = Path(__file__).parent.parent.parent
MODEL_PATH = os.environ.get("MODEL_PATH", str(ROOT / "models" / "kumbh_model_q4_k_m.gguf"))
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:1.5b")

SYSTEM_PROMPTS = {
    "en": "You are a helpful multilingual assistant for Nashik Kumbh Mela 2027. Answer ONLY using the provided context. If the context doesn't contain the answer, say so clearly. Be concise and accurate.",
    "hi": "आप नाशिक कुंभ मेला 2027 के सहायक हैं। केवल दिए गए संदर्भ के आधार पर उत्तर दें। संदर्भ में उत्तर न हो तो स्पष्ट रूप से कहें। संक्षिप्त और सटीक रहें।",
    "mr": "तुम्ही नाशिक कुंभ मेळा 2027 चे सहाय्यक आहात. फक्त दिलेल्या संदर्भाच्या आधारे उत्तर द्या. संक्षिप्त आणि अचूक राहा.",
    "gu": "તમે નાશિક કુંભ મેળા 2027 ના સહાયક છો. ફક્ત આપેલ સંદર્ભના આધારે જ જવાબ આપો. સ્પષ્ટ અને સંક્ષિપ્ત રહો.",
    "ta": "நீங்கள் நாசிக் கும்பமேளா 2027 உதவியாளர். வழங்கப்பட்ட சூழலின் அடிப்படையில் மட்டும் பதிலளிக்கவும். தெளிவாகவும் சுருக்கமாகவும் இருக்கவும்.",
    "te": "మీరు నాసిక్ కుంభమేళా 2027 సహాయకులు. అందించిన సందర్భం ఆధారంగా మాత్రమే సమాధానం ఇవ్వండి. స్పష్టంగా మరియు సంక్షిప్తంగా ఉండండి.",
    "kn": "ನೀವು ನಾಸಿಕ್ ಕುಂಭಮೇಳ 2027 ಸಹಾಯಕರು. ನೀಡಲಾದ ಸಂದರ್ಭದ ಆಧಾರದ ಮೇಲೆ ಮಾತ್ರ ಉತ್ತರಿಸಿ. ಸ್ಪಷ್ಟ ಮತ್ತು ಸಂಕ್ಷಿಪ್ತವಾಗಿರಿ.",
    "ml": "നിങ്ങൾ നാസിക് കുംഭമേള 2027 സഹായിയാണ്. നൽകിയ സന്ദർഭത്തിന്റെ അടിസ്ഥാനത്തിൽ മാത്രം ഉത്തരം നൽകൂ. വ്യക്തമായും സംക്ഷിപ്തമായും ഇരിക്കൂ.",
}


def _build_prompt(query: str, context: list[str], language: str) -> list[dict]:
    system = SYSTEM_PROMPTS.get(language, SYSTEM_PROMPTS["en"])
    # Keep context compact — just the text, no numbering
    context_block = "\n---\n".join(context) if context else ""
    if context_block:
        user_content = f"{context_block}\n\nAnswer this in 2-3 sentences using the info above: {query}"
    else:
        user_content = query
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user_content},
    ]


class LLMService:
    def __init__(self):
        self._llama = None
        self._backend = "none"
        self._try_load_gguf()
        if self._backend == "none":
            self._backend = "ollama"
            log.info(f"Using Ollama backend: {OLLAMA_URL}/{OLLAMA_MODEL}")

    def _try_load_gguf(self):
        path = Path(MODEL_PATH)
        if not path.exists():
            log.info(f"GGUF model not found at {MODEL_PATH}, will use Ollama")
            return
        try:
            from llama_cpp import Llama
            self._llama = Llama(
                model_path=str(path),
                n_gpu_layers=-1,   # Use all GPU layers
                n_ctx=4096,
                n_batch=512,
                verbose=False,
            )
            self._backend = "gguf"
            log.info(f"GGUF model loaded: {path.name}")
        except Exception as e:
            log.warning(f"Could not load GGUF: {e}")

    def generate(
        self,
        query: str,
        context: list[str],
        language: str = "en",
        domain: str = "general",
        max_tokens: int = 150,
        temperature: float = 0.3,
    ) -> str:
        # Limit context for CPU speed: top 3 chunks, max 1500 chars each
        trimmed = [c[:1500] for c in context[:3]]
        messages = _build_prompt(query, trimmed, language)

        if self._backend == "gguf" and self._llama:
            response = self._llama.create_chat_completion(
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=0.9,
                repeat_penalty=1.1,
            )
            return response["choices"][0]["message"]["content"].strip()

        elif self._backend == "ollama":
            return self._ollama_generate(messages, max_tokens, temperature)

        return "Service unavailable. Please try again."

    def _ollama_generate(
        self, messages: list[dict], max_tokens: int, temperature: float
    ) -> str:
        try:
            resp = httpx.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                        "top_p": 0.9,
                    },
                },
                timeout=180.0,
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"].strip()
        except Exception as e:
            log.error(f"Ollama error: {e}")
            return "I'm having trouble connecting to the language model. Please try again."

    async def generate_stream(
        self,
        query: str,
        context: list[str],
        language: str = "en",
        domain: str = "general",
    ) -> AsyncGenerator[str, None]:
        """Streaming generation for WebSocket."""
        messages = _build_prompt(query, context, language)

        if self._backend == "gguf" and self._llama:
            response = self._llama.create_chat_completion(
                messages=messages,
                max_tokens=512,
                temperature=0.3,
                stream=True,
            )
            for chunk in response:
                delta = chunk["choices"][0]["delta"].get("content", "")
                if delta:
                    yield delta

        else:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    f"{OLLAMA_URL}/api/chat",
                    json={
                        "model": OLLAMA_MODEL,
                        "messages": messages,
                        "stream": True,
                        "options": {"temperature": 0.3, "num_predict": 512},
                    },
                ) as resp:
                    import json as _json
                    async for line in resp.aiter_lines():
                        if line:
                            try:
                                data = _json.loads(line)
                                content = data.get("message", {}).get("content", "")
                                if content:
                                    yield content
                            except Exception:
                                continue

    @property
    def backend(self) -> str:
        return self._backend

    @property
    def model_name(self) -> str:
        if self._backend == "gguf":
            return Path(MODEL_PATH).stem
        return OLLAMA_MODEL


_llm_instance: Optional[LLMService] = None


def get_llm() -> LLMService:
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = LLMService()
    return _llm_instance
