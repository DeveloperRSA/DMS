# DocVault — AI-Powered Document Management System

A production-grade, secure DMS built on **Next.js 14**, **PostgreSQL + Prisma**, and **Google Gemini AI**. Handles invoice and credit note ingestion, AI-powered data extraction, multi-layer duplicate detection, a 3-step approval workflow, and a Gemini-powered financial insights engine.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Next.js 14 App                     │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────┐ │
│  │  Auth Layer  │   │  API Routes  │   │  React UI   │ │
│  │  (JWT/jose)  │   │ (App Router) │   │  (Client)   │ │
│  └──────┬───────┘   └──────┬───────┘   └─────────────┘ │
│         │                  │                            │
│  ┌──────▼───────────────────▼──────────────────────┐   │
│  │              Business Logic Layer                │   │
│  │  duplicateCheck.ts │ gemini.ts │ storage.ts      │   │
│  └──────────────────────┬──────────────────────────┘   │
└─────────────────────────┼───────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    ┌─────▼─────┐  ┌──────▼──────┐  ┌────▼────────┐
    │ PostgreSQL│  │ Gemini 2.5  │  │  File Store │
    │ (Prisma)  │  │   Flash AI  │  │  (local/S3) │
    └───────────┘  └─────────────┘  └─────────────┘
```

### Key design decisions
| Concern | Choice | Why |
|---|---|---|
| Auth | JWT via `jose` in HttpOnly cookies | No external auth service required; stateless |
| ORM | Prisma | Type-safe, migration-based schema management |
| AI Extraction | Gemini 2.5 Flash + `responseSchema` | Structured JSON output, no brittle regex |
| Duplicate Detection | 3-layer (hash, invoice+vendor, vendor+amount) | Catches both exact and semantic duplicates |
| Workflow | DB state machine with `$transaction` | Race-condition safe; atomic step advances |
| Storage | Local filesystem (swappable to S3) | Same interface; one-file swap to cloud |

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 18.17 |
| npm | ≥ 9 |
| PostgreSQL | ≥ 14 |

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd dms
npm install
```

### 2. Create your environment file

```bash
cp .env.example .env
```

Edit `.env`:

```env
# ── Database ──────────────────────────────────────────────
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL="postgresql://postgres:password@localhost:5432/dms_db"

# ── Auth ──────────────────────────────────────────────────
# Generate a strong secret: openssl rand -hex 32
JWT_SECRET="your-minimum-32-character-secret-here"

# ── Google Gemini AI ──────────────────────────────────────
# Get your key at: https://aistudio.google.com/app/apikey
# Leave blank to run in demo mode (mock extraction data)
GEMINI_API_KEY=""

# ── App ───────────────────────────────────────────────────
NODE_ENV="development"
```

---

## Database Setup

### Option A — Local PostgreSQL

#### 1. Create database

```bash
# macOS (Homebrew)
brew services start postgresql@16
psql postgres -c "CREATE DATABASE dms_db;"
psql postgres -c "CREATE USER dms_user WITH PASSWORD 'yourpassword';"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE dms_db TO dms_user;"

# Ubuntu/Debian
sudo -u postgres psql
postgres=# CREATE DATABASE dms_db;
postgres=# CREATE USER dms_user WITH ENCRYPTED PASSWORD 'yourpassword';
postgres=# GRANT ALL PRIVILEGES ON DATABASE dms_db TO dms_user;
postgres=# \q

# Windows (psql in PATH)
psql -U postgres -c "CREATE DATABASE dms_db;"
```

Update `DATABASE_URL` in `.env` with your credentials.

#### 2. Run Prisma migrations

```bash
# Generate Prisma Client from schema
npm run db:generate

# Apply schema to your database (creates all tables)
npm run db:migrate
# → you'll be prompted for a migration name, e.g. "init"

# Seed the database with demo users
npm run db:seed
```

#### 3. Verify (optional)

```bash
npm run db:studio
# Opens Prisma Studio at http://localhost:5555
# You should see Users, Documents, ApprovalHistory, AuditLog tables
```

---

### Option B — Supabase (Cloud PostgreSQL)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database → Connection string (URI)**
3. Copy the URI and paste it as `DATABASE_URL` in `.env`
4. Run `npm run db:migrate` and `npm run db:seed` as above

---

### Option C — Docker

```bash
docker run --name dms-postgres \
  -e POSTGRES_DB=dms_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:16-alpine
```

Then set `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dms_db"`.

---

## Running the App

```bash
npm run dev
# → http://localhost:3000
```

**Demo login credentials** (created by seed):

| Email | Password | Role | Can do |
|---|---|---|---|
| `admin@dms.local` | `Admin@123` | ADMIN | Upload, approve all 3 steps, view reports |
| `approver@dms.local` | `Approver@123` | APPROVER | Upload, approve Steps 1–2 |
| `viewer@dms.local` | `Viewer@123` | VIEWER | View documents only |

---

