# comic book app — scope

## one-liner
A voice-first web app where a kid photographs his drawings, narrates the action by voice, and watches them transform into anime-style comic panels he can share with family.

## problem
A child with a love of drawing and storytelling — but limited reading and writing ability — has no good way to turn his art into a shareable, polished comic book. The gap between "drawing on paper" and "finished comic" is too high to cross without a keyboard. This app closes that gap entirely through voice and a camera.

---

## MVP scope

- **Login** — single account (email + password), no signup flow needed; account pre-created
- **Comic book library** — create, rename, and delete comic books; each has a title and cover (auto-set to first page)
- **Page management** — add pages to a comic, reorder via drag, delete pages
- **Photo capture** — per page, take a photo of a drawing using the device camera (mobile-first)
- **Voice narration** — record voice to describe what's happening; plays back transcribed text
- **AI panel generation** — drawing + narration + character descriptions → fal.ai img2img → Dragon Ball Z–style anime panel
- **Character library** — add named characters (photo + short description); character descriptions are injected into every generation prompt to maintain style consistency
- **Voice enhancement** — after Whisper transcription, an AI pass (GPT-4o) cleans and completes the child's narration: fixes fragmented thoughts, fills in implied words, and sharpens the storytelling while preserving his voice and intent
- **Speech bubbles** — add text speech bubbles to the generated panel (positioned by tapping); text sourced from the enhanced transcription; editable after placement
- **Narration bar** — optional caption bar at bottom of panel (auto-populated from enhanced transcription)
- **Voice playback** — play button on every page reads the narration aloud (Web Speech API TTS)
- **Full-screen reader** — swipe through pages of a comic in full-screen view
- **Shareable link** — generate a public UUID link to a comic; anyone can view without logging in

---

## out of scope (MVP)

- Multiple user accounts or kids
- Sound effects or background music
- Print / PDF export
- Multiple art styles (MVP is DragonBall/anime only)
- Animation or video export
- Comments on shared comics
- Cover art / title page editor
- Parent dashboard or notifications
- Offline mode
- Character-to-character interaction poses (AI doesn't guarantee two specific characters interact — that's a v2 problem)

---

## user roles

| Role | Description |
|------|-------------|
| `owner` | The child. Authenticated via email + password. Full read/write access to all comics, pages, characters. |
| `viewer` | Anyone with a share link. No authentication. Read-only access to a single shared comic via UUID. |

No superadmin or multi-tenant structure needed — this is a single-user app.

---

## tenancy model

Single tenant. One Supabase project, one user account, no tenant isolation needed. All data is owned by the single `owner` account. RLS policies restrict writes to the authenticated user; reads on shared comics are allowed via share token lookup.

---

## explicit behaviors

### the system will:
- Allow the owner to create as many comic books as they want
- Require a photo before voice narration or generation can proceed on a page
- Allow voice narration to be re-recorded on any page (replaces previous transcription)
- Allow generation to be re-triggered on any page (replaces previous panel)
- Inject all characters from the character library into every generation prompt (not just characters "assigned" to a page — keeps style consistent)
- Store both the original drawing and the generated panel for each page
- Allow speech bubbles to be repositioned or deleted after placement
- Allow speech bubble and narration bar text to be edited after the AI enhancement pass
- Show the child both the raw transcription and the enhanced version before committing (so he can hear what changed)
- Make share links permanent (not expiring in MVP)
- Work responsively across tablet (primary) and phone — portrait and landscape both supported

### the system will NOT:
- Allow unauthenticated users to create, edit, or delete anything
- Generate panels without a photo (transcription-only generation not supported)
- Allow the owner to invite other editors
- Store voice recordings — only the transcribed text is persisted
- Guarantee specific character interactions or poses (fal.ai img2img guides style, not exact composition)
- Support multi-user accounts or collaboration

---

## open questions (resolved)

| Question | Decision |
|----------|----------|
| Auth approach | Simple Supabase email/password. Single account pre-created by Jake. No signup UI needed. |
| Is character library MVP? | Yes. Without it, style drifts badly across pages. It's core to the "it actually works" bar. |
| Speech bubble input | Voice → Whisper transcription → GPT-4o enhancement pass → editable text. Child sees both raw and enhanced before confirming. |
| Share link expiry | No expiry in MVP. Permanent links. |
| Art style | Dragon Ball Z / anime only for MVP. Style selector is a v2 feature. |
| Multi-character scenes | Best-effort — all characters injected into prompt, but no guarantee of composition. Accepted limitation. |
| Layout | Responsive — tablet primary (landscape + portrait), phone secondary. |

---

## linear

**Create:** Parent issue in **Foxricciardi** team — "New project: Comic Book App" (Backlog)
**Child issues to create:**
- Agent 02: Architecture
- Agent 03: Adversarial review
- Agent 04: Build (sub-issues per sub-session: 04a–04h)
- Agent 05: QA
- Agent 06: Deploy
- Agent 07: Iteration planning
