# Desktop Audio + Desktop Vision — Investigation

Opened 2026-05-23. **Thinking doc, not a plan.** No code until the
questions below have answers we trust.

## The problem in one sentence

`vision_service` sees the screen but does not reliably *hear* the
desktop, so the model either invents audio that fits the visuals or
weasel-words about audio it cannot actually access. We want a solid,
always-on way to feed the same audio the audience hears into the same
analysis pass as the video.

## Why a fresh investigation instead of executing gameplan2 steps 1-3

[gameplan2.md](gameplan2.md) already prescribed three fixes (re-enable
hub `ambient_audio` transcripts, rewrite the prompt, kill the pyaudio
path). That plan is still valid as a tactical fix — but it bakes in two
assumptions worth re-examining before we commit:

1. **STT text is good enough as the audio channel.** The hub
   `ambient_audio` path delivers words. The Live POC demonstrated that
   words are only part of what audio gives you — music mood, voice
   tone, SFX timing, ambient texture all matter and none of them
   survive an STT round-trip.
2. **The vision pass and the audio pass should stay separate services
   stitched together via the hub.** That's the current architecture but
   it isn't the only option. The Live POC put both into one model call
   and got meaningfully better correlation between what was seen and
   what was heard.

So the real question isn't "should we do gameplan2 steps 1-3" — it's
"what topology do we actually want, given what we learned from the POC
and what we can afford on personal infra."

## What exists today (so we're not re-deriving it)

- **`vision_service`** captures frames from the capture card, captures
  audio via pyaudio's default device (wrong device — picks up Mac
  default, not capture-card output), and sends both to
  `gemini-2.5-flash` every 2 seconds. The audio it sends is almost
  always silent or wrong, which is what makes the model fabricate
  audio descriptions.
- **`stream_audio_service`** independently captures desktop audio
  cleanly and produces STT. Its output is broadcast on the hub as
  `ambient_audio` events. `vision_service` used to consume those but
  the path was disabled (the `add_transcript` no-op).
- **`microphone_audio_service`** does the same for mic input. Separate
  channel, not part of this question but worth flagging because
  whatever we design has to coexist with it.
- **`vision_live_poc`** proved that capture-card audio CAN be wired
  correctly (sounddevice + right device id), and that multimodal audio
  in the same call as video produces meaningfully richer output. Cost
  killed it as the default. Code still lives in the repo as a
  reference.

## What we're actually trying to decide

Three coupled choices, in roughly this order:

### 1. Where does the desktop audio come from?

Candidates:
- **pyaudio with an explicit device id** pointing at whatever macOS
  exposes the capture-card audio as (the Cam Link 4K presents an audio
  endpoint too). Cheapest change, but pyaudio's macOS device
  enumeration has bitten us before.
- **sounddevice with explicit device id**, mirroring what the POC
  proved works. More code change but a known-good capture path.
- **Reuse `stream_audio_service`'s capture**, either by consuming its
  raw audio buffer (new internal IPC) or by accepting we get text only
  (the gameplan2 path).
- **OS-level loopback** (BlackHole / Loopback) routed into a virtual
  device the service reads from. More moving parts in the host
  environment, but completely decoupled from what app produces sound.

### 2. What modality do we hand to the model — raw PCM, STT text, or both?

- **Raw PCM only**: matches what the POC did, gives the model voice
  characterization and music mood, but uses tokens and is what's
  currently failing in `vision_service` (because the input is wrong,
  not because the modality is wrong).
- **STT text only**: cheap, deterministic, never fabricates audio
  cues, but loses everything that isn't words.
- **Both, in the same prompt**: probably what we actually want, but it
  doubles the upstream work and we have to be careful the model
  doesn't double-count (describe the music *and* read back the STT
  line as if they're independent observations).

### 3. One service or two?

- **One service** (`vision_service` owns its own audio capture again,
  pointed at the right device): tight sync between the frames sent
  and the audio window analyzed. Duplicates capture work that
  `stream_audio_service` already does. Coupling is hidden inside one
  process.
- **Two services with hub coordination** (current architecture intent):
  `stream_audio_service` is the single source of truth for desktop
  audio, `vision_service` consumes whatever modality the hub
  publishes. Cleaner ownership, but introduces a sync question — how
  do we guarantee the audio chunk we attach to a vision batch covers
  the same 2-second wall-clock window as those frames?

## Open questions (the actual thinking work)

These need answers — by inspection, experimentation, or just deciding —
before any of the topology choices above can be made:

1. **Does macOS expose the Cam Link 4K's audio as a discoverable input
   device?** If yes, what does pyaudio / sounddevice report its index
   as, and is that stable across reboots? (This is the cheapest path
   to "vision_service hears what the audience hears" if it works.)
2. **What is `stream_audio_service` actually capturing right now?**
   Capture-card audio, system loopback, Mac default input? The answer
   determines whether sharing its source with `vision_service` is even
   coherent.
3. **How tight does sync need to be?** A 2-second vision batch with an
   audio clip that's offset by 500ms — does the model notice or care?
   The Live POC had perfect sync because both streams were in the same
   session; we'd be reconstructing that across the hub.
4. **If we send both PCM and STT in one prompt, does the model
   double-count?** Cheap to test once we have any working path: send a
   known clip plus its known transcript and see if the output
   describes "voice saying X" once or twice.
5. **What does the audience actually hear?** OBS pipeline routes
   desktop audio + mic into the stream output. Whatever we capture
   should match *that* mix, not some arbitrary intermediate. Need to
   trace the audio routing on the streaming PC, not just the Mac.
6. **TTS feedback loop.** If `tts_service` ever runs on the same host
   the audio is captured from, Nami will hear herself and start
   reacting to her own voice. Whatever capture point we pick has to
   sit before TTS gets mixed in, or we need a way to subtract it.
7. **What do we lose by not having native multimodal audio?** The Live
   POC's "narrator quotes verbatim" + "music mood characterization"
   was qualitatively better than STT-only. Is the gap big enough to
   justify a more complex capture path, or is "words + visuals" the
   80/20?

## Constraints we have to respect

- **Mac M4 only** — Nami is personal infra, no Linux/Windows host in
  scope for capture.
- **No Live API at $30/hr** — multimodal-in-one-call via Gemini Live is
  off the table as always-on. (Hybrid bursts are still on the table
  for later, separate from this question.)
- **Personal infra budget** — whatever we do has to fit the
  cost profile of the current `vision_service` (cheap per-call
  `gemini-2.5-flash`), not the POC's per-hour pricing.
- **Has to not break what works** — vision pipeline post-device-fix is
  reading HUDs, identifying games, transcribing on-screen text
  reliably. The audio fix can't regress visual accuracy.

## Explicitly NOT in scope for this investigation

- Speaker attribution / "who is talking" (separate problem, lives in
  `stream_audio_service` / `microphone_audio_service`).
- Mic audio (`microphone_audio_service`). Its `host_state` derivation
  is the [gameplan.md](gameplan.md) Phase 2 work.
- The address-bias problem (Nami talking *to* Otter instead of *about*
  the scene) — that's a director-side fix, not an upstream perception
  fix.
- Hallucinations in the Situation Summary / narrative memory recall
  ([notes.md](notes.md) 2026-05-21). Those persist even with perfect
  upstream.

## Next session

Before writing code:

- Walk through questions 1, 2, and 5 with real device enumeration and
  a trace of the actual audio routing on both the Mac and the
  streaming PC.
- Make the call on questions 3 and 7 — "how tight" and "how much
  fidelity" — based on what the answers to 1/2/5 make feasible.
- Then, and only then, pick the topology from the three choices above.
