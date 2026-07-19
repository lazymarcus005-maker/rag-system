# RAG System

ระบบ RAG + Admin Document Management + Chat

- **api/** — NestJS + TypeORM + BullMQ (ingestion pipeline, hybrid retrieval, SSE chat)
- **web/** — Next.js (App Router) + Tailwind (Login / Chat / Admin)
- **Infra** — PostgreSQL + pgvector, Redis, Ollama (ผ่าน Docker Compose)

## เริ่มต้นใช้งาน

```bash
# 1. ยกระบบ infra ขึ้นมา
docker compose up -d

# 2. ดึงโมเดล Ollama (ครั้งแรกครั้งเดียว)
docker exec rag-ollama ollama pull bge-m3          # embedding (1024 dims, รองรับภาษาไทย)
docker exec rag-ollama ollama pull llama3.1:8b     # chat model (เปลี่ยนได้ตาม env)

# 3. รัน API
cd api
copy .env.example .env
npm install
npm run start:dev        # http://localhost:3001

# 4. รัน Web
cd web
copy .env.example .env.local
npm install
npm run dev              # http://localhost:3000
```

## ค่าเริ่มต้น

- Admin seed: `admin@local` / `admin1234` (เปลี่ยนได้ใน `api/.env`)
- Ollama Cloud: ตั้ง `OLLAMA_BASE_URL` + `OLLAMA_API_KEY` ใน `api/.env` แทนการชี้ไป local

## หมายเหตุ

- Embedding dimension ตั้งไว้ 1024 (bge-m3) — ถ้าเปลี่ยน embed model ต้องแก้ `vector(1024)` ใน migration และ re-index เอกสารทั้งหมด
- Retrieval เป็น hybrid 3 ทาง: pgvector cosine + full-text search + trigram (`pg_trgm` สำหรับภาษาไทย) รวมคะแนนแบบ RRF แล้ว rerank ด้วย chat model (ปิดได้ด้วย `RERANK_ENABLED=false`)
- คำถามต่อเนื่องถูก rewrite เป็นคำถาม standalone อัตโนมัติก่อน retrieve
- เช็คสถานะระบบได้ที่ `GET /health` (DB / Redis / Ollama)
