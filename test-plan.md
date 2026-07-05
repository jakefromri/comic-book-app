# comic book app — test plan

> Agent 05 (QA) runs these tests against the deployed dev environment.
> Each test lists: what's being tested, setup, action, expected result.

---

## auth

### T01 — login with valid credentials
- **Setup**: Account exists in Supabase
- **Action**: Enter correct email + password, tap login
- **Expected**: Redirected to `/` (library); session persists on refresh

### T02 — login with invalid credentials
- **Setup**: Account exists
- **Action**: Enter wrong password, tap login
- **Expected**: Friendly error message shown; no redirect; no crash

### T03 — protected route redirect
- **Setup**: Not logged in
- **Action**: Navigate directly to `/`
- **Expected**: Redirected to `/login`

### T04 — session persistence
- **Setup**: Logged in
- **Action**: Close and reopen the browser tab
- **Expected**: Still logged in; no re-login required

---

## comic book library

### T05 — create a comic book
- **Setup**: Logged in, on library page
- **Action**: Tap "New Comic", enter a title, confirm
- **Expected**: New comic appears in library grid with title and placeholder cover

### T06 — rename a comic book
- **Setup**: At least one comic exists
- **Action**: Tap rename on a comic, change title
- **Expected**: Title updates in the grid

### T07 — delete a comic book
- **Setup**: At least one comic exists
- **Action**: Tap delete on a comic, confirm
- **Expected**: Comic removed from grid; all its pages deleted from DB and storage

### T08 — empty library state
- **Setup**: No comics exist
- **Action**: View library page
- **Expected**: Friendly empty state with clear call-to-action to create first comic

---

## page management

### T09 — add a page to a comic
- **Setup**: Comic exists with zero pages
- **Action**: Tap "Add Page" inside a comic
- **Expected**: New blank page appears in the page grid

### T10 — reorder pages
- **Setup**: Comic with 3+ pages
- **Action**: Drag a page to a new position
- **Expected**: Page order updates; `page_order` column updated in DB

### T11 — delete a page
- **Setup**: Comic with 2+ pages
- **Action**: Delete a page
- **Expected**: Page removed; drawing and panel images deleted from Supabase Storage

### T12 — cover auto-sets to first page
- **Setup**: Comic with pages, first page has a panel
- **Action**: View library grid
- **Expected**: Comic card shows first page's panel as cover image

---

## photo capture

### T13 — take a photo (mobile)
- **Setup**: On page editor, no drawing yet; using mobile browser
- **Action**: Tap camera button; take a photo
- **Expected**: Photo preview appears in the editor; `drawing_url` saved to DB

### T14 — re-take a photo
- **Setup**: Page with existing drawing
- **Action**: Tap camera button again; take a new photo
- **Expected**: New photo replaces old; old file deleted from Storage; panel_url cleared (page needs regeneration)

### T15 — file upload fallback (desktop)
- **Setup**: On desktop browser; on page editor
- **Action**: Tap camera button; select an image file from disk
- **Expected**: Image appears as drawing preview

---

## voice narration pipeline

### T16 — record and transcribe voice
- **Setup**: Page has a drawing; mic permission granted
- **Action**: Hold record button; speak for ~5 seconds; release
- **Expected**: Waveform animates during recording; "Transcribing..." state shown; raw transcription appears

### T17 — transcription review shows both versions
- **Setup**: Voice recording just completed
- **Action**: View the transcription review step
- **Expected**: Raw transcription and GPT-4o enhanced version shown side by side; both are readable

### T18 — enhanced narration preserves intent
- **Setup**: Record a short, fragmented narration ("and then he like... punches the guy real hard and wins")
- **Action**: Complete transcription + enhancement
- **Expected**: Enhanced version is grammatically complete, exciting, and matches the described action — does not invent new plot points

### T19 — re-record voice
- **Setup**: Transcription review step visible
- **Action**: Tap "Re-record"
- **Expected**: Returns to recording state; previous transcription cleared; new recording starts fresh

### T20 — confirm enhanced narration
- **Setup**: Transcription review visible
- **Action**: Tap "Looks good!"
- **Expected**: `enhanced_narration` saved to DB; flow proceeds to generation step

---

## AI panel generation

### T21 — generate a panel
- **Setup**: Page has drawing + confirmed enhanced narration; characters exist in library
- **Action**: Tap "Generate Panel"
- **Expected**: Loading state with friendly message; panel image appears within 15s; `panel_url` saved to DB; panel is anime-style

### T22 — character descriptions injected
- **Setup**: 2 characters defined in library; generate a panel
- **Action**: Inspect the generated panel
- **Expected**: Visual style is consistent with character descriptions (best-effort; not pixel-perfect)

### T23 — regenerate a panel
- **Setup**: Page already has a generated panel
- **Action**: Tap "Regenerate"
- **Expected**: New panel generated; old panel file deleted from Storage; new panel displayed

### T24 — generation without characters
- **Setup**: Character library is empty; page has drawing + narration
- **Action**: Generate panel
- **Expected**: Generation still succeeds with generic anime style; no error

---

## speech bubbles and narration bar

