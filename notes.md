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

### First failure of the run — stale Gemini model in `prompt_constructor`

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

## 2026-05-18 → 2026-05-19 — Silent freeze investigation

### Symptom

`director_engine` ran for 5–20 minutes then went silent. No exception, no
crash. Log lines appeared in bursts of ~100 events all stamped with the same
second; eventually output stopped entirely. Process stayed alive (PID present,
launcher saw it as running). Required manual stop to recover.

### Root cause — self-deadlock in `_compress_ancient`

`context_compression._compress_ancient` did:

```python
with store.lock:
    store.narrative_log = store.narrative_log[5:]
    store.archive_ancient_history(ancient_summary)
```

and [context_store.archive_ancient_history](../director_engine/context/context_store.py#L171)
itself does `with self.lock:`. `store.lock` was a plain `threading.Lock`, so
the same thread re-acquiring it deadlocked instantly. Because the call ran on
the main asyncio thread, the entire event loop wedged on `Lock.acquire()` —
`asyncio.sleep` never woke, the reflex loop froze at `step=idle_sleep`, but
OS threads (file-heartbeat, ThreadWatchdog) kept running because they don't
depend on the asyncio loop.

Only triggered when ancient-compression actually ran (every 300s) AND
`narrative_log` had ≥10 entries AND the LLM returned a summary >15 chars —
explains the 5–20 min freeze cadence.

**Fix:** [context_store.py:63](../director_engine/context/context_store.py#L63) —
`threading.Lock()` → `threading.RLock()`. RLock allows the same thread to
re-enter, which is what the codebase's "outer takes lock, inner method also
takes lock" pattern needs. Also defends against identical bugs across the
other ~30 `with self.lock:` sites in `context_store`.

### How we got there (the diagnostic chain)

The freeze was invisible until we built tooling that survives an asyncio
wedge. In order:

1. **Burst-timestamps mystery.** First runs showed ~100 events all stamped
   with the same second — looked like a freeze followed by a 100-iter
   "wake-up." This was [launcher.py:_launch_proc](launcher.py) spawning the
   child without `PYTHONUNBUFFERED=1`. Python defaults to block-buffered
   stdout when piped. Lines accumulated in a 4–8KB child-side buffer, then
   the launcher's read-time `time.strftime` stamped them all in one second
   when they finally flushed. Fix: set `PYTHONUNBUFFERED=1` in the child env.

2. **Write-time stamping.** Even with line-buffered output, several events
   per second can land in the same wall-clock second. Replaced
   `_NonBlockingWriter.write` in [main.py](../director_engine/main.py) to
   prepend `[HH:MM:SS.mmm]` at write time. Launcher recognises pre-stamped
   lines via regex and doesn't double-stamp. Result: timestamps reflect when
   the engine wrote, not when the launcher read. This was the unlock for
   trusting the logs.

3. **`diagnostics/errors.log`** (new module
   [director_engine/diagnostics.py](../director_engine/diagnostics.py)).
   JSONL file. Captures Ollama timeouts, analyst/compressor exceptions,
   asyncio unhandled exceptions, and uncaught thread exceptions. Survives
   stdout-pipe stalls because it's a direct file write. For this freeze the
   file stayed empty — confirming no exception fired, which pointed us at a
   deadlock rather than an error path.

4. **`diagnostics/stuck_dump.txt`** (the kill shot). A daemon thread in
   [main.py:_start_stuck_detector](../director_engine/main.py) watches
   `_reflex_state["iteration"]`. If it doesn't advance for 30s, dumps every
   thread's Python stack via `faulthandler.dump_traceback(all_threads=True)`.
   The dump from the freeze showed the main thread sitting at:

   ```
   context_store.py:172  archive_ancient_history
   context_compression.py:179  _compress_ancient
   ```

   …while no other thread held the lock. That told us "self-deadlock," not
   "contention deadlock," and the bug was obvious from the call chain.

### Other fixes done along the way (not freeze-causing but discovered en route)

- **Ollama timeout/concurrency tuning.** Original 15s `wait_for` was too tight
  for the 32B-class model running on the M4 — prompts crossing ~2k tokens
  already needed >15s, and concurrent calls compounded. Added per-caller
  timeouts (45–60s) in [config.py](../director_engine/config.py) and a shared
  `asyncio.Semaphore(2)` in [services/ollama_gate.py](../director_engine/services/ollama_gate.py)
  gating all 6 Ollama call sites in `services/llm_analyst.py` and
  `context/context_compression.py`. Eliminated the spam of `timed out after
  15s` lines and the cascading analyse-drop pressure.

- **`/context` race on `pending_memories_to_save`** in
  [main.py](../director_engine/main.py). Iterated and cleared the list
  without `store.lock` while `promote_to_memory` (which appends under the
  lock) could fire concurrently. Now snapshots under the lock then awaits
  emits outside. Not the freeze cause but the same lock family — opportunistic
  correctness fix.

- **Engine non-blocking stdout already existed** in `main.py` as
  `_install_nonblocking_stdio` with a "drops on full pipe" wrapper. We
  enhanced it with line-buffered write-time stamping and a `threading.Lock`
  so writes from concurrent threads serialize cleanly.

### Diagnostic toolbox left in place for next time

- `director_engine/diagnostics/heartbeat.txt` — written every 5s by an OS
  thread (`_start_file_heartbeat`, pre-existing). Snapshot of reflex state.
  `last_iter_duration_s` frozen + ThreadWatchdog still logging = asyncio is
  wedged but the process is alive.
- `director_engine/diagnostics/stuck_dump.txt` — written automatically ~35s
  after a freeze starts. Full thread stacks. **Read this first** when
  anything hangs.
- `director_engine/diagnostics/errors.log` — JSONL, one event per line.
  Component, message, exception type/msg/trace, context dict.
- `kill -SIGABRT <director_pid>` — manual faulthandler dump to stderr if the
  freeze happens but stuck-detector hasn't fired yet.

### Files changed in this investigation

- `director_engine/config.py` — Ollama timeout/concurrency knobs.
- `director_engine/services/ollama_gate.py` — new, shared semaphore.
- `director_engine/services/llm_analyst.py` — 4 call sites gated, timeouts
  bumped, errors logged.
- `director_engine/context/context_compression.py` — 2 call sites gated,
  timeouts bumped, errors logged.
- `director_engine/context/context_store.py` — **Lock → RLock (the freeze fix)**.
- `director_engine/main.py` — line-stamped stdout, stuck detector,
  pending-memories race fix, asyncio/excepthook installers.
- `director_engine/diagnostics.py` — new error-log module.
- `director_ui/launcher.py` — `PYTHONUNBUFFERED=1` for child env,
  pre-stamped line handling.

### Open follow-ups

- `OLLAMA_MODEL = 'llama3.2:latest'` in
  [config.py](../director_engine/config.py) is not in `ollama list` (only
  `qwen2.5:32b`, `llama3.2-vision:latest`, `nami:latest`, `nami_lora:latest`,
  an abliterated gemma3 27B). Either pull `llama3.2` or point the config at
  the model actually intended. A real 3B `llama3.2` would return responses
  in <1s and make the timeout/concurrency tuning much less load-bearing.
- Quick audit of the remaining `with self.lock:` sites in `context_store.py`
  to confirm nothing depends on the lock being strictly non-reentrant (RLock
  changes the semantics from "this caller is alone" to "no other *thread* is
  in here"). Unlikely to be a problem but worth one read-through.

---
