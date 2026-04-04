# Nashik Kumbh Mela 2027 — AI Multilingual Assistant
## Complete Setup Guide

---

## Architecture Overview

```
React Native App (Mobile + Web)
         ↓  REST API / WebSocket
FastAPI Backend (your server)
    ├── Whisper Large v3       ← Voice → Text (all 8 languages)
    ├── ChromaDB + E5 Large    ← RAG retrieval
    ├── Qwen2.5-7B GGUF        ← Answer generation (fine-tuned)
    └── AI4Bharat TTS          ← Text → Voice (all 8 languages)
```

**Languages:** Hindi · Marathi · Gujarati · Tamil · Telugu · Kannada · Malayalam · English

---

## Hardware Requirements

| Setup | GPU | RAM | Disk |
|-------|-----|-----|------|
| Production | RTX 4090 (24GB) | 32GB | 200GB |
| Minimum | RTX 3090 (24GB) | 16GB | 100GB |
| Budget | 2× RTX 3080 (20GB) | 32GB | 100GB |
| Cloud Training | A100 40GB (RunPod ~$1.5/hr) | - | - |

---

## Step 1: Install Dependencies

```bash
# Clone and setup
cd /home/sidharth/Kumbh

# GPU PyTorch (CUDA 12.1)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# All other deps
pip install -r requirements.txt

# Playwright (for JS-heavy sites)
playwright install chromium

# Unsloth for fast training
pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
```

---

## Step 2: Crawl & Build Knowledge Base

```bash
# Run all crawlers (takes 2-4 hours, downloads Wikipedia + OSM + news)
python crawler/run_all_crawlers.py

# Or run individual crawlers:
python crawler/spiders/wikipedia_spider.py    # 30-60 min
python crawler/spiders/osm_places.py          # 5 min
python crawler/spiders/news_crawler.py        # 30-60 min
python crawler/spiders/indic_datasets.py      # 1-2 hours (large downloads)
```

**Output:** `knowledge_base/raw/` (expect 2-5GB of raw text)

---

## Step 3: Run the Data Pipeline

```bash
# Full pipeline: clean → chunk → deduplicate → translate → generate QA
python pipeline/run_pipeline.py

# Or step by step:
python pipeline/clean.py           # Remove noise, normalize Unicode
python pipeline/chunk.py           # Split into 300-500 word chunks
python pipeline/deduplicate.py     # Remove near-duplicates (MinHash)
python translate/batch_translate.py # EN → HI/MR/GU/TA/TE/KN/ML via IndicTrans2
python generate/qa_generator.py    # Generate 15,000-25,000 QA pairs (needs Ollama)
python generate/paraphrase.py      # Augment with paraphrases
```

**For QA generation, start Ollama first:**
```bash
ollama serve &
ollama pull qwen2.5:7b
```

**Output:** `data/synthetic_qa/all_languages_combined.jsonl` (~25,000 QA pairs)

---

## Step 4: Build Vector Database

```bash
# Ingest all data into ChromaDB
python vectordb/ingest_chroma.py

# Test retrieval
python vectordb/ingest_chroma.py --test

# Expected output:
# ChromaDB Collection: kumbh_mela_2027
# Total documents: ~50,000-80,000
```

---

## Step 5: Fine-tune the Model

### Option A: Train on Cloud (Recommended)
```bash
# Use RunPod / Vast.ai / Google Colab Pro
# Upload data/synthetic_qa/all_languages_combined.jsonl
# Run on A100 40GB:

python training/train_qlora.py \
    --model qwen2.5-7b \
    --data data/synthetic_qa/all_languages_combined.jsonl \
    --max-steps 2000 \
    --use-unsloth

# Training time: ~4-6 hours on A100
# Cost on RunPod A100: ~$6-9 total
```

### Option B: Train on RTX 4090 (local)
```bash
python training/train_qlora.py \
    --model qwen2.5-7b \
    --data data/synthetic_qa/all_languages_combined.jsonl \
    --max-steps 2000

# Training time: ~8-12 hours
```

### Option C: Skip fine-tuning (use base model with RAG only)
```bash
# Use Qwen2.5-7B-Instruct directly with Ollama — no fine-tuning needed
# Quality is lower but works immediately
ollama pull qwen2.5:7b
```

---

## Step 6: Export to GGUF (for production)

```bash
# After training completes:
python training/train_qlora.py --export-gguf
# Follow the printed commands to convert + quantize

# Result: models/kumbh_model_q4_k_m.gguf (~4GB)
# This runs on CPU+GPU at ~20-40 tokens/sec
```

