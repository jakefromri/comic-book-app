# comic book app — adversarial review (agent 03)

> Stress-test of `scope.md` + `architecture.md`. Each issue is rated:
> **🔴 blocking** — must resolve before building or the app breaks
> **🟡 risk** — could fail in practice; needs a mitigation plan
> **🟢 accepted** — known limitation, consciously accepted for MVP

---

## 🔴 blocking issues

---

### B1 — MediaRecorder on iOS Safari does not output webm

**The problem:** The architecture says audio is sent as `webm/mp4` blob from `MediaRecorder`. On iOS Safari, `MediaRecorder` doesn't support webm at all — it outputs `.mp4` (AAC audio). On Android Chrome, it outputs `.webm`. Whisper accepts both, but the `Content-Type` header must be correct or Whisper returns a 400.

**Fix:** In the `VoiceRecorder` component, detect the supported MIME type at runtime:
```typescript
const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
  ? 'audio/webm' 
  : 'audio/mp4'
```
Send the detected MIME type as part of the multipart form or as a header. `/api/transcribe` passes it through to Whisper. Add this to the architecture spec and the `04d` sub-session checklist.

---

### B2 — Vercel Edge runtime can't run the fal.ai SDK

**The problem:** The architecture says "Edge runtime where possible" for serverless functions. The fal.ai JS client uses Node.js APIs (`Buffer`, `fetch` with node-specific options) that don't run on the Vercel Edge runtime. This will crash silently on deploy — Edge functions fail with no error in local dev.

**Fix:** `/api/generate.ts` must explicitly use Node.js runtime:
```typescript
export const config = { runtime: 'nodejs' }
```
`/api/transcribe.ts` (which uses the OpenAI SDK's file upload) also needs Node.js runtime for multipart form parsing. Only `/api/enhance.ts` (text in, text out) is safe on Edge. Update architecture to specify runtime per endpoint.

---

### B3 — Vercel serverless 4.5MB body limit breaks audio uploads

**The problem:** Vercel serverless functions have a 4.5MB default body size limit. A 30-second voice recording at typical MediaRecorder quality is 3–5MB. A child recording a long excited narration will hit this and get a silent failure — the function returns 413 and the UI likely shows nothing.

**Fix options (pick one):**
1. Cap recording at 20 seconds (reduces max file to ~2.5MB and keeps it under the limit)
2. Upload audio directly to Supabase Storage first, then pass the storage URL to `/api/transcribe`, which downloads it server-side for Whisper (bypasses body limit entirely; preferred)

Option 2 is cleaner. Update the pipeline: `VoiceRecorder → Supabase Storage (temp bucket) → /api/transcribe(url)`. Add a `temp-audio` Supabase Storage bucket (or reuse `drawings` with a temp prefix, cleaned up after transcription).

---

### B4 — private `drawings` bucket URL won't load in fal.ai

**The problem:** `/api/generate` sends `drawing_url` to fal.ai for img2img. The `drawings` bucket is private — Supabase Storage returns a signed URL with a short expiry. If the signed URL expires before fal.ai downloads it (which can happen if generation queues), the img2img call fails with a 403.

**Fix:** In `/api/generate`, generate a signed URL with a 5-minute TTL immediately before calling fal.ai. Or: download the drawing server-side and send it to fal.ai as a base64-encoded data URI or a multipart upload (fal.ai supports both). The download-then-encode approach is more reliable.

---

### B5 — `animagine-xl-3.1` may not support img2img

**The problem:** `fal-ai/animagine-xl-3.1` is a text-to-image model. Its img2img (image-to-image) capability isn't documented as a first-class feature on fal.ai. Using it with an `image_url` parameter may be silently ignored, producing text-to-image output (ignoring the child's drawing entirely).

**Fix:** Verify before building. The correct fal.ai models for img2img are:
- `fal-ai/stable-diffusion-xl/image-to-image` — reliable img2img, but less anime-specific
- `fal-ai/flux/dev/image-to-image` — high quality, slower, supports img2img
- `fal-ai/anime-style-transfer` — if it exists (verify on fal.ai model browser)

**Recommendation:** Use `fal-ai/flux/dev/image-to-image` with a strong anime/DragonBall LoRA prompt. More reliable img2img than animagine-xl-3.1, and higher quality output. Verify model availability before locking this in during Agent 04.

---

## 🟡 risks (mitigate before or during build)

---

### R1 — TTS (Web Speech API) requires a user gesture on iOS

**The problem:** `window.speechSynthesis.speak()` on iOS Safari requires the call to be made inside a user gesture handler (a direct tap). If TTS is triggered programmatically after an async operation, iOS will silently ignore it. This breaks any "auto-play narration when page loads" feature.

**Mitigation:** Always trigger TTS from a direct `onClick` handler. Never call it after an `await` or in a `useEffect`. The play button approach in the architecture is correct — just make sure no one wires up auto-play. Add this as a note in the `04f` sub-session.

---

### R2 — character prompt injection grows with library size

**The problem:** The architecture injects ALL characters into every generation prompt. A child who builds up 8–10 characters produces a very long prompt that eats into the `guidance_scale` effectiveness and may confuse the model into blending character descriptions.

**Mitigation:** Cap injected characters at 3–4 most recently used, or allow the child to "tag" which characters appear in a given scene (a simple multi-select with character portrait icons before generation). Tagging is more child-friendly and produces better output. Add a `characters_in_scene` field to the page generation step.

**Recommendation:** Implement character tagging in `04e`. It's a simple UI (tap character portraits to include) and meaningfully improves generation quality.

---

### R3 — fal.ai generation takes 10–20s — child will abandon

