# Hyperframes Composition Brief: GATE Mentor

## Objective
Create a short launch-style brag video for GATE Mentor.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `C:\Tanay\gate-mentor`
- Primary files read: `app/page.tsx`, `app/globals.css`, `app/layout.tsx`, `README.md`, `plan.md`
- Product name: GATE Mentor
- Tagline / strongest claim: STOP GUESSING. START KNOWING.
- Key UI or visual moment to recreate: hero command deck (telemetry strip + MAKE EVERY QUESTION COUNT® + red CTA row + hazard stripes), protocol triptych (attempt → mentor → retain), signal table rows
- Copy that must appear verbatim:
  - STOP GUESSING. / START KNOWING.
  - MAKE EVERY QUESTION COUNT®
  - PRACTICE PREVIOUS-YEAR QUESTIONS. GET STEP-BY-STEP EXPLANATIONS FROM A MENTOR THAT REMEMBERS YOUR CONTEXT.
  - ATTEMPT. MISS. PATCH. RETAIN.
  - GATE-MENTOR® /// FIELD MANUAL REV 2.6
  - 083+ PYQ UNITS. 08 SUBJECTS. 01 MENTOR.

## Creative Direction
- Tone preset: polished
- Creative direction: tactical field-manual product film — calm, precise, print-brutalist
- Interpretation: Fewer scenes with long holds; heavyweight uppercase display type with mono microcopy; slow 0.6s crossfades; restraint as confidence. No chaos, no parody winks.
- Angle: A tactical field-manual product film. The loop that cracks GATE: attempt with intent, understand every miss, retain what matters. Black CRT command deck, mono telemetry, red action bars, hazard stripes, scanlines.
- Hook: Full-screen black, scanlines on: "STOP GUESSING." holds, then red "START KNOWING." lands beneath.
- Outro / punchline: GATE-MENTOR® lockup + stat line + "OPEN THE QUESTION BANK +", held to black.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: #0A0A0A (dark CRT command deck)
- Text: #EAEAEA
- Accent: #FF2A2A (CRT red)
- Dim/line: #8F8F8F / #2B2B2B
- Success: #4AF626 (one Correct-state use)
- Display font: system sans, weight 900, uppercase, letter-spacing -0.045em (site uses Geist Black 900; composition uses local system stack to satisfy font lint)
- Body font: ui-monospace stack, uppercase, letter-spacing 0.08em
- Visual references from the project: telemetry strip (EXAM/MODE/BANK/LINK), red COUNT® block, hazard stripe bars, signal table, scanline/noise overlay, mono crosshair "+" corners

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 4s — STOP GUESSING. / START KNOWING. on black with scanlines
2. Reveal — 5s — hero command deck: telemetry strip + MAKE EVERY QUESTION COUNT® + CTA row
3. The loop — 7s — working-app triptych: attempt MCQ (cursor clicks B) → Mentor dissects miss → bookmark + weak-topic progress
4. Outro — 4s — signal-table fragment resolving to GATE-MENTOR® lockup + stats + CTA

## Audio
- Audio role: warm bed with sparse professional accents
- Audio arc: bed fades in under hook tension, settles into groove for reveal, lifts subtly under Mentor panel, fades under final logo
- Music: happy-beats-business-moves-vol-12-by-ende-dot-app.mp3 (steady and clean, ~110 BPM)
- Music treatment: start 0s, volume 0.30, fade-in 0.6s, fade out 18.5–20s
- Music cue guidance: bundled preset `happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json` (tempo ~110 BPM, beat spacing ~0.55s). Candidate strong cues in the 0–20s window: 8.74s, 9.29s, 10.93s, 13.11s, 17.47s, 18.56s. Suggested locks (each within ±0.15s, readability wins): Scene 3 start (~9s) toward 8.74s; Mentor payoff (~13s) toward 13.11s; Scene 4 lockup (~17s) toward 17.47s. Sequential telemetry/panel reveals snap to every other beat (≥1.1s apart). Or run `npx hyperframes beats` on the composition for a fresh grid.
- Audio-reactive treatment: subtle; RMS/bass breathes the hero glow + red COUNT® block presence and scanline warmth. No waveform/equalizer visuals, no strobing.
- Audio-coupled moments:
  - Scene 2 hero reveal — soft announcement tick when COUNT® block lands
  - Scene 3 attempt → result — cursor click on option B, card-place on result banner, short ticks as Mentor lines arrive, chip sound on bookmark toggle
  - Scene 4 outro — one dry logo hit under GATE-MENTOR® lockup
- SFX selection guidance: sparse polished set — interface/drop_* for panel arrivals, interface/click_* or ui/mouseclick1 for the simulated cursor click, impact/impactBell_heavy_000 for the final logo. Prefer low high-frequency-risk files for repeated moments; see `sfx-analysis.md` in the brag skill assets.
- SFX analysis guidance: `C:\Users\Rana Pratap\.agents\skills\brag\assets\sfx\sfx-analysis.md` (if present); prefer low/medium HF risk.
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copy the chosen music and any Hyperframes-selected SFX into `brag-output/composition/assets/`

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core` (composition contract + `data-*` timing), `hyperframes-animation` (motion), `hyperframes-creative` (design spec, beats, audio-reactive), `hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli` (lint/check/render). /brag is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Include the planned music/SFX layer unless audio was explicitly disabled or documented as intentionally silent.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Hyperframes decides exact animation timing and should ignore cues that hurt readability, scene pacing, or the product story.
- Major reveals may move toward nearby strong cues within about 0.15s. Smaller entrances may align to nearby beat points within about 0.10s. Use only 1-3 strong cue locks in a 15-25s video unless the edit clearly benefits from more.
- Use SFX to support motion and interaction: card sounds for card-like reveals, short announcement cues for major payoffs, key/click sounds for text or user actions, and restraint when the edit is already busy.
- Honor planned music treatment such as fade-outs, ducking, beat-aligned reveals, or letting a final SFX ring over the music, using the best Hyperframes-supported implementation.
- When music is present and the treatment is not `none`, consider Hyperframes audio-reactive workflow: extract audio data and use RMS/frequency bands for subtle, brand-specific motion. Good targets are glow, depth, background warmth, card presence, title emphasis, or other existing visual elements. Avoid waveform/equalizer visuals, musical-note graphics, generic particle systems, strobing, or heavy pulsing.
- Use local assets for audio and any required runtime/media dependencies when possible.
- Run `hyperframes check` before render — it is brag's single gate.
