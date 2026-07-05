# comic book app — technical architecture

## service map

```
┌─────────────────────────────────────────────────────┐
│  Vite + React + TypeScript + shadcn/ui (Vercel SPA) │
│                                                     │
│  /api/transcribe   → OpenAI Whisper                 │
│  /api/enhance      → OpenAI GPT-4o                  │
│  /api/generate     → fal.ai img2img                 │
│  /api/share/:uuid  → Supabase (service role, public)│
└─────────────────┬───────────────────────────────────┘
                  │
         ┌────────▼────────┐
         │    Supabase     │
         │  Auth + Postgres│
         │  + Storage      │
         └─────────────────┘
```

Single Vite app deployed to Vercel. No separate API server — all backend logic lives in Vercel serverless functions under `/api/`. Supabase handles auth, database, and file storage.

---

## stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Vite + React 18 + TypeScript | Consistent with sentence-builder and other skunkworks projects |
| UI components | shadcn/ui + Tailwind CSS | From day one — no raw Tailwind primitives |
| Auth | Supabase Auth (email + password) | Single pre-created account; no signup UI |
| Database | Supabase Postgres | Hosted, not Docker |
| File storage | Supabase Storage | Three buckets: `drawings`, `panels`, `temp-audio` |
| Serverless | Vercel functions (`/api/*.ts`) | `/api/enhance` → Edge runtime; `/api/transcribe` + `/api/generate` → Node.js runtime (required) |
| Voice transcription | OpenAI Whisper (`whisper-1`) | Via `/api/transcribe`; audio uploaded to `temp-audio` bucket first to bypass Vercel 4.5MB body limit |
| Narration enhancement | OpenAI GPT-4o | Via `/api/enhance` (Edge runtime OK) |
| Image generation | fal.ai — `fal-ai/flux/dev/image-to-image` | Verified img2img support; anime style via prompt + LoRA; Node.js runtime required |
| Hosting | Vercel | SPA catch-all rewrite required in `vercel.json` |
| Routing | React Router v6 | Client-side routing |

---

## data model

### `comic_books`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| user_id | uuid | FK → auth.users, not null | Owner |
| title | text | not null, default 'Untitled Comic' | |
| cover_page_id | — | Removed | Derived at query time: first page with non-null panel_url ordered by page_order |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

**RLS Policies:**
- `owner_all`: `auth.uid() = user_id` → SELECT, INSERT, UPDATE, DELETE

---

### `pages`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| comic_book_id | uuid | FK → comic_books(id) ON DELETE CASCADE | |
| user_id | uuid | FK → auth.users, not null | Redundant but simplifies RLS |
| page_order | int | not null | 0-indexed; managed in app |
| drawing_url | text | nullable | Supabase Storage path (private drawings bucket) |
| panel_url | text | nullable | Supabase Storage path (public panels bucket), set after generation |
| raw_transcription | text | nullable | Whisper output verbatim |
| enhanced_narration | text | nullable | GPT-4o output; used for TTS and speech bubbles |
| narration_bar_text | text | nullable | Editable caption bar; defaults to enhanced_narration |
| speech_bubbles | jsonb | default '[]' | Array of SpeechBubble objects (auto-saved, debounced 500ms) |
| characters_in_scene | uuid[] | default '{}' | IDs of characters tagged for this page; injected into generation prompt |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

**SpeechBubble JSON shape:**
```typescript
type SpeechBubble = {
  id: string        // uuid
  text: string
  x: number         // percentage from left (0–100)
  y: number         // percentage from top (0–100)
  width: number     // percentage of panel width
  tail: 'left' | 'right' | 'none'
}
```

**RLS Policies:**
- `owner_all`: `auth.uid() = user_id` → SELECT, INSERT, UPDATE, DELETE

---

### `characters`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| user_id | uuid | FK → auth.users, not null | |
| name | text | not null | e.g. "Kai" |
| photo_url | text | nullable | Reference photo in Supabase Storage |
| description | text | not null | Stable prompt fragment e.g. "Kai: muscular warrior with spiky black hair, orange gi, intense expression, glowing aura" |
| created_at | timestamptz | default now() | |

**RLS Policies:**
- `owner_all`: `auth.uid() = user_id` → SELECT, INSERT, UPDATE, DELETE

---

### `shares`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| share_token | uuid | unique, default gen_random_uuid() | The public URL token |
| comic_book_id | uuid | FK → comic_books(id) ON DELETE CASCADE | |
| user_id | uuid | FK → auth.users, not null | |
| created_at | timestamptz | default now() | |

### storage buckets (updated)

| Bucket | Access | Purpose |
|--------|--------|---------|
| `drawings` | Private (owner only) | Original child drawings; never exposed to share viewers |
| `panels` | Public read | Generated anime panels; share viewers load directly |
| `characters` | Private (owner only) | Character reference photos |
| `temp-audio` | Private (owner only) | Voice recordings pre-transcription; deleted immediately after Whisper succeeds |