---

## Step 7: Start the API Server

```bash
# Set config
cp .env.example .env
# Edit .env: MODEL_PATH, CHROMA_DB_PATH, etc.

# Start server
uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 1

# Or with Docker:
docker-compose up -d
```

**API will be available at:** `http://your-server-ip:8000`

**Test it:**
```bash
curl -X POST http://localhost:8000/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{"query": "रामकुंड कहां है?", "language": "hi"}'
```

---

## Step 8: Connect React Native App

```typescript
// In your React Native app, copy these files:
// frontend-integration/api.ts          → src/services/kumbhApi.ts
// frontend-integration/useVoiceAssistant.ts → src/hooks/useVoiceAssistant.ts
// frontend-integration/VoiceAssistantScreen.tsx → src/screens/VoiceAssistantScreen.tsx

// Set your server URL in .env:
EXPO_PUBLIC_API_URL=http://your-server-ip:8000

// Install dependencies:
npx expo install expo-av
```

---

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/query` | Text query → text response |
| POST | `/api/v1/voice/input` | Voice → Voice (full pipeline) |
| POST | `/api/v1/voice/stt` | Voice → Text only |
| POST | `/api/v1/voice/tts` | Text → Voice only |
| POST | `/api/v1/emergency` | Emergency response (hardcoded, fast) |
| GET | `/api/v1/emergency/contacts` | All emergency numbers |
| GET | `/api/v1/places` | Nashik tourist places list |
| GET | `/api/v1/places/{id}` | Place details in any language |
| GET | `/api/v1/places/nearby` | Places near GPS coordinates |
| POST | `/api/v1/places/recommend` | Personalized itinerary |
| WS | `/ws/chat` | WebSocket streaming chat |
| GET | `/api/v1/health` | Server health + GPU status |

---

## Data Sources Crawled

| Source | Content | Language |
|--------|---------|----------|
| Wikipedia (all language editions) | History, rituals, ghats, temples | EN/HI/MR/GU/TA/TE/KN/ML |
| OpenStreetMap (Overpass) | All places, hospitals, transport | Multilingual tags |
| Lokmat.com | Kumbh Mela news | Marathi |
| Dainik Bhaskar | Kumbh Mela news | Hindi |
| AI4Bharat IndicQA | Existing QA dataset | 12 Indian languages |
| Samanantar corpus | Parallel translations | EN↔All Indian langs |
| Seed JSON (hand-crafted) | Schedules, places, emergency | All 8 languages |

---

## Project Structure

```
Kumbh/
├── crawler/           ← Web scrapers (Wikipedia, OSM, news)
├── pipeline/          ← Data cleaning, chunking, deduplication
├── translate/         ← IndicTrans2 batch translation
├── generate/          ← Synthetic QA generation
├── vectordb/          ← ChromaDB ingestion + FAISS
│   └── chroma_db/     ← Persistent vector store (after ingest)
├── training/          ← QLoRA fine-tuning scripts
├── api/               ← FastAPI backend
│   ├── routes/        ← query, voice, emergency, places
│   └── services/      ← ASR, TTS, LLM, RAG
├── data/
│   ├── seed/          ← Hand-crafted knowledge (JSON)
│   └── synthetic_qa/  ← Generated training pairs
├── frontend-integration/ ← React Native components
├── models/            ← Saved model checkpoints + GGUF
├── knowledge_base/    ← Pipeline data stages
│   ├── raw/           ← Crawled data
│   ├── cleaned/       ← After cleaning
│   ├── chunked/       ← After chunking
│   ├── translated/    ← After translation
│   └── final/         ← Ready for ChromaDB
├── requirements.txt
├── docker-compose.yml
└── Dockerfile
```

---

## Estimated Timeline

| Week | Task |
|------|------|
| 1 | Install deps, run crawlers, build knowledge base |
| 2 | Run pipeline, translate, generate QA pairs |
| 3 | Fine-tune model on cloud (A100, ~$10) |
| 4 | Set up API server, test with ChromaDB |
| 5 | Connect React Native app, test voice |
| 6 | Native speaker testing (Hindi/Marathi), iterate |

---

## Cost Estimate (one-time)

| Item | Cost |
|------|------|
| Cloud GPU training (A100 ~6hrs) | ~$9 |
| Storage (server SSD 200GB) | ~$5/mo |
| Model download (Qwen2.5-7B) | Free |
| All datasets | Free |
| **Total one-time** | **~$10** |

**Runtime cost: $0** — everything runs locally, no API fees ever.