## Project Structure

```
dms/
├── app/
│   ├── (dashboard)/           # Authenticated route group
│   │   ├── layout.tsx         # Sidebar shell
│   │   ├── documents/page.tsx # Document list + workflow actions
│   │   ├── upload/page.tsx    # File upload + AI extraction
│   │   └── reports/page.tsx   # Reports + Gemini insights
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── me/route.ts
│   │   ├── documents/
│   │   │   ├── upload/route.ts    # POST upload, GET list
│   │   │   ├── workflow/route.ts  # POST approve/reject
│   │   │   └── [id]/route.ts      # GET single document
│   │   └── reports/
│   │       └── insights/route.ts  # GET report + AI insights
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # Login page
├── lib/
│   ├── prisma.ts              # Prisma singleton
│   ├── auth.ts                # JWT helpers
│   ├── duplicateCheck.ts      # 3-layer dedup engine
│   ├── gemini.ts              # AI extraction + insights
│   └── storage.ts             # File I/O (swap to S3 here)
├── prisma/
│   ├── schema.prisma          # DB schema + enums
│   └── seed.ts                # Demo user seeder
├── uploads/                   # Local file storage (git-ignored)
├── .env.example
└── README.md
```

---

## Approval Workflow

Documents travel through a strict 3-step state machine:

```
UPLOAD
  │
  ▼
[REVIEWER]  ──REJECT──► REJECTED (terminal)
  │ APPROVE
  ▼
[MANAGER]   ──REJECT──► REJECTED (terminal)
  │ APPROVE
  ▼
[FINANCE_ADMIN] ──REJECT──► REJECTED (terminal)
  │ APPROVE
  ▼
COMPLETED (APPROVED ✓)
```

- **REVIEWER / MANAGER** — accessible by `ADMIN` or `APPROVER` role
- **FINANCE_ADMIN** — accessible by `ADMIN` only
- Each step is protected by a `@@unique([documentId, step])` constraint — no step can be double-actioned
- The entire state transition is wrapped in a Prisma `$transaction` to prevent race conditions

---

## Duplicate Detection

Three layers, evaluated in order:

| Layer | Check | Blocks on |
|---|---|---|
| 1 | SHA-256 hash of raw file bytes | Identical file re-upload |
| 2 | `invoiceNumber` + `vendorName` (case-insensitive) | Same invoice re-submitted |
| 3 | `vendorName` + `amountInclVat` within last 30 days | Same vendor/amount within a month |

Returns HTTP `409 Conflict` with `reason` and `existingDocumentId` if any layer fires.

---

## Gemini AI Integration

### Document extraction (`lib/gemini.ts`)
- Uses `gemini-2.5-flash` with `responseSchema` (structured JSON output)
- Extracts: type, invoice number, vendor name, date, amounts (excl/VAT/incl), currency
- Falls back to realistic mock data when `GEMINI_API_KEY` is not set

### Financial insights (`/api/reports/insights`)
- Formats ledger records into a condensed context string
- Prompts Gemini as a "financial forensic AI"
- Returns Markdown analysis of anomalies, spending patterns, and VAT profiles

---

## Swapping to S3 / Supabase Storage

`lib/storage.ts` exposes three functions (`saveFile`, `readFile`, `deleteFile`) with a clean interface. To switch to S3:

```typescript
// lib/storage.ts — replace with:
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION });

export async function saveFile(buffer: Buffer, filename: string): Promise<string> {
  const key = `uploads/${Date.now()}-${filename}`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    Body: buffer,
    ServerSideEncryption: 'AES256',
  }));
  return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
}
```

No other files need to change.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Min 32-char secret for signing JWTs |
| `GEMINI_API_KEY` | ⬜ | Google AI Studio key; mock mode if absent |
| `NODE_ENV` | ⬜ | `development` or `production` |

---

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use a strong, random `JWT_SECRET` (`openssl rand -hex 32`)
- [ ] Run `npm run db:migrate:prod` (not `dev`) for production migrations
- [ ] Replace local `storage.ts` with S3/Supabase Storage
- [ ] Add rate limiting (e.g. `@upstash/ratelimit`) to `/api/auth/login`
- [ ] Set `secure: true` on cookies (automatic when `NODE_ENV=production`)
- [ ] Add HTTPS via reverse proxy (nginx, Caddy) or host on Vercel/Railway
- [ ] Store `GEMINI_API_KEY` and `DATABASE_URL` as platform secrets, never in source

---

## npm Scripts Reference

| Script | Description |
|---|---|
| `npm run dev` | Start dev server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run db:generate` | Regenerate Prisma Client from schema |
| `npm run db:migrate` | Create and apply new migration (dev) |
| `npm run db:migrate:prod` | Apply pending migrations (production) |
| `npm run db:push` | Push schema without creating migration files |
| `npm run db:studio` | Open Prisma Studio GUI at port 5555 |
| `npm run db:seed` | Insert demo users into database |