**The problem:** img2img generation with a quality model can take 10–20 seconds. For an adult this is fine. For a child who just finished recording excitedly, a 15-second blank wait with a spinner is an eternity. They'll tap something, break state, or lose interest.

**Mitigation:**
- Show a full-screen animated loading experience, not just a spinner — a fun animation of the drawing "transforming" (a CSS keyframe or a Lottie animation)
- Show rotating encouraging messages: "Powering up...!", "Adding the lightning bolts...", "Almost ready to fight!"
- Disable all interactive elements during generation to prevent state corruption
- If generation takes >20s, show a "still working on it..." message, not an error

Add to `04e` sub-session checklist.

---

### R4 — "show raw vs. enhanced" UX may confuse a child

**The problem:** Showing two versions of the transcription side by side assumes the child can read well enough to compare them. The scope says reading is limited.

**Mitigation:** Instead of a side-by-side comparison, use a two-step audio approach:
1. After transcription: "Here's what I heard" → play raw TTS
2. "Here's the superhero version" → play enhanced TTS
3. Big buttons: "Use it!" or "Try again"

No reading required. The child hears the difference and chooses. Update the `TranscriptionReview` component spec in architecture to reflect this audio-first comparison rather than text display.

---

### R5 — speech bubble drag-and-drop on iPad is finicky

**The problem:** Drag-and-drop using mouse events doesn't work reliably on iOS. Touch events are different (`touchstart`, `touchmove`, `touchend`). A library that doesn't specifically handle both will either not drag at all or have erratic behaviour on iPad.

**Mitigation:** Use `react-draggable` or `@dnd-kit/core` — both handle touch and mouse events. Don't roll a custom drag implementation. Test on actual iPad before declaring `04f` done.

---

### R6 — auto-save not defined in architecture

**The problem:** The architecture doesn't specify when page data is saved. If a child creates speech bubbles and closes the tab, what's persisted? If `speech_bubbles` is only saved on blur of a text field, moving bubbles without editing text loses positions.

**Mitigation:** Define an explicit auto-save strategy in `04f`:
- Save `speech_bubbles` JSON on every bubble position change (debounced 500ms)
- Save `narration_bar_text` on every keystroke (debounced 500ms)
- Show a subtle "Saved ✓" indicator so it's clear nothing is lost

---

### R7 — `cover_page_id` on `comic_books` creates a circular dependency

**The problem:** `comic_books.cover_page_id` is a FK to `pages(id)`, but pages reference `comic_book_id`. Creating a comic book before any pages exist means `cover_page_id` is null. Setting it later requires an UPDATE after page creation. It also creates a circular FK that complicates CASCADE behaviour.

**Mitigation:** Remove `cover_page_id` from the schema. Instead, derive the cover at query time: order pages by `page_order` ascending and take the first one with a non-null `panel_url`. This is a simple query and eliminates the circular dependency entirely.

---

### R8 — no cleanup of temp audio files in Supabase Storage

**The problem:** If audio is uploaded to Supabase Storage before transcription (per the fix for B3), those temp audio files accumulate forever. A prolific child could generate hundreds of audio files over time.

**Mitigation:** In `/api/transcribe`, after successful Whisper transcription, immediately delete the audio file from Storage using the service role key. If the transcription fails, still delete. Audio is never needed after the text is extracted.

---

## 🟢 accepted limitations (MVP)

---

### A1 — character consistency is best-effort, not guaranteed

fal.ai img2img guides style through the prompt, not a LoRA trained on the child's specific character. Two pages featuring "Kai" may look somewhat different. This is an accepted limitation — it's far better than no consistency at all. True consistency (training a LoRA on the character) is a v2 feature.

---

### A2 — no undo for deleted panels or pages

Deleting a page is permanent. Regenerating a panel overwrites the old one. For MVP this is acceptable — add a simple "Are you sure?" confirmation dialog and that's sufficient.

---

### A3 — Web Speech API voice quality is robotic

`window.speechSynthesis` uses the device's built-in TTS voice, which varies by device and can sound robotic. For MVP this is fine — it still enables the child to hear his narration. A higher-quality TTS (ElevenLabs, OpenAI TTS) is a v2 consideration.

---

### A4 — share link is permanent and unrevokable in MVP

Once shared, a link can be viewed forever. The owner can delete a comic book (which cascades to the shares table), but there's no "revoke link" feature. Accepted for MVP — grandparents don't need to be locked out.

---

## recommended architecture changes

Based on this review, these changes should be made to `architecture.md` before Agent 04 builds:

1. **B1** — Add MediaRecorder MIME type detection to `VoiceRecorder` spec
2. **B2** — Specify `runtime: 'nodejs'` for `/api/generate` and `/api/transcribe`; Edge only for `/api/enhance`
3. **B3** — Change audio flow: `VoiceRecorder → Supabase Storage (temp) → /api/transcribe(url)`; add cleanup step
4. **B4** — `/api/generate` must generate a fresh signed URL or encode drawing as base64 before calling fal.ai
5. **B5** — Switch from `animagine-xl-3.1` to `fal-ai/flux/dev/image-to-image`; verify model before `04e`
6. **R2** — Add character tagging to the page generation step (tap portraits to select who's in this scene)
7. **R4** — Replace side-by-side text comparison with audio-first comparison (play raw → play enhanced → choose)
8. **R7** — Remove `cover_page_id` column; derive cover from first page with panel at query time
9. **R6** — Add explicit auto-save spec to `PanelComposer` component (debounced 500ms)
10. **R5** — Specify `react-draggable` or `@dnd-kit/core` for speech bubble drag; test on real iPad
