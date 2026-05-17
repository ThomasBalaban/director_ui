# Vision Pipeline — Decision Doc

## What this doc is

Investigation and comparison of two vision-pipeline candidates for feeding
Nami's understanding of what's on screen, ending with a chosen direction.

1. **Current `vision_service`** — batch pattern: 6 frames + audio sent to
   `gemini-2.5-flash` every 2 seconds, response broadcast as discrete
   `vision_context` events on the hub.
2. **`vision_live_poc/`** — continuous streaming: video + audio streamed
   to `gemini-3.1-flash-live-preview` over a long-lived WebSocket, with a
   periodic "describe what you just saw" prompt every 4 seconds.

**TL;DR — decision reached:** Fix and keep `vision_service` as the
always-on pipeline. The POC is technically better in three ways
(working audio integration, lower latency, hour-long reliability) but
costs ~$30/hour at production usage — not viable for an always-on
personal-infrastructure setup. Keep the POC code as a reference, and as
a potential contingency if Live pricing drops or for short on-demand
"high-fidelity moment" hybrid use. See [Decision](#decision) and
[Recommended fix-and-keep work order](#recommended-fix-and-keep-work-order)
below for the concrete next steps.

---

## The investigation that led here (brief)

The original concern was that Nami's perception was unreliable — she'd
confidently address Otter about things he never said or did. Days of
testing produced consistently weird outputs from `vision_service`:
fabricated descriptions of *"a man with curly hair, wearing glasses, at a
multi-monitor setup with pink ambient lighting"* even when the gaming PC
was full-screening a third-party stream or a recognizable game.

That investigation produced a chain of "real bugs" — the dense-prose
prompt, the wrong audio device in `vision_service`, the disabled hub
transcript fallback, the audience-role gap on the director side. All of
those are still real problems. But the **dominant cause of the visible
hallucinations was much simpler**: `VIDEO_DEVICE_INDEX = 1` in
`vision_service/config.py` was the wrong device entirely. The capture card
was on index `2`. The service had been describing a different camera
(probably the laptop's facecam or a black/no-signal device) the whole
time, and the model was filling the gap with the highest-confidence
streaming-room prior it had.

Fixing one integer (`1` → `2`) in [`vision_service/config.py:44`](../vision_service/config.py#L44)
collapsed the visible "hallucination problem." The other bugs are still
worth fixing in their own right but are now secondary in priority order.

---

## The POC and what it demonstrated

Standalone tool at [`vision_live_poc/`](../vision_live_poc/). Streams
capture-card video (1 FPS) and capture-card audio (16 kHz mono PCM,
continuous) to Gemini Live, prompts every 4 seconds for a description,
saves all turns to a session JSON.

Three things had to be discovered along the way before it produced useful
output:

1. The Live API on this account requires `response_modalities=["AUDIO"]`;
   pure-TEXT mode is rejected with a 1011 error. Worked around with
   `output_audio_transcription` (text transcripts of the audio response).
2. Live's automatic VAD treats incoming game audio as "the user is
   speaking," interrupting the model mid-response. Had to disable VAD via
   `automatic_activity_detection(disabled=True)` and inject manual text
   prompts on a timer to actually get responses.
3. `session.receive()` returns an iterator that ends at each
   `turn_complete` boundary — has to be re-called for each subsequent turn
   in an outer loop.

Once those three architectural mismatches were worked around, the output
quality (with the same correct device index) is markedly higher than the
batch service was producing pre-fix. Excerpts from
[`vision_live_poc/sessions/session_20260515_224644_dense.json`](../vision_live_poc/sessions/session_20260515_224644_dense.json),
captured while watching a YouTube Subnautica commentary playthrough:

> *"The first-person gameplay continues as the player pilots a submersible
> through bright, sunlit tropical waters. The depth gauge rapidly changes
> from 14m to 3m as they glide upwards... The narrator delivers an
> energetically dramatic line: 'I will make this planet mine; I will rule
> this world!'"*

> *"The player, underwater at 105m, is abruptly attacked by a 'Sand shark'
> which lunges out of the darkness and shakes the camera violently...
> Immediately after, the video cuts to the player operating some kind of
> submersible vehicle, gliding gracefully over a shallow coral reef at
> only 8m depth..."*

> *"Overlaid on the view are multiple user interface elements, including
> circular depth gauges, a crosshair, and a critical alert in all caps:
> 'ENTERING ECOLOGICAL DEAD ZONE. ADDING REPORT TO PDA.'"*

Notable: correct game identification, accurate depth-meter readings, exact
narrator quotes, accurate scene transitions, and HUD text quoted verbatim.
Per-turn latency from prompt → response completion was typically 1-2s.

### Late finding: dedicated speech transcription works

Initial runs with VAD disabled produced occasional in-game voice-line
quotes but consistently empty `input_audio_transcription` (0 chars). With
VAD disabled, the API has no "user turn" concept and the dedicated STT
pipeline stays dormant — multimodal understanding catches isolated clear
voice lines, but mixed/layered content (streamer talking over game audio)
gets missed.

The fix turned out to be **VAD on + `activity_handling=NO_INTERRUPTION`**.
That combination enables the STT pipeline (so `input_audio_transcription`
fires) without letting detected speech interrupt the model mid-response.
After this change, runs reliably captured streamer commentary verbatim —
e.g. *"really? Where the flip are you aiming?"*, *"I've been in the
laboratory... There's the save area. This is where the monkeys ended up
getting released."*, *"body in a safe room is not the most ideal
situation"* (all from the 1-hour stress run on a Resident Evil 0 stream).
Each input transcript lands in a separate top-level `input_transcripts`
array in the session JSON with ISO timestamps.

This was the architectural unlock that made the POC genuinely usable for
"Nami listens to what's said on the stream" rather than just "Nami
sometimes catches a quoted dialogue line."

---

## Stress test — 1-hour reconnect run

After observing that Live's session cap hits around 9-10 minutes, the POC
was extended with an opt-in `--reconnect` flag that auto-reopens a new
session whenever Live ends one, up to a 1-hour wall-clock hard cap. Each
Live session writes its own JSON (`_part1.json`, `_part2.json`, ...) and
the aggregate is summed at the end.

**Run:** `python main.py --reconnect --duration 3600` against a
~1-hour streamed gameplay session.

**Result:**

| | |
|---|---|
| Total wall-clock | 3604s (60.1 min) — hit the cap precisely |
| Sessions completed | 7 (six full + one cap-truncated) |
| Per-session length | **543s exactly** for all six full sessions (Live's natural cap on this account, with one-second precision) |
| Reconnection gap | ~1 second between session end and next start |
| Errors / crashes | 0 |
| Frames sent | 3,575 |
| Audio chunks sent | 35,737 (100ms each = ~3,573s = full coverage) |
| Describe-prompts | 894 (~14.9/min) |
| Response lines | 3,291 |
| Input-audio transcripts | 357 (~5.94/min) |
| Input transcript chars | 18,407 (~306/min) |

**What this proves:**

- The reconnect-loop pattern is reliable for production-length runs.
  Seven consecutive Live sessions with no human intervention, no errors,
  no drops.
- The pipeline is steady throughout the hour — per-session counts for
  frames, audio, and prompts are essentially identical across all six
  full sessions, with no degradation as time progressed.
- The natural Live session cap is a hard **~543 seconds** on this
  account (much shorter than the 10-15 min initially documented). A
  multi-hour stream needs ~6-7 reconnections per hour. The protocol
  requires the client to close on `go_away` (the warning the server
  sends before disconnect) — otherwise the server force-disconnects with
  a 1008 policy violation. The POC now handles this cleanly.
- Audio transcription stayed sharp the entire run, with the model
  capturing the streamer's voice late in session 7 just as reliably as
  in session 1.

**What it cost:**

Approximately **$30/hour** measured against Google Cloud billing for
the run above. Multiply by typical stream length:

| Stream length | Approx Live cost |
|---|---|
| 1 hour | ~$30 |
| 3 hours | ~$90 |
| 4 hours | ~$120 |
| 7 streams/week × 3h | ~$630/week → ~$32k/year |

For a hobbyist personal-infra setup, this is **not financially viable**
as the always-on vision pipeline. The cost dominates every other
consideration: the quality wins (native audio integration, native
multimodal correlation, low latency) cannot justify a price tag in this
range for continuous-use scenarios.

The cost calculus would change if:
- Google reduces Live API pricing (possible — it's still preview-tier)
- The model is downgraded to a cheaper Live variant (none currently
  available on this account)
- Live is used selectively for short bursts rather than continuously
  (the hybrid pattern — see "Decision" section)

---

## Comparison data — pending

To make this a real decision, both pipelines need to be observed against
**the same content** for at least 30 seconds and ideally a few minutes.
Vision_service logs to be pasted in below by the operator.

### vision_service sample output (30 seconds)

Same gaming PC feed (YouTube Subnautica playthrough, with an ad break and
transitioning to a Genshin Impact video by the end). vision_service is
post-device-fix (now reading `VIDEO_DEVICE_INDEX = 2`).

```
22:49:46  Across the frames, the user is watching a YouTube video displaying
gameplay from Subnautica. The primary action within the game is the player
character actively scanning a large, translucent, alien creature... The
creature, initially pulsating with an internal orange-red glow, gradually
shifts to a more defined blue-purple hue as the scanning process progresses...
the depth indicator in the top-center of the game UI consistently increases,
starting at 223m and reaching 227m by the final frame... In the final frames,
the scan successfully completes, and the name "Warper" appears above the
creature, signifying its identification. The audio perfectly complements the
visual action, featuring a continuous, high-pitched whirring sound effect
that persists throughout the scanning process, culminating in a clear, soft
chime sound effect that indicates the successful completion of the scan.

22:49:46  Across the frames, the vehicle is slowly descending, indicated by
the top-center UI element showing the depth changing from 195 meters to 194
meters, then to 192 meters, approaching a 200-meter limit. Concurrently,
the temperature display in the bottom-right UI decreases from 15°C to 14°C...
*(No audio was provided for this analysis. If audio were present, I would
expect to hear the hum of the underwater vehicle...)*

22:49:54  Across the frames, the user is watching a YouTube video of
Subnautica gameplay. The video rapidly transitions from a bright,
terrestrial-like environment to a dark, deep-sea alien landscape...
The depth indicator now reads "242m"...

22:50:02  Across the frames, the user is actively viewing a YouTube video
that showcases gameplay from the game Subnautica... The YouTube interface
is fully visible, with the video title "So I lost my mind deep in
Subnautica..." and the channel name "Jaayy X"... No audio was provided,
so the specific sound effects or music accompanying these visual events
cannot be described.

22:50:12  Across the initial frames, the screen displays a YouTube video
player in dark mode, showing a paused or interrupted gameplay segment from
Subnautica... Dominating the center of the video player is a large "ad
break" text overlay. As the frames progress, the "ad break" text abruptly
disappears, and the video content instantly transitions from the
Subnautica gameplay to an animated advertisement.

22:50:20  Across the frames, the user is watching a YouTube video that
displays various overlays on top of active video game footage, likely
Genshin Impact... Game UI elements like an "Opponent's Defeated" message
and a timer (showing "05:20") are visible...

22:50:20  Throughout these visual transitions and overlays, the audio
maintains a consistent, upbeat, and energetic musical track, characteristic
of video game background music or a fast-paced commentary/review video.

22:50:31  ...The audio likely transitions from a calm, possibly ambient
game score in the initial frames to a sudden, dramatic sting or deep
rumble accompanying the monster's emergence...
```

### vision_live_poc sample output

[`session_20260515_224644_dense.json`](../vision_live_poc/sessions/session_20260515_224644_dense.json)
— 24 turns over 105s of a YouTube Subnautica playthrough. Sample excerpts
above.

---

## Head-to-head evaluation

Both samples observed against similar content (a YouTube Subnautica
playthrough; vision_service also caught an ad break and the start of a
Genshin Impact video). Judgments are qualitative, scored against
each other not against a perfect baseline.

| Dimension | vision_service (batch) | vision_live_poc (Live) | Notes |
|---|---|---|---|
| **Visual accuracy** | ✅ Good | ✅ Good | Both correctly identify Subnautica, Genshin, characters, environments. Tie. |
| **HUD / text extraction** | ✅ Excellent | ✅ Excellent | vision_service: depth meters (223m→227m, 195→194→192, 242m), creature name "Warper", gauge "135", temperature 15°C→14°C, channel "Jaayy X", "Opponent's Defeated", timer "05:20". POC: depth gauges, "SEARCHING", "Seamoth fragment", "ENTERING ECOLOGICAL DEAD ZONE", trophy text. Both read pixel text reliably. Tie. |
| **Audio integration** | ❌ Broken (and dishonest about it) | ✅ Working | The big one. vision_service does three things in 30s: (1) fabricates plausible audio from visual cues (*"high-pitched whirring sound effect... clear, soft chime"* for a scanning animation), (2) admits *"No audio was provided"*, (3) speculates with weasel-words (*"the audio likely transitions to a dramatic sting"*). The pyaudio default-device bug means the audio channel is silent or wrong; the model fills the gap. POC quotes the narrator verbatim (*"I will make this planet mine; I will rule this world!"*) — that cannot come from visual inference. POC is genuinely hearing the stream. |
| **Hallucination rate** | ✅ Low (visual) / ❌ High (audio) | ✅ Low | Post-device-fix, visual hallucinations are mostly gone for both. vision_service still hallucinates audio confidently. POC has not been observed inventing audio in available samples. |
| **Latency** | ⚠️ ~5-10s between batches in sample | ✅ 1-2s per turn | vision_service batches arrive irregularly (5-10s gaps in the sample, with 2 batches sometimes dispatched within the same second then a long gap). POC turns are paced at the 4s describe-interval with sub-2s response. POC latency is more predictable. |
| **Cadence** | Variable, ~6-8 events / 30s | Steady, ~7-8 events / 30s | Comparable raw event rate. vision_service occasionally fires duplicate-ish batches in close succession (the "two events at 22:49:46" pattern). POC's cadence is governed by the describe-interval and is consistently spaced. |
| **Granularity** | ⚠️ Too dense | ✅ Right-sized | vision_service paragraphs are 200-400 words each — a lot of prose for downstream parsing. POC paragraphs are ~100-150 words covering the most-recent few seconds. POC is closer to "what a downstream LLM can act on" granularity. |
| **Stability** | ✅ High | ✅ High (with `--reconnect`) | vision_service's stateless calls tolerate individual failures gracefully. POC: the 1-hour stress test with auto-reconnect produced 7 consecutive successful Live sessions across 60.1 minutes with zero errors. Live's session cap is a hard ~543s on this account; reconnection gap is ~1s. The stress test resolved the earlier "single point of failure" risk. |
| **Architectural fit** | ✅ Already wired | ❌ Not wired yet | vision_service is plugged into the hub, scoring, scene_manager, correlation_engine. POC writes to console + JSON only; integration into director_engine is its own project. |
| **Operating cost** | ✅ Predictable per-call (well under $1/hr at current usage) | ❌ ~$30/hr measured | The decisive factor for the personal-infra deployment. vision_service is metered per-batch token cost — cheap. POC is metered by streaming time, video frames, audio chunks, AND the discarded synthesized audio output we pay for but throw away. The 1-hour stress run came out to roughly $30 in Google Cloud billing. At typical stream length (3-4 hours, multiple times per week), this is not viable as the always-on pipeline. |

---

## Benefits & risks per candidate

### vision_service (current, post-device-fix)

**Benefits**
- Already wired into the director engine (hub broadcast, event scoring,
  scene_manager, correlation_engine all consume `vision_context` events)
- Stateless calls — no session lifecycle, no reconnection logic
- Clean per-event boundary that the rest of the engine is built around
- Predictable per-call cost
- Easy to A/B test prompts or swap models — call shape is simple
- Failures are reproducible (replay a single batch through the model)

**Risks / known issues remaining**
- The dense-prose prompt still encourages confabulation. With the right
  device, hallucinations are dramatically reduced, but the prompt is still
  built around "pack as much specific detail as possible" with no escape
  valve for "I don't see X." Worth rewriting toward structured extraction.
- Audio source is still wrong: pyaudio default device, not capture card.
  See [`vision_service/audio_capture.py:32-36`](../vision_service/audio_capture.py#L32-L36).
  Either point pyaudio at the right device or re-enable the disabled hub
  `ambient_audio` transcript path in
  [`streaming_manager.add_transcript`](../vision_service/streaming_manager.py#L71-L74).
- No frame-diff filter — every batch goes through even when the screen is
  static, producing the duplicate-paraphrase problem (4 near-identical
  descriptions per timestamp seen in earlier tests).
- Polling cadence is fundamentally a workaround for not having continuous
  understanding — temporal reasoning across batches is reconstructed by
  the model from re-uploaded snapshots rather than maintained server-side.

### vision_live_poc (Gemini Live)

**Benefits**
- Truly continuous video + audio in. The model maintains temporal context
  server-side; doesn't have to reconstruct motion from re-sent frames.
- Capture-card audio is correctly wired (sounddevice on the right device).
  POC outputs accurately quote narrators and reference audio cues — the
  vision_service audio bug is irrelevant in this architecture.
- **Dedicated speech transcription works** (with VAD on +
  `NO_INTERRUPTION`). The streamer's voice, game NPC dialogue, and
  video-overlay narration all land as separate `input_transcripts`
  entries alongside the model's per-turn descriptions. Per the 1-hour
  stress run, ~6 transcripts/min, ~300 chars/min of mic-side speech.
- Lower per-event latency. Sample runs: 1-2s from describe-prompt to
  response complete, vs 2s+ batch overhead before any inference.
- Higher fidelity outputs — exact narrator quotes, exact HUD numbers,
  exact game names, accurate scene transition descriptions.
- Reliable over production-length runs: 7 consecutive Live sessions in
  the 1-hour stress test with zero errors and no quality degradation.

**Risks**
- **Cost: ~$30/hour measured.** The single biggest blocker. At typical
  stream length (3-4 hours, multiple sessions/week) this is not
  financially viable as an always-on pipeline on personal infrastructure.
  See "Stress test" section for the math.
- **Architectural mismatch.** Live is a conversational API. We're using
  it for non-conversational continuous observation by configuring
  `NO_INTERRUPTION` activity handling and injecting periodic prompts.
  That works but isn't what the API is designed for. Future API changes
  could regress the workaround.
- **Session length cap.** ~543s per Live session (measured) before
  `go_away`. Handled cleanly with auto-reconnect, but each reconnect
  loses any in-session context the model had built up — the model
  starts fresh, no memory of what was seen/heard in prior sessions.
- **No TEXT-only mode.** Account requires `AUDIO` output. We use
  `output_audio_transcription` to get text, but the model also generates
  spoken audio bytes that we discard. That audio synthesis still costs
  tokens — a meaningful share of the $30/hour bill.
- **Periodic-prompt hack** is fragile. Picking the right interval is a
  tuning problem — too short and we get noise, too long and we miss
  moments. The current 4s interval is arbitrary.
- **Doesn't yet broadcast to the hub.** The POC writes to console + JSON.
  Wiring it into the director engine event pipeline is a separate piece
  of work — the per-event abstraction has to be redefined since Live
  doesn't have natural batch boundaries (each "event" would be one
  describe-prompt's response).
- **No frame-diff filter** — sends every captured frame at 1 FPS even
  when static. Less of a problem than for batch since per-frame cost is
  amortized into the streaming-time meter, but still wasteful.
- **Structured-output prompt drifts.** The dense prompt produces
  beautiful prose; the structured prompt (return JSON, null on unknown)
  has been observed drifting back to narration partway through a
  response. Live's natural mode is conversation, not extraction.

---

## What the head-to-head actually shows

After the device fix, **the two pipelines are roughly equivalent on
visual extraction.** Both reliably read HUDs, identify games, transcribe
on-screen text, and describe scene transitions.

The POC is **technically superior** in three meaningful ways:
- Audio integration genuinely works (dedicated STT + multimodal voice
  characterization)
- Per-event latency is lower (1-2s vs 5-10s)
- It's reliable over hour-long runs (stress test verified)

But it costs **~$30/hour**, which is the decisive disqualifier for
always-on personal-infrastructure use. The quality wins are real and the
1-hour stress test proves the architecture is robust enough for
production, but the price tag rules out using Live as the default
vision pipeline.

## Decision

**Fix and keep `vision_service`** as the always-on vision pipeline.

The post-device-fix vision_service is closer to "good enough" than it
was assumed to be before this investigation, and the remaining gaps
(audio routing, prompt density, frame-diff) are all small contained
fixes inside a service that's already wired into the rest of the engine.
The Live POC validated *what's possible* but priced itself out of being
the default.

**Keep the POC code as a reference and a contingency option** for two
scenarios:
1. **Gemini Live pricing changes.** If Google lowers Live API pricing
   into the few-cents-per-hour range, the calculus flips and porting
   becomes attractive. The POC is the migration starting point.
2. **Hybrid bursts.** Triggering a short Live session (~30-60s) on
   demand for specific moments — a boss fight, a key dialogue scene,
   a major game event — costs cents instead of dollars. If
   vision_service+fixes can flag "this moment matters," Live can be
   summoned for high-fidelity capture only when needed. Not in scope
   for the immediate work but worth keeping in mind.

## Recommended fix-and-keep work order

In rough priority. Each item is contained inside `vision_service`.

1. **Re-enable hub `ambient_audio` transcripts** in
   [`streaming_manager.add_transcript`](../vision_service/streaming_manager.py#L71-L74).
   This eliminates the worst current behavior (the model fabricating
   audio descriptions from visual cues when its actual audio source is
   silent). The dedicated `stream_audio_service` already produces clean
   STT — wire it back in. ~10 lines.
2. **Rewrite the prompt for honest extraction.**
   ([`vision_service/config.py:61-80`](../vision_service/config.py#L61-L80))
   The current dense-prose prompt with the "sci-fi soldier" example is
   the proximate cause of fabricated narrative output. Replace with a
   structured-extraction style prompt that includes explicit
   *"if you don't observe X, return null; do not infer audio from
   visual cues"* instructions. Drop the toxic example.
3. **Fix the pyaudio device source** in
   [`vision_service/audio_capture.py:32-36`](../vision_service/audio_capture.py#L32-L36)
   — or simply delete `audio_capture.py` and rely entirely on the
   hub `ambient_audio` path (step 1). The local capture is a remnant
   of an earlier architecture and is the source of the audio bug
   regardless.
4. **Add a frame-diff pre-filter** in
   [`streaming_manager._dispatch_loop`](../vision_service/streaming_manager.py#L142-L170).
   Perceptual hash on each frame; if it matches the last dispatched
   frame, skip the batch and emit a cheap "no visual change" event.
   Solves the duplicate-paraphrase artifact and reduces API spend
   on static screens.

After steps 1-3, the audio-integration gap with Live should close
substantially (you trade native voice characterization for clean
transcribed dialogue, which is the more important capability for
Nami's purposes). Step 4 is a quality-of-life optimization.

---

## Pending follow-ups (not blocking the decision)

These are real and tracked but not in scope for the vision/Live decision
itself:

- **Audio routing audit** — `vision_service`'s pyaudio bug, plus
  end-to-end trace from OS audio capture through to the events the
  director receives, to confirm `stream_audio_service` is doing what we
  think it is
- **Speaker attribution** — every voice still collapses to *"Unknown
  Speaker"* in `stream_audio_service` / `microphone_audio_service`,
  causing director-side mis-attribution of third-party affect
- **Audience-role gap** — director engine has no concept of "we are
  observing, not participating." Even with perfect upstream, Nami
  addresses Otter as the subject of every captured utterance. Fix lives
  in director_engine, not upstream.
- **Operator-context lock bug** — fixed in this session (see
  `shared.py` persistence + sensor_bridge handlers + UI localStorage)
