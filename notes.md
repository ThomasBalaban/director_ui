# Stress-test observations

Running notes from live observation of the stack. Not bugs to fix immediately —
just patterns worth remembering when we come back to tuning. Date stamps when
known.

---

## 2026-05-17 — Situation Summary fixation + a clean hallucination

Context: stress-test run, Subnautica-style game (underwater exploration, scanner
tool, Amphora Sponges, oxygen UI, depth UI). User observing for ~2 hours.

### The hallucination — `NARRATIVE_HISTORY1` "cat's fur"

```
Earlier: 'Your cat's fur looks like it's trying to convey a message from
another dimension that only you can decipher.'
```

No cat. No pet. Pure underwater game footage upstream. This is a clean
fabrication — not derived from any visible vision/audio signal in the
surrounding context. Worth distinguishing from the "could be funny" stuff
because **the recall layer is asserting something that never happened**.

Hypothesis to check (not now, during a debugging session): the
`NARRATIVE_HISTORY` entries come from past Nami quips that got promoted to
memory. If memory promotion is happening without the original sensory anchor,
the LLM is free-associating on the quip text alone next time it surfaces.
Likely involves [memory_service](../memory_service/) ↔
[director_engine/context/context_store.py](../director_engine/context/context_store.py)
+ [services/structured_prompt_formatter.py](../director_engine/services/structured_prompt_formatter.py).

User's stance: *"the fur thing is a pure hallucination"* — flag-worthy, not
just a vibe complaint.

### The fixation — O2 / viewership joke template

The Situation Summary and multiple `NARRATIVE_HISTORY` entries keep returning
to the same comparison shape:

- *"oxygen levels dropped faster than PeepingOtter's viewership"*
- *"oxygen levels were plummeting and his viewership was tanking"*
- *"Your oxygen levels are dropping faster than your viewership numbers"*
- *"Your oxygen levels are plummeting and your viewership is tanking"*

Two issues compounding:

1. **Stale framing.** O2 was at 59% then *recovered to 75% and stabilized*,
   but Situation Summary still leads with *"the player's viewership numbers
   are dropping faster than expected"* in the same breath as the now-fine
   oxygen. The summary isn't tracking the recovery — it's reusing the prior
   crisis frame.
2. **Template repetition.** Same "X dropping faster than viewership" joke
   recycled across multiple memory entries. User: *"could be funny but want
   to make note of it"* — so don't class as a bug, but it's a smell. If
   memory retrieval is biased toward semantically-similar past quips, every
   new "oxygen low" moment will pull the same prior quip family forward,
   reinforcing the template.

### Where the recency miss likely lives

Situation Summary appears to be assembled from layered context blocks
(`IMMEDIATE EVENTS` / `RECENT CONTEXT` / `BACKGROUND CONTEXT` / `NARRATIVE_HISTORY`).
The vision events *do* show the recovery (O2 59 → 75, depth 61m → 60m), so
the raw sensory data is fine. The summary line that opens with the stale
viewership frame is downstream of the LLM call that composes the summary
itself — probably an
[llm_analyst.py](../director_engine/services/llm_analyst.py) or
[structured_prompt_formatter.py](../director_engine/services/structured_prompt_formatter.py)
issue, where stale framing from older context outweighs the freshest events.

Worth checking later: is there a "current state vs. trend" distinction in the
summary prompt, or does it just dump events and let the model decide what
to lead with?

### The "viewership tanking" jokes — Nami doesn't know if we're live

Related to the fixation above, but a distinct problem: Nami keeps making
*"your viewership is tanking"* jokes regardless of whether Otter is actually
live on Twitch. When he's not streaming, the joke is a non-sequitur. When he
is, it might land or might be a bummer depending on the actual numbers.

