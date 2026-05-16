# Sensory Pipeline Reliability — Problem Statement

The director engine has been getting steadily smarter at *interpreting* its
sensory inputs (host_state signal, scene-aware behavior, source-weighted
scoring, fixation detection, conversation threading). All of that work assumes
the inputs are at least approximately truthful. Testing with a realistic
co-watch scenario shows they aren't. The upstream pipeline — `vision_service`,
`stream_audio_service`, `microphone_audio_service` — is producing data that
is not merely incomplete but actively fabricated, and the director has no
in-band way to detect this.

This doc describes the problem precisely. Solutions are deferred to a follow-up.

---

## The test scenario

Otter is AFK. The UI is configured (and locked) to:
- `watching: rabbithatplays`
- `manual_context: "we are watching rabbit play repo. I am currently afk"`

Rabbit is a **PNGtuber** (no facecam — a small cartoon avatar in a corner of
his stream overlay) playing the co-op horror game **R.E.P.O.** with friends.
The actual on-screen content includes:
- The R.E.P.O. logo at the bottom of the frame
- Gameplay HUD: cash counter (e.g. `$6,564`), health (`+95/100`), energy
  (`+40/40`), level indicator (`1/2`), `C.A.R.T.` text
- A glowing green extraction cart
- Stream overlay with green accents, PNGtuber avatars, chat box
- Twitch chat (e.g. `Devil_Tails: !redeem dumb`, `pop the ballon`)
- Audio: Rabbit + friends talking (co-op voice), game SFX, music

---

## What vision reports vs. reality

### Fabricated subject and environment
Across four separate clip descriptions (all timestamped identically), the
vision service describes a physical man — *"glasses, curly hair, dark shirt
with a red/orange strap, right hand resting near his chin, pensive
expression"* — and a physical room around him: *"dark grey couch, decorative
pillows, framed pictures, shelves with mugs, clock in upper-left, multi-tier
shelf, doorway to a darker room, ring light with purple filter, stream deck,
microphone."*

**None of this exists in the source frame.** There is no person on camera
(PNGtuber). There is no room — the frame is a game capture with overlay. The
model appears to default to "average streamer scene" when no facecam anchor
is present, then commits to that fabrication with full descriptive confidence.

### Failed text extraction
The R.E.P.O. logo is plastered on screen. The cash counter, health and energy
HUD, and chat messages from named users are all visible pixel-text. **None of
it is read.** The model's UI mentions are vague hedges:
*"possibly from a video game or a streaming dashboard"*,
*"likely from a strategy game, simulation, or complex software"*,
*"possibly a First-Person Shooter"*,
*"likely an MMORPG or strategy game"*.

Every guess was wrong. The model is generating prose *about* what something
might look like rather than reading what is literally there.

### Sampling / dispatch artifacts
All four descriptions carry the same timestamp (`20:26:34.072`) and each
emphasizes that *"no discernible movement or change whatsoever"* occurs over
their 2-second window. They are near-duplicate paraphrases of the same
fabricated scene with minor word swaps (*"red top"* vs *"red/orange strap"*,
*"pensive"* vs *"neutral"*, *"chin"* vs *"mouth"*).

This suggests either (a) the same window is being sent to the model multiple
times and slight rewording is being mistaken for independent observations, or
(b) clip windows are short enough that meaningful gameplay events
(grabs, hauls, encounters, deaths, room changes) are systematically missed.

### Audio claim inside vision payload
Each vision description ends with *"the accompanying audio is completely
silent"* — on a live co-op horror stream where players are actively talking.
This claim is independently false (see below) and reveals that whatever
"audio analysis" is happening inside the vision payload is not connected to
the actual audio.

---

## What audio reports vs. reality

### Two audio channels contradict each other
The vision payload claims silence. The dedicated `AMBIENT_AUDIO` channel,
arriving in the same timeframe, is *simultaneously* transcribing speech:
- `[2:50] Unknown Speaker (suggestive): There's, I found a TV back there...`
- `[3:19] Unknown Speaker (concerned): There's something upstairs...`
- `[3:35] Unknown Speaker (surprised): Oh, no. Hey, guys!`

Both can't be right. At least one capture/analysis path is broken or wired
to the wrong source.

### No speaker attribution
Every transcribed voice is *"Unknown Speaker"* with a sentiment label
(neutral, frustrated, amused). In any multi-party scenario — co-op streams,
audiobook tests, Otter responding to a friend — Rabbit, his friends, Otter,
the audiobook, all collapse into one anonymous voice stream. The director
then derives `conversation_state`, `mood`, and `directive` from this
collapsed stream, attributing third parties' frustration to Otter (already
observed in earlier tests).

---

## Audience role — no observer mode

This is a separate problem from speaker attribution but tangles with it, and
it lives on the director side rather than upstream.

Even with perfect attribution — knowing for certain that a given voice is
Rabbit and not Otter — the engine would still process the event as if it
*concerned Otter*. There is no concept of "audience role" anywhere in the
pipeline. The system only models one situation: Nami is *in a conversation
with Otter* about whatever is being captured. Everything is to-Otter framing:

- [`decision_engine`](../director_engine/systems/decision_engine.py) builds
  objectives like *"Assist User"*, *"Mock Failure"*, *"Provoke"*, *"Extract
  Information"* — the user is always the target of the action
