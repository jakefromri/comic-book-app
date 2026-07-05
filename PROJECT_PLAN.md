# comic book app — project plan

> **Stack:** Vite + React + TypeScript + shadcn/ui · Supabase (auth + storage + DB) · Vercel · fal.ai (image gen) · OpenAI Whisper (voice transcription)
>
> **Ralph Loop:** Run this project through all 7 agents. It has real architecture decisions — auth, RLS, file storage, multi-step AI pipeline — that warrant the full loop.

---

## product vision

A kid-friendly web app where a child can photograph his pencil drawings, narrate what's happening by voice, and watch the drawings transform into Dragon Ball Z–style anime comic panels — complete with speech bubbles and narration bars. The finished pages are collected into shareable comic books that grandparents and parents can view via a link.

Designed for a child with limited reading/writing. The entire experience is voice-first, large-tap-target, and playback-enabled. The app builds reading and storytelling stamina by letting him hear his narration played back over his art.

---

## key design decisions (resolve before Agent 02)

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Auth strategy | Single shared login (no per-child accounts) — PIN or simple password | It's one kid on one device. Full auth is overkill for MVP. Supabase auth still works for this. |
| Image gen API | fal.ai (img2img, anime style) | Best anime/DragonBall style models; img2img means the kid's drawing provides the structural skeleton, reducing character drift |
| Voice transcription | OpenAI Whisper via Vercel serverless function | Already used in sentence-builder; proven pattern |
| Character library | Photo + text description per character → injected into every fal.ai prompt | Prevents drift; child defines character once, reused on every page |
| Storage | Supabase Storage for all images (original drawings, generated panels) | Consistent with other projects; RLS-compatible |
| Sharing | Public UUID-based URL, no auth required to view | Grandparents don't log in |
| Architecture | Single Vite app + Vercel serverless functions in /api/ | No separate API app needed; consistent with fox-ricciardi and sentence-builder patterns |

---

## ralph loop — agent-by-agent breakdown

### agent 01 — scope
**Tool:** Claude CLI
**Inputs:** This document + the product vision above
**Outputs:** `scope.md`

What to produce:
- One-liner and problem statement
- MVP feature list (ruthlessly cut — aim for the smallest working story loop: photo → voice → generate → view)
- Explicit out-of-scope list (animation, sound effects, multi-user, etc.)
- User roles: just `owner` (Jake) and `viewer` (shareable link, no auth)
- Explicit behaviors: what the system will and won't do
- Open questions list (see table above)

Done when: `scope.md` exists and Jake has answered the open questions.

---

### agent 02 — architecture
**Tool:** Claude CLI
**Inputs:** `scope.md`
**Outputs:** `architecture.md` + `test-plan.md`

Stack defaults (per CLAUDE.md):
- Frontend: Vite + React + TypeScript + shadcn/ui
- Auth: Supabase Auth (simple email/password for single user)
- DB + Storage: Supabase (hosted, not Docker)
- Hosting: Vercel (SPA + /api/ serverless functions)
- Image gen: fal.ai (img2img)
- Voice: OpenAI Whisper

Key things to design:
- **Data model:** `comic_books`, `pages`, `characters` tables — all scoped to single owner; `shares` table for public UUID links
- **RLS:** owner reads/writes everything; public viewers can only read via share token
- **AI pipeline:** page creation flow → photo upload → voice transcription → prompt assembly (character descriptions injected) → fal.ai call → panel storage → speech bubble compositing
- **Character library schema:** `characters(id, name, photo_url, description, style_notes)` — description is the stable prompt fragment injected into every generation
- **Speech bubble approach:** overlay rendered in-browser (canvas or CSS) on top of generated panel image, not baked into the AI generation (gives more control)
- **Voice playback:** store transcription text + use Web Speech API for TTS playback (no extra API needed)
- **Sharing:** `shares(id, uuid, comic_book_id, created_at)` — public route `/view/:uuid` with no auth

Done when: `architecture.md` covers all of the above and `test-plan.md` has a test per MVP behavior.

---

### agent 03 — adversarial review
**Tool:** Claude CLI
**Inputs:** `scope.md` + `architecture.md`
**Outputs:** Revised `architecture.md` (or list of issues to address)

Focus areas to stress-test:
- **Character drift:** is the character library injection sufficient to maintain consistency across pages? What happens on first page (no reference image yet)?
- **fal.ai latency:** img2img can be slow (5–15s). Does the UX handle this gracefully? Loading state for a child?
- **Mobile camera:** does the photo upload flow work well on iOS Safari? File input vs. camera capture?
- **Voice transcription on mobile:** mic permissions, short audio clips, background noise?
- **RLS edge cases:** can a public viewer accidentally trigger a write? Share token enumeration risk?
- **Speech bubble compositing:** canvas approach has gotchas (font rendering, image CORS). Is there a simpler path?

Done when: all issues are either resolved in architecture or explicitly accepted as known risks.

---

### agent 04 — builder
**Tool:** Claude Cowork (file I/O) + Claude CLI (git)
**Inputs:** `scope.md` + `architecture.md`
**Outputs:** Working codebase, deployed to dev

Build order (sub-sessions):

**04a — scaffold**
- Fork from `skunkworks/sentence-builder/` as baseline (Vite + React + TS + Tailwind already configured)
- Add shadcn/ui components
- Set up Supabase client
- Create `.env.example` + `.env`
- Supabase dev project created, linked
- Done: `npm run dev` runs without errors