**The signal already exists, it's just not wired through.** `twitch_service`
listens to Twitch EventSub for `stream.online` / `stream.offline` and tracks
`_is_live` in [twitch_service/eventsub_client.py:29](../twitch_service/eventsub_client.py#L29).
It's exposed at `GET /live_status` on port 8005 ([twitch_service/main.py:79-81](../twitch_service/main.py#L79-L81))
and has a `_set_live` callback hook ([eventsub_client.py:42](../twitch_service/eventsub_client.py#L42))
ready to broadcast.

Nothing in `director_engine/` or `director_ui/src/` currently references
`is_live` / `live_status` (grepped). So:

- `twitch_service` knows.
- The director doesn't.
- Therefore Nami doesn't.
- Therefore she riffs on viewership when there is no audience to drop.

**Action to consider later** (not now): broadcast a `live_status` event from
`twitch_service` over the hub, consume it in
[director_engine/services/sensor_bridge.py](../director_engine/services/sensor_bridge.py),
store on [context_store.py](../director_engine/context/context_store.py), and
expose as a `<live_status>` block in
[structured_prompt_formatter.py](../director_engine/services/structured_prompt_formatter.py)
so the LLM and system prompt can both gate behavior on it. This sits naturally
alongside the `<host_state>` work already planned in
[gameplan.md](gameplan.md) Phase 2 — same plumbing pattern, same prompt
surface.

Behavioral implications worth thinking through before implementing:
- Offline → suppress audience-aware jokes ("chat", "viewership", "stream")
  entirely or reframe them as practice/private mode
- Online + early in stream → low-viewership jokes still risky, may want a
  separate "stream age" derived signal before allowing them
- Doubles as a gating signal for the streaming-assistant rewrite — if Nami's
  job is to support a *stream*, "are we streaming right now" is a primary input

### Deployment reminder — TTS engine belongs on the streaming PC

Don't forget again: the **`tts_service` needs to run on the streaming
computer**, not the Mac dev box.

The service ([tts_service/main.py](../tts_service/main.py), port 8004) plays
generated audio out through `sounddevice` on whatever host it runs on. If
it runs on the Mac, the audience can't hear Nami — the stream picks up the
streaming PC's audio, not the Mac's. ngrok tunnel is set up so the service
is reachable across the network regardless of which host owns it.

This is a deployment topology note, not a code change. Capturing it here so
the next time the stack gets stood up fresh, TTS goes on the right machine
the first time.

### First failure of the run — stale Gemini model in `prompt_constructor` (FIXED 2026-05-23)

Resolved: [prompt_constructor.py:35](../director_engine/services/prompt_constructor.py#L35) now
uses `gemini-2.0-flash`. Leaving the investigation below as the historical
record of the bug.



```
[11:50:46] ⚠️ [PromptConstructor] Gemini Summarization Failed: 404
  models/gemini-1.5-flash is not found for API version v1beta, or is not
  supported for generateContent.
```

**Root cause:** [director_engine/services/prompt_constructor.py:35](../director_engine/services/prompt_constructor.py#L35)
hardcodes `'gemini-1.5-flash'`. That model is no longer served on this
account / API version. The rest of the project has already migrated past it:

| File | Model |
|---|---|
| `vision_service/gemini_client.py:34` | `gemini-2.5-flash` |
| `sensory_data/config.py:51` | `gemini-2.0-flash` |
| `event_interpreter_service/config.py:52` | `gemini-2.0-flash` |
| `director_engine/services/prompt_constructor.py:35` | **`gemini-1.5-flash` ← stale** |

`prompt_constructor` is the only holdout. Fix is a one-line model-name swap;
pick `gemini-2.5-flash` to match `vision_service` or `gemini-2.0-flash` to
match the classifier services — they have different cost/quality profiles
and the summarization role is closer to the classifiers' workload, so
`2.0-flash` is probably the right pick.

### Important second observation — failure mode was silent, not loud

The engine logged the 404 and *kept running*. Same tick continued:

```
[11:50:46] ✅ [PromptClient] Delivered: Internal Thought
[11:50:46] 💭 [Monologue] Generating thought | topic: the current situation
[11:50:46] 🔒 [Attention] Locked on VISUAL_CHANGE (Score: 0.95)
```

So summarization was an exception-swallowed best-effort step, and the
downstream flow proceeded with whatever fallback (probably no summary at
all). That's why the user reported it as "blew up" — but operationally it
degraded silently. **The visible-to-user symptom of this bug for the rest
of the run will be: prompts missing the summarized context block, not a
crash.** Worth checking what the fallback path actually does in
[prompt_constructor.py](../director_engine/services/prompt_constructor.py)
when fixing.

### Adjacent observation — weird memory query string

In the same tick, just before the failure:

```
[11:50:46] 🧠 [Memory Query] Final query (32 chars): 'how to solution fix try strategy...'
```

That's the trailing keyword-soup pattern of a keyword-extraction fallback,
not a coherent semantic query. The triggering thought ("Your oxygen levels
are plummeting because you're holding your breath...") would semantically
hash to something about *oxygen / panic / monster*, not *solution/fix/try/strategy*.
Either (a) keyword extraction is producing the wrong terms, or (b) the
query is being constructed from something else entirely (a directive label?
a goal name?). Cross-check whether this correlates with the summarization
failure or is independent.

### Hallucination recurrence — "cat's fur" again

Second sighting in the same run:

```
[11:50:46] 📖 [Context] Added narrative segment: '[Your cat's fur looks like it's trying to convey ...
```

Confirms the earlier observation isn't a one-off — that fabricated quip is
**stuck in memory** and being retrieved on repeat. Strengthens the
hypothesis that memory promotion is keeping the quip text while the
sensory anchor has been lost (or never existed). Next debugging pass on
[memory_service](../memory_service/) +
[context_store.py](../director_engine/context/context_store.py) should
check: how do narrative segments get into memory in the first place, and
is there any provenance link back to the originating sensory event?

### Address bias — Nami talks *to/about* Otter on nearly every reply

User's framing: *"we really need to try to make her talk about me less... she
should be messing with me and stuff, but talking to me or about me has been
almost every single reply in this test. not passively observing things in
the game and joking about that. the one time she did not include talking
to me it was great reply and timing."*

This is **not** the same as the "don't pull focus when host is mid-chat"
rule in [gameplan.md](gameplan.md). That rule is about *when* to speak.
This is about *what to talk about / who to address*. Two distinct knobs.

The missing mode is **third-person observational commentary** — riffing on
what's happening on screen, in the game, in chat, in the audio — *without*
making Otter the grammatical subject or the addressee. Right now nearly
every line is "you/your" pointed at him.

**The validating data point:** the one reply that didn't address him landed
well. So the right behavior isn't unknown, it's just under-weighted in
whatever is producing the address pattern.

Likely contributors (not yet verified, candidates to investigate):

- **Personality YAML** ([nami/nami/model_in_progress.yaml](../nami/nami/model_in_progress.yaml)
  and its in-progress sibling): probably leans hard on second-person framing
  in examples and voice samples
- **Tone-string branches** in
  [director_engine/systems/decision_engine.py](../director_engine/systems/decision_engine.py):
  many branches likely cue "respond *to* PeepingOtter" rather than "comment
  *on* the scene"
- **Speech dispatcher instructions** in
  [director_engine/services/speech_dispatcher.py](../director_engine/services/speech_dispatcher.py):
  if instructions are framed as "say something to him about X," that locks
  in the address. Reframing to "observe X out loud" would unlock the
  observational mode
- **Structured prompt formatter** in
  [director_engine/services/structured_prompt_formatter.py](../director_engine/services/structured_prompt_formatter.py):
  whatever role/relationship framing it injects in the system context will
  bias toward the user being the conversational target

**Possible direction (not for now):** add an explicit "address target" slot
that can be `OTTER` / `CHAT` / `NONE_OBSERVATION` and bias the LLM toward
`NONE_OBSERVATION` for ambient/scene-driven triggers. The current decision
pipeline probably collapses this into the directive without naming it,
which is why everything defaults to "talk to the human."

Related: the assistant rewrite in [gameplan.md](gameplan.md) Phase 1 may
**worsen** this bias if "assistant *to* PeepingOtter" is read by the LLM
as "always address PeepingOtter." Worth tightening the personality
language to make observational commentary explicit before declaring Phase 1
done.

### What's working

Most of the rest of the run is fine, per user. The vision pipeline itself
is reading HUD numbers (depth, O2, Amphora Sponge names, "NEW DATABANK
ENTRY") accurately. The audio descriptions are restrained (calling out
silence when there's no audio, instead of fabricating — improvement over
the pre-fix behavior described in
[gameplan2.md](gameplan2.md)).

---

## 2026-05-21 — Situation summary + memories hallucinate hard

Flagging for a dedicated investigation pass later, *not* right now.

The Situation Summary block (and to a lesser extent the memory/narrative
recall) keeps producing content that has no anchor in the sensory stream.
Some of the off-the-wall stuff is funny on its own ("cozy apocalypse",
"peaceful nightmare"), but the rate and severity have crossed a line — when
viewers see it, the read is going to be **"Nami's brain is full-on schizo"**,
not "Nami is being whimsical." That's a perception problem, not just a
content problem.

This builds on prior entries in this file:

- 2026-05-17 — the "cat's fur from another dimension" fabrication (no cat
  exists, anywhere). Already hypothesized to be memory promotion holding
  the quip text after losing its sensory anchor.
- 2026-05-17 — the O2 / viewership template fixation, where the summary
  keeps reusing a stale crisis frame instead of tracking recovery.

Next investigation pass should look at, in this order:

1. **Situation Summary composition.** How is the summary line actually
   assembled? Probably in
   [director_engine/services/llm_analyst.py](../director_engine/services/llm_analyst.py)
   or
   [director_engine/services/prompt_constructor.py](../director_engine/services/prompt_constructor.py).
   Does it ground on current sensory state, or just paraphrase prior
   summaries? If it's recursively summarizing summaries, the drift is
   structural.
2. **Memory promotion provenance.** What conditions promote a quip into
   narrative memory? Is there *any* provenance link back to the originating
   sensory event, or is the promoted entry free-floating text? If
   free-floating, it can re-surface with no grounding and the model has to
   improvise context — which is exactly when "cat's fur" happens.
3. **Memory retrieval semantics.** If retrieval is purely semantic
   similarity over quip text, every "low oxygen" moment will pull the same
   prior quip family forward — explains the viewership-template repetition.
   Worth checking whether retrieval weights recency / sensory match at all.

Provisional preference (the bias to keep in mind during the pass): bias
toward *grounded* commentary even at the cost of less colorful summaries.
"Slightly less funny but recognisably accurate" is a much better stream
read than "occasionally hilarious, frequently unhinged."

---

## 2026-05-24 — First live test observations

Three new patterns surfaced in the first live stream test. Skeletons for
now — questions to be filled in next session before any code work.

### Response time inconsistency

**Observation:** Nami sometimes takes a long time to respond, sometimes
responds almost instantly. Same conversational context, no obvious
pattern visible from the stream side.

**Questions to answer:**
- _(to fill in)_

### Wrong-person responses

**Observation:** Often responds to the wrong person — i.e., directs the
reply at someone other than whoever was actually being addressed or just
spoke. Not every time, but frequent enough to be a real issue.

**Questions to answer:**
- _(to fill in)_

### Incomplete sentences

**Observation:** Will sometimes not talk in a complete sentence — output
gets cut off, starts mid-thought, or trails off without resolving.

**Questions to answer:**
- _(to fill in)_

---

## 2026-05-27 — testing_engine in place + first reproducible wrong-person bug

### What now exists: the testing framework

`testing_engine/` is now a real sibling project that scripts twitch + mic
events at the hub, captures `bot_reply` events, and scores each scenario
on three axes (address target, sentence completeness, response time)
with Pass / Fail / Undetermined verdicts. Five seed scenarios were
written from the
[past-chats data](past-chats/) of a real stream segment. The framework
ships with an HTTP server on port 8011 and a UI page at `/testing` so
runs can be kicked off and observed from the dashboard, plus a CLI for
headless runs.

This matters because three of the four open issues from the
[2026-05-24 entry](#2026-05-24--first-live-test-observations) — response
time, wrong-person, incomplete sentences — are observation-only without
a way to provoke them on demand. The framework gives us that.

See [testing_engine/design.md](../testing_engine/design.md) for the
shape and the open questions deferred for v1.

### What the framework already exposed: a fix and a bug

**1. `prompt_service` cooldowns were eating reply-mode replies.** The
gate's `post_speech_cooldown` / `min_interval` / `post_response_cooldown`
checks were originally designed to throttle proactive speech, but
they were running in reply mode too — even though
[`speech_gate.reply_mode_check`](../prompt_service/speech_gate.py#L133)
has already filtered to direct-address-only by the time those checks
run. So every event that reached `can_speak()` in reply mode was a
legitimate reply, and the cooldowns were just suppressing them.

Fix (landed 2026-05-26): in reply mode, `can_speak()` now short-circuits
after the speaking-lock check + a 2s `REPLY_MODE_DISPATCH_BUFFER`. The
proactive cooldowns only apply when `reply_mode == "off"`. See
[prompt_service/speech_gate.py:151-184](../prompt_service/speech_gate.py#L151-L184).

Before the fix: 2/5 scenarios got any reply. After: 4/5.

**2. The wrong-person bug is now reliably reproducible.** Two
scenarios surface it consistently across runs:

- **`wrong_person_chatter_swap`** — thelucifersdemons spams 3 non-Nami
  chat messages, then rabbithatplays @s Nami. First reply addresses
  thelucifersdemons (wrong), second reply addresses rabbithatplays
  (correct, but late and only sometimes captured). Real output:
  ```
  Thelucifersdemons: The one with the *seahorse* statues, obviously!
  Rabbithatplays: Like desperation, *AIRHORN* cheap beer, and a *mystery* musk.
  ```
- **`direct_mention_to_otter`** — thelucifersdemons chats "lol that
  timing", then Otter @s Nami via mic. Reply:
  ```
  Thelucifersdemons: Ooooh, *yours*? Not Otter's *BONK* messy little cave?
  ```
  She literally answers Otter's question while *addressing*
  thelucifersdemons and *referring to* Otter in third person. This is
  the same bug as in the 2026-05-24 entry — it's not a vibe, it's
  consistent enough to chase in code.

**Pattern across both:** Nami addresses whoever spoke *just before* the
actual addresser, not the actual addresser.

### The mystery: where the wrong user gets stamped in

Quick first pass:
[director_engine/core_logic.py:108-125](../director_engine/core_logic.py#L108-L125)
sets `is_direct_address` correctly when a TWITCH_MENTION or
DIRECT_MICROPHONE arrives, and calls
`shared.store.set_active_user(profile)` for every event with a
username. So by the time the @-mention from rabbithatplays lands,
`active_user` *should* be rabbithatplays.

But the reply addresses thelucifersdemons. So something downstream is
either:
- using a snapshot of `active_user` from before this event,
- assembling the prompt from a "most active speaker" signal that
  out-weights `active_user`, or
- having the LLM pick its addressee from the conversation history block
  rather than the `<active_user>` field, and the history is more dense
  on whoever talked most.

Candidate places to look (not yet verified — investigation pass needed):

- [director_engine/services/structured_prompt_formatter.py](../director_engine/services/structured_prompt_formatter.py)
  — what does it stamp into `<active_user>` / `<active_conversation>`?
  Is it pulling from `shared.store.active_user` at dispatch time, or
  from some older snapshot?
- [director_engine/services/llm_analyst.py](../director_engine/services/llm_analyst.py)
  — does the prompt include the full recent chat log? If so, the LLM
  may pick its addressee by recency-of-volume rather than by the
  explicit field.
- Thread tracking in
  [context_store.py](../director_engine/context/context_store.py) —
  is there a "current conversation" / "current participant" derived
  signal that's biased toward whoever chatted most rather than whoever
  addressed Nami?
- The `<focus>` block in test-prompt1.txt
  ([past-chats/test-prompt1.txt:54-68](past-chats/test-prompt1.txt#L54-L68))
  shows mixed mic + chat dumped chronologically. If that block is the
  main signal the LLM uses to pick its addressee, then whoever
  out-volumes the actual addresser wins — exactly the pattern we're
  seeing.

### The other open mystery: scenario 3's no-reply

`otter_voice_then_chat` gets no reply even though maxxhhom clearly @s
Nami. Most likely explanation is cross-scenario contamination — the
prior scenario's reply was still being TTS'd when maxxhhom's event
fired, so it hit `nami_speaking` and got dropped. Not a real bug in
Nami; a framework artifact.

Cheap mitigation when we come back: add a `post_scenario_pause_seconds`
to the runner (default ~8s) and bump `reply_window_seconds` to ~20.
Real fix would be resetting director state (memory, context, gate
timers) between scenarios — the state-isolation question from
[testing_engine/design.md](../testing_engine/design.md) open question #1.

### Provisional next step (when picking this back up)

The wrong-person bug investigation is the highest-value next move
because:
1. It's now reliably reproducible — every test run hits it.
2. The fix space is contained (it's prompt construction / addressee
   selection, not a sprawling cross-service rewrite).
3. It's the bug the user has flagged as most jarring on-stream.

Start the investigation pass with `structured_prompt_formatter.py` and
trace how the addressee is selected by Nami. The framework can then
verify any fix by re-running scenarios 2 and 4 and watching the
verdicts flip from FAIL to PASS.

---