- [`speech_dispatcher`](../director_engine/services/speech_dispatcher.py)
  triggers say *"Otter's gone quiet. Fill the gap"*, *"Roast the failure"*,
  *"Reference something earlier"* — every instruction presupposes Nami is
  addressing Otter
- [`conversation_threading`](../director_engine/services/conversation_threading.py)
  treats every captured utterance as a turn in an ongoing conversation
  with Otter, generating "pending questions" and "debt" as if he were a
  participant
- The personality YAML reinforces this:
  *"You are PeepingOtter's personal AI sidekick"* — Nami's identity is
  defined relative to Otter as the addressee

This is wrong for the actual situation under test: *Otter and Nami passively
co-watching a third-party stream*. Rabbit screaming *"It's so unfair! I just
wanted my car!"* was directed at his own co-op friends. Otter is not in
their conversation, not in their game, not in their voice channel. The
correct response from Nami would be **commentary** — talking *with* Otter
*about* what we are both watching — not addressing him as if he had just
felt or done something.

The four situations Nami can plausibly be in have completely different
audience-role semantics:

| Situation | Speaker attribution matters? | Audience role |
|---|---|---|
| Otter solo-streaming | Trivial (Otter only) | Host monologue, Nami participates |
| Otter on Discord with a friend in the room | Yes (Otter vs friend) | Participant conversation |
| Otter co-watching a third-party stream | Useful (Rabbit vs his friends vs NPCs) | Passive co-observation, Nami comments |
| Otter watching pre-recorded video / movie | Trivial (narrator only) | Passive co-consumption |

The engine collapses all four into the same mode: *"someone said something
nearby — talk to Otter about it"*. There is no "we are observers, not
participants" mode anywhere in the prompt assembly, the directive
generation, or the personality framing.

This compounds every upstream failure. Even if vision were truthful and
speaker attribution were perfect, Nami would still address Otter as the
subject of every captured utterance, because the engine has no other mode.
And the inverse: even if this were fixed, the upstream fabrications would
still poison the observations being commentated on.

---

## Why downstream cleverness can't fix this

The operator-set `<watching>` and `<manual_context>` tags are intended to
disambiguate observations. They cannot substitute for them. In this scenario,
the vision descriptions contain **zero truthful observations** about the
actual stream — no game name, no HUD elements, no chat, no avatars, no
co-op friends. There is nothing for the operator context to attach to.

The downstream LLM is asked to reconcile two narratives in the prompt:
- **Operator:** *"Rabbit is playing R.E.P.O. with friends"*
- **Vision:** *"a static man in a pink-lit room with a couch and a ring light, staring at strategy-game UI"*

These narratives are mutually exclusive. The fabricated one is longer, more
detailed, and more confident, so it dominates. Nami ends up commenting on
the imaginary man at the desk while the actual stream proceeds invisibly.

Director-engine improvements made so far still matter — they're correct in
principle and ready to act on good signal. But:

- `host_state` only works because mic-rate is a count of events, not their
  content. Content-based signals are all polluted.
- `HOST_FOCUSED_QUIET` / `HOST_LOW_ENERGY` correctly suppress or amplify
  speech, but the speech they generate is built from the contaminated
  prompt anyway.
- The fixation rewrite stops one specific failure mode (preposition-as-entity)
  but the underlying noun candidates are themselves drawn from fabricated
  descriptions.
- Source-weighted scoring would reweight noise.

The cleverness is real but it is reweighting and re-routing fabrications.

---

## Scope

Four independent failure surfaces. The first three live upstream of the
director and cannot be fixed from inside it. The fourth lives in the
director itself and exists independently of the upstream issues.

### Upstream

1. **Vision (`vision_service`)** — describes-instead-of-extracts. Hallucinates
   a default streaming scene when no human face anchor is present. Ignores
   on-screen text it could OCR. Hedges on game identity even when the
   game's logo is on screen. Possibly resamples the same window multiple
   times. Inline audio claims contradict the dedicated audio channel.

2. **Audio capture / routing** — at least one of {vision-side audio
   analysis, dedicated ambient_audio channel} is reading the wrong source
   or is silent when it shouldn't be. Needs to be traced end-to-end from
   OS audio capture through to the events the director receives.

3. **Speaker attribution (`stream_audio_service`,
   `microphone_audio_service`)** — every voice collapses to *"Unknown
   Speaker"*. No diarization, no source labeling. Multi-party scenes are
   inherently ambiguous, and the director's emotional/state inference
   silently misattributes third-party affect to the user.

### Director-side

4. **No audience-role concept (`director_engine`)** — the engine only
   models one situation: Nami is in a conversation with Otter about
   captured events. Co-observation of third-party content is processed
   identically to direct interaction with the user, so Nami addresses
   Otter as the subject of speech he was never part of. This is fixable
   from inside the director — directive generation, speech-trigger
   framing, personality prompt, and conversation threading would all need
   a notion of "observer" vs "participant" mode.

Each surface is independently fixable and independently breaks the rest of
the system when broken.

---

## What this doc does not include

- Proposed fixes
- Service-by-service implementation plans
- Model / prompt recommendations for the vision layer
- Decisions about whether to replace, re-prompt, or front-load any service

Those belong in a follow-up once we agree on which surface to tackle first
and at what depth.