### T25 — add a speech bubble
- **Setup**: Panel generated; in page composer view
- **Action**: Tap "Add Bubble" then tap a position on the panel
- **Expected**: Speech bubble appears at tapped position with placeholder text

### T26 — edit speech bubble text
- **Setup**: Speech bubble exists
- **Action**: Tap bubble; edit text
- **Expected**: Text updates in the bubble; `speech_bubbles` JSON saved to DB on blur

### T27 — move a speech bubble
- **Setup**: Speech bubble exists
- **Action**: Drag bubble to new position
- **Expected**: Bubble moves; position saved to DB

### T28 — delete a speech bubble
- **Setup**: Speech bubble exists
- **Action**: Tap bubble; tap delete
- **Expected**: Bubble removed from panel

### T29 — narration bar text
- **Setup**: Enhanced narration confirmed; panel generated
- **Action**: View page composer
- **Expected**: Narration bar pre-filled with `enhanced_narration`; text is editable

---

## voice playback

### T30 — play narration TTS
- **Setup**: Page has `enhanced_narration` text
- **Action**: Tap play button
- **Expected**: Device reads narration aloud via Web Speech API; button shows playing state

### T31 — playback in reader view
- **Setup**: Comic with 2+ complete pages; in full-screen reader
- **Action**: Tap play on a page
- **Expected**: TTS plays for that page's narration; stops when done or tapped again

---

## character library

### T32 — add a character
- **Setup**: On character library page
- **Action**: Tap "Add Character"; enter name, photo, description; save
- **Expected**: Character appears in library; `characters` row created in DB

### T33 — character description carries forward
- **Setup**: Character defined with a specific visual description; generate a panel on any page
- **Action**: Check generation prompt (can verify via API logs or by inspecting the network call)
- **Expected**: Character description is included in the fal.ai prompt

### T34 — edit a character
- **Setup**: Character exists
- **Action**: Edit character description
- **Expected**: New description used in all subsequent panel generations (not retroactive)

### T35 — delete a character
- **Setup**: Character exists
- **Action**: Delete character
- **Expected**: Character removed; does not affect already-generated panels

---

## full-screen reader

### T36 — open comic in reader
- **Setup**: Comic with 3 complete pages (panels + narration)
- **Action**: Tap "Read" on a comic from the library
- **Expected**: Full-screen reader opens; shows first page panel

### T37 — swipe between pages
- **Setup**: In reader with 3+ pages
- **Action**: Swipe left/right
- **Expected**: Pages advance/retreat; panel images load; narration bar and speech bubbles visible

### T38 — play button visible in reader
- **Setup**: In reader
- **Action**: View any page
- **Expected**: Play button visible; tapping plays TTS for that page's narration

---

## sharing

### T39 — generate a share link
- **Setup**: Comic with at least 1 complete page
- **Action**: Tap "Share" on a comic; tap "Create Link"
- **Expected**: UUID share token created; copyable link displayed

### T40 — share link works without login
- **Setup**: Share link generated
- **Action**: Open share link in a browser where user is NOT logged in (incognito)
- **Expected**: Comic reader loads with all pages, panels, narration bars, speech bubbles visible

### T41 — share link does not expose drawings
- **Setup**: Share link opened in incognito
- **Action**: Inspect network calls
- **Expected**: Only `panels` bucket URLs are loaded; no `drawings` bucket URLs are accessible

### T42 — share viewer cannot write
- **Setup**: Share link opened; know the page ID
- **Action**: Attempt a direct Supabase REST call (PATCH /pages/:id) with no auth
- **Expected**: 401 or 403 — RLS blocks unauthenticated writes

---

## responsive layout

### T43 — tablet portrait layout
- **Setup**: iPad in portrait mode
- **Action**: Navigate through library, comic editor, page editor
- **Expected**: Panel fills most of viewport; controls below; all tap targets ≥56px

### T44 — tablet landscape layout
- **Setup**: iPad in landscape mode
- **Action**: Open page editor with a generated panel
- **Expected**: Panel on left (~60% width); controls on right; speech bubbles correctly positioned

### T45 — phone portrait layout
- **Setup**: iPhone in portrait
- **Action**: Navigate through app
- **Expected**: No horizontal scroll; text readable; tap targets accessible; recording button prominent

---

## error and edge cases

### T46 — mic permission denied
- **Setup**: Browser with mic permission blocked
- **Action**: Tap record button
- **Expected**: Friendly message explaining mic is needed; no crash; option to proceed with text input

### T47 — fal.ai generation timeout
- **Setup**: Simulate slow network (DevTools throttle)
- **Action**: Trigger panel generation
- **Expected**: Loading state persists; times out gracefully after 30s with retry option; no blank panel saved

### T48 — page with no panel on share link
- **Setup**: Share link for a comic where one page has a drawing but no generated panel
- **Action**: Open share link
- **Expected**: Page shows placeholder instead of panel; app doesn't crash; other pages render fine

### T49 — invalid share token
- **Setup**: Navigate to `/view/not-a-real-token`
- **Action**: View page
- **Expected**: Friendly 404 message; link back to home

### T50 — very long narration input
- **Setup**: Record 30 seconds of narration
- **Action**: Transcribe + enhance
- **Expected**: Transcription succeeds; enhancement trims to 2–3 sentences max; no truncation error