**RLS Policies:**
- `owner_all`: `auth.uid() = user_id` → SELECT, INSERT, DELETE
- No viewer policy — public share access goes through `/api/share/:token` using service role key (avoids RLS complexity with anonymous share token validation)

---

## storage buckets

### `drawings`
- Access: authenticated owner read/write; no public access
- Path pattern: `{user_id}/{comic_book_id}/{page_id}/drawing.jpg`
- RLS: bucket policy restricts to authenticated user matching path prefix

### `panels`
- Access: authenticated owner write; **public read** (needed for share viewing without auth)
- Path pattern: `{user_id}/{comic_book_id}/{page_id}/panel.jpg`
- Public bucket — panel images are not sensitive; share viewers load them directly

### `characters`
- Access: authenticated owner read/write; no public access
- Path pattern: `{user_id}/characters/{character_id}/photo.jpg`

---

## auth model

Single Supabase email/password account. Jake creates the account in Supabase dashboard before first use. No signup UI is built.

- Login page is the app entry point (`/login`)
- Supabase client handles JWT storage (managed session via `@supabase/ssr` or `@supabase/auth-helpers-react`)
- All authenticated API calls send `Authorization: Bearer {access_token}` header
- All serverless functions validate the JWT against Supabase before processing
- No roles beyond `authenticated` — it's a single-user app

---

## API endpoints

### POST /api/transcribe
Transcribes a voice recording using OpenAI Whisper.

- **Auth**: Bearer token (authenticated user)
- **Runtime**: Node.js (not Edge — required for Supabase Storage download)
- **Request**: `{ audio_path: string }` — Supabase Storage path in `temp-audio` bucket
- **Response**: `{ raw_transcription: string }`
- **Errors**: `401` (no auth), `400` (no path), `500` (Whisper failure)
- **Flow**:
  1. Browser records audio via `MediaRecorder`; detects MIME type at runtime (`audio/webm` on Chrome, `audio/mp4` on iOS Safari)
  2. Browser uploads audio blob directly to Supabase Storage `temp-audio` bucket (bypasses Vercel 4.5MB body limit)
  3. Browser calls `/api/transcribe` with the storage path
  4. Server downloads audio from Storage using service role key, sends to Whisper
  5. Server deletes audio file from Storage (whether transcription succeeds or fails)
  6. Returns `raw_transcription`

---

### POST /api/enhance
Enhances raw transcription into polished comic book narration using GPT-4o.

- **Auth**: Bearer token (authenticated user)
- **Request**: `{ raw_transcription: string }`
- **Response**: `{ enhanced_narration: string }`
- **Errors**: `401`, `400` (empty transcription), `500`

**System prompt:**
```
You are helping a young child create an exciting comic book. 
The child has narrated a scene from his story. Your job is to:
1. Fix any unclear or fragmented sentences
2. Complete unfinished thoughts
3. Add vivid, exciting comic-book style language
4. Keep his original ideas and excitement — do not change what happens
5. Keep it age-appropriate and fun
6. Match the energy of Dragon Ball Z / action anime
Output ONLY the enhanced narration. 2–3 sentences maximum.
```

---

### POST /api/generate
Generates an anime-style panel from the drawing + narration + selected character descriptions.

- **Auth**: Bearer token (authenticated user)
- **Runtime**: Node.js (required — fal.ai SDK uses Node.js APIs)
- **Request**: `{ drawing_storage_path: string, enhanced_narration: string, characters: { name: string, description: string }[] }`
- **Response**: `{ panel_url: string }` — Supabase Storage path of saved panel
- **Errors**: `401`, `400`, `500` (with retry guidance on timeout)

**Note on characters:** Only characters tagged for this scene (`characters_in_scene` IDs resolved to descriptions before calling this endpoint) are injected — not all characters in the library. Cap at 4 characters maximum.

**Drawing URL handling:** Server downloads the drawing from the private `drawings` bucket using the service role key, encodes as base64, and passes as a data URI to fal.ai. This avoids signed URL expiry issues during generation queue time.

**Prompt assembly:**
```
Dragon Ball Z anime style comic book panel, vibrant colors, bold linework, dynamic action, 
speed lines, energy auras, dramatic lighting, manga shading.
{character descriptions joined by '. '}.
Scene: {enhanced_narration}.
High quality, detailed, expressive faces, cinematic composition.
```

**Negative prompt:**
```
photorealistic, realistic, western cartoon, disney, chibi, deformed, blurry, 
low quality, ugly, text, watermark, signature
```

**fal.ai model**: `fal-ai/flux/dev/image-to-image` (verified img2img support)
- `image_url`: base64 data URI of the child's drawing
- `strength`: 0.65 (stylizes while preserving composition)
- `num_inference_steps`: 28
- `guidance_scale`: 3.5 (FLUX recommended range)