**04b — auth + data layer**
- Supabase auth (email/password, single user)
- DB migrations: `comic_books`, `pages`, `characters`, `shares`
- RLS policies for all tables
- Basic React auth context
- Done: can log in, tables exist in Supabase, RLS verified

**04c — comic library + page layout**
- Comic book list / library screen (shadcn Cards)
- Create/delete comic book
- Comic book detail: page grid
- Add/reorder/delete pages
- Done: can create a comic book and manage pages (no content yet)

**04d — camera + voice capture**
- Photo capture (file input with `capture="environment"` for mobile camera)
- Upload to Supabase Storage
- Voice recording (MediaRecorder API)
- Whisper transcription via `/api/transcribe` serverless function
- Done: can photograph a drawing and get back transcribed text

**04e — AI generation pipeline**
- Character library UI: add character (photo + name + description)
- fal.ai img2img call via `/api/generate` serverless function
- Prompt assembly: base style prompt + character descriptions injected
- Generated panel stored to Supabase Storage
- Done: upload a drawing → get back an anime-style panel

**04f — speech bubbles + page composer**
- Canvas-based overlay for speech bubbles (positioned by child/parent)
- Narration bar at bottom of panel
- Voice playback of transcription text (Web Speech API)
- Done: page shows generated panel with editable speech bubbles and playback button

**04g — reader + sharing**
- Full-screen comic reader (swipe between pages)
- `shares` table + shareable link generation
- Public `/view/:uuid` route (no auth required)
- Done: can view comic full-screen and share a link that works without login

**04h — HANDOVER.md**
Per CLAUDE.md convention: write `HANDOVER.md` at project root before closing the build session. Cover live URL, GitHub repo, Vercel project, stack rationale, key patterns, non-goals, and anything that would trip up a cold session.
Add `HANDOVER.md` and `idea.md` to `.gitignore`.

---

### agent 05 — QA
**Tool:** Claude CLI
**Inputs:** `test-plan.md` + deployed dev URL
**Outputs:** QA report, bug list

Test focus:
- Full story loop on mobile (iOS Safari): photo → voice → generate → view → share
- Character consistency: add 2 characters, generate 3 pages, check style drift
- RLS: attempt write operations as unauthenticated user via share link
- Voice playback: does TTS play back correctly on mobile?
- Share link: verify works on a different device without login
- Edge cases: empty comic, page with no voice, very long narration

Done when: all test-plan cases pass or bugs are filed in Linear.

---

### agent 06 — deploy
**Tool:** Claude CLI
**Inputs:** Passing QA on dev
**Outputs:** Production deploy + verified

Steps (per CLAUDE.md deploy sequence):
1. Push DB migrations to prod Supabase project
2. Set prod env vars in Vercel (SUPABASE prod keys, fal.ai key, OpenAI key)
3. PR from `dev` → `main`, merge
4. Verify full story loop on prod URL
5. Share prod URL with Jake's kid for first real test

Domain: optional — can use Vercel subdomain for MVP, custom domain later.

Done when: the kid can use it on his own device.

---

### agent 07 — iteration
**Tool:** Claude Cowork (planning)
**Inputs:** Post-launch observations + kid feedback
**Outputs:** Updated `scope.md` with v2 features

Likely v2 candidates:
- Sound effects / background music per page
- More style options (not just DragonBall — Naruto, manga, etc.)
- Print/export comic as PDF
- Multiple characters per scene (currently designed for 2)
- Parent dashboard to see all comics
- Title page with kid-drawn cover art

Done when: v2 scope is prioritized and ready for a new loop.

---

## child UX principles (carry through all design decisions)

- **Voice-first everywhere** — no required typing. All text input via voice transcription.
- **Large tap targets** — minimum 48px, preferably larger. This is a phone app used by small fingers.
- **Instant feedback** — loading states must be clear and friendly. A spinner with a fun message ("turning your drawing into a superhero...") while fal.ai generates.
- **Playback on every page** — every page has a visible play button. Hearing his words read back is a feature, not an afterthought.
- **Celebration moments** — first comic created, first share sent. Small delights matter.
- **No dead ends** — every error state should have a clear, friendly recovery path (no raw error messages).

---

## file structure (target)

```
skunkworks/comic-book-app/
  PROJECT_PLAN.md         ← this file
  scope.md                ← Agent 01 output
  architecture.md         ← Agent 02 output
  test-plan.md            ← Agent 02 output
  HANDOVER.md             ← Agent 04h output (gitignored)
  idea.md                 ← (gitignored)
  src/
    components/
    pages/
    lib/
    hooks/
  api/
    transcribe.ts         ← Whisper serverless function
    generate.ts           ← fal.ai serverless function
  supabase/
    migrations/
  public/
  package.json
  vite.config.ts
  vercel.json             ← SPA catch-all rewrite required
  .env.example
  .gitignore
```

---

## env vars needed

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (serverless only, no VITE_ prefix) |
| `OPENAI_API_KEY` | Whisper transcription + GPT-4o narration enhancement |
| `FAL_API_KEY` | fal.ai image generation |

---

## linear

Create a parent issue in the **Foxricciardi** team: **"New project: Comic Book App"**
Child issues per agent (01–07). Status lifecycle: Backlog → In Progress → In Review → Done.