After generation: download panel from fal.ai response URL and upload to Supabase Storage `panels` bucket. Return the Supabase public URL, not the fal.ai URL (which expires).

---

### GET /api/share/:token
Returns the full comic data for a public share link. No auth required.

- **Auth**: None
- **Response**: 
```typescript
{
  comic: {
    title: string
    pages: {
      id: string
      page_order: number
      panel_url: string      // public Supabase Storage URL
      enhanced_narration: string
      narration_bar_text: string
      speech_bubbles: SpeechBubble[]
    }[]
  }
}
```
- **Errors**: `404` (token not found)
- **Notes**: Uses service role key to bypass RLS. Returns only panel images (not drawings). Only `panel_url` from the `panels` public bucket is exposed.

---

## AI pipeline — full page creation flow

```
1. Child photographs drawing
   └→ Upload to Supabase Storage (drawings bucket)
   └→ Save drawing_url to pages row

2. Child records voice narration (up to 30s)
   └→ POST /api/transcribe (Whisper)
   └→ Save raw_transcription to pages row
   └→ Show raw transcription to child

3. POST /api/enhance (GPT-4o)
   └→ Save enhanced_narration to pages row
   └→ Play raw transcription via TTS ("Here's what I heard...")
   └→ Play enhanced narration via TTS ("Here's the superhero version!")
   └→ Child taps "Use it!" or "Try again" (no reading required)

4. POST /api/generate (fal.ai img2img)
   Input: drawing_url + enhanced_narration + all characters[]
   └→ Download generated panel
   └→ Upload to Supabase Storage (panels bucket)
   └→ Save panel_url to pages row
   └→ Show "Your drawing is becoming a superhero..." loading state

5. Panel displayed with:
   └→ Speech bubbles overlay (tap to add, drag to position)
   └→ Narration bar at bottom (editable text, defaults to enhanced_narration)
   └→ Play button for TTS playback (Web Speech API)
```

---

## frontend routes

| Route | Component | Auth | Notes |
|-------|-----------|------|-------|
| `/login` | `LoginPage` | None | Simple email/password form |
| `/` | `LibraryPage` | Required | Grid of comic books |
| `/comics/:id` | `ComicPage` | Required | Page grid for a comic |
| `/comics/:id/pages/:pageId` | `PageEditorPage` | Required | Full page creation flow |
| `/view/:shareToken` | `ShareViewerPage` | None | Public comic reader |

SPA catch-all rewrite in `vercel.json` required:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## key frontend components

| Component | Purpose |
|-----------|---------|
| `LibraryPage` | Grid of comic book cards; create/delete |
| `ComicPage` | Page thumbnails in order; add/reorder/delete pages |
| `PageEditorPage` | Orchestrates the full creation pipeline (photo → voice → generate → compose) |
| `PhotoCapture` | Camera input (`<input capture="environment">`) + preview |
| `VoiceRecorder` | MediaRecorder-based recorder with waveform feedback |
| `TranscriptionReview` | Shows raw vs. enhanced narration side by side; confirm or re-record |
| `PanelComposer` | Generated panel + speech bubble overlay (canvas or positioned divs) |
| `SpeechBubble` | Draggable/resizable bubble with editable text — use `react-draggable` or `@dnd-kit/core` (touch + mouse support required for iPad) |
| `NarrationBar` | Editable caption strip at bottom of panel |
| `PlaybackButton` | TTS via `window.speechSynthesis` |
| `CharacterLibrary` | CRUD for characters (photo + name + description) |
| `ComicReader` | Full-screen swipeable reader (Embla or similar carousel) |
| `ShareViewerPage` | Public read-only reader (same as ComicReader, no edit controls) |

---

## responsive layout

Tablet-first (iPad primary). Breakpoints:
- `sm` (≥640px): phone portrait
- `md` (≥768px): tablet portrait — primary target
- `lg` (≥1024px): tablet landscape — also primary target

Panel aspect ratio: fixed at **3:4** (portrait comic panel proportions). On landscape tablet, panel sits left with controls right. On portrait tablet/phone, panel sits top with controls below.

Key child UX rules that affect layout:
- All tap targets minimum **56px** height
- Recording button minimum **80px** diameter
- Generate button: full-width, prominent, placed where thumb lands naturally
- Loading states: friendly message + animation (no spinners alone)
- No text-only navigation — every action has an icon

---

## environment variables

| Variable | Used in | Description |
|----------|---------|-------------|
| `VITE_SUPABASE_URL` | Frontend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `/api/share/:token` | Service role for public share reads |
| `OPENAI_API_KEY` | `/api/transcribe`, `/api/enhance` | Whisper + GPT-4o |
| `FAL_API_KEY` | `/api/generate` | fal.ai image generation |

`SUPABASE_SERVICE_ROLE_KEY` must never have the `VITE_` prefix.
Set separately per environment (Preview = dev Supabase, Production = prod Supabase) in Vercel dashboard.
