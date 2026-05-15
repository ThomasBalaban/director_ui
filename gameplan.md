# Assistant-Role Rewrite — Gameplan

Goal: shift Nami from host-bot to **streaming assistant**. Pick up the slack
when the streamer is fading, remind him to read chat, fill ambience — without
pulling focus when he's mid-conversation with chat. Cut reply length aggressively
across the board (TTS-friendly, less rambling).

Keep troll/pry as tools. The gate isn't "be nice when host is low energy" —
it's **don't pull focus when host is mid-chat-interaction**.

Backups taken (2026-05-15):
- [nami/nami/personality_host_backup_2026-05-15.yaml](../nami/nami/personality_host_backup_2026-05-15.yaml)
- [director_engine/services/llm_analyst.host_backup_2026-05-15.py](../director_engine/services/llm_analyst.host_backup_2026-05-15.py)
- [director_engine/systems/decision_engine.host_backup_2026-05-15.py](../director_engine/systems/decision_engine.host_backup_2026-05-15.py)

---

## Phase 1 — Personality rewrite (prompt-only, fastest payoff)

Pure wording changes. Should produce a visibly different Nami in one test session.

1. **Rewrite [nami/nami/model_in_progress.yaml](../nami/nami/model_in_progress.yaml)**
   - Reframe identity: assistant *to* PeepingOtter, not a host bot
   - Hard length rule near the top: default 1–2 sentences, ~20 words. Longer
     only when explicitly recalling something or directly asked to elaborate
   - Keep troll/pry as personality traits, but explicitly: don't interrupt when
     Otter is mid-reply to chat
   - Preserve the sarcasm/chaos voice — assistant ≠ helpful golden retriever
   - Keep sound-effect capability block (still useful)

2. **Tighten [director_engine/systems/decision_engine.py](../director_engine/systems/decision_engine.py) tone strings**
   - Every tone branch gets a length hint appended (e.g. "…in 1 sentence")
   - Rewrite the `user_role == "handler"` branches: when Otter is bored/dead-air,
     **fill space** is the default; **provoke/roast** is conditional
   - `OBSERVE` objective stays — silence is now a first-class behavior

3. **Tighten [director_engine/services/speech_dispatcher.py](../director_engine/services/speech_dispatcher.py) instruction strings**
   - "Fill the awkward silence. Say something random or provocative." →
     reframe to assistant-style filler (callbacks, observations, light banter)
   - All `content` strings get shorter — they're instructions to the LLM, and
     longer instructions correlate with longer outputs

**Test gate:** Run the stack, watch a stream, see if she feels like an
assistant. If voice/length is wrong, iterate on prompt before moving on.

---

## Phase 2 — Host-activity signal (the linchpin)

Everything in Phase 3+ depends on this. The signal answers: *is Otter
talking right now, and how lively is he?*

4. **Add `host_state` to context store**
   - Values: `ACTIVE` / `QUIET` / `FADING` / `UNKNOWN`
   - Derived from mic transcript rate over a sliding 30–60s window
   - Source: `microphone_audio_service` events on the Hub

5. **Wire signal in [director_engine/services/sensor_bridge.py](../director_engine/services/sensor_bridge.py)**
   - Roll up mic events into transcript-rate-per-window
   - Update `host_state` on each tick

6. **Expose `host_state` in the prompt context block**
   - [director_engine/services/structured_prompt_formatter.py](../director_engine/services/structured_prompt_formatter.py)
     gets a `<host_state>` tag near `<directive>` so the LLM knows what mode
     it's in

---

## Phase 3 — Good silence vs bad silence

With `host_state` available, the existing scene/goal machinery becomes
context-aware.

7. **Add new SceneTypes in [director_engine/config.py](../director_engine/config.py)**
   - `HOST_FOCUSED_QUIET` — low mic + high visual activity = he's locked in
   - `HOST_LOW_ENERGY` — low mic + low visual = fading, needs filling

8. **Update [director_engine/systems/scene_manager.py](../director_engine/systems/scene_manager.py)**
   - Classify the new scenes using `host_state` + visual activity rate
   - Hysteresis/cooldowns: same pattern as existing scenes

9. **Update [director_engine/systems/behavior_engine.py](../director_engine/systems/behavior_engine.py)**
   - `HOST_FOCUSED_QUIET` → suppress idle speech entirely (OBSERVE locked in)
   - `HOST_LOW_ENERGY` → raise idle filler frequency (lower `CURIOSITY_INTERVAL`
     dynamically, or just bias `BehaviorEngine.update_goal`)

---

## Phase 4 — Chat-awareness (answer chat herself, light tease at most)

Not a "reminder" system. The default response to ignored chat is for Nami to
**answer chat directly** on Otter's behalf, with light snark ("since Otter's
busy…"). Only occasionally — and only if it fits the moment — does she
tease *him* about it.

10. **Track ignored chat questions** in [director_engine/context/context_store.py](../director_engine/context/context_store.py)
    - Mirror of existing `conversation_debt`, but for chat→host: any Twitch
      chat message addressed at Otter or asking a question gets queued
    - Resolves when Otter's mic transcript references it, or after a timeout
    - This is a **soft signal** — it biases the LLM context, doesn't force action

11. **Surface ignored questions to the prompt context**
    - In [structured_prompt_formatter.py](../director_engine/services/structured_prompt_formatter.py),
      add an `<ignored_chat>` block when items exist
    - The LLM decides whether to answer chat directly, tease Otter, or
      ignore — guided by the system prompt and current scene
    - Keep it lightweight: no dedicated `BotGoal`, no special directive

12. **System prompt guidance** (Phase 1 covers the wording)
    - "If chat has been asking you things Otter hasn't noticed, you can answer
      them yourself. Be brief. Light snark like 'since he's busy' is fine.
      Don't make a habit of nagging him about it."

13. **Gate troll/pry on host state** in [decision_engine.py](../director_engine/systems/decision_engine.py)
    - The troll/pry branches only fire when `host_state != ACTIVE`. This is the
      "don't pull focus" rule. Independent of chat-debt.

---

## Phase 5 — Feedback loop

13. **Extend RL signal in [director_engine/systems/adaptive_controller.py](../director_engine/systems/adaptive_controller.py)**
    - Currently: action "succeeds" if chat velocity rises after it
    - Add: also succeeds if `host_state` transitions from QUIET/FADING → ACTIVE
      within ~15s of bot action
    - Reinforces actions that actually re-engage Otter, not just chat

---

## Phase 6 — Polish & cleanup (after the above works)

14. **Consolidate the two Gemini API keys** (deferred from secrets migration)
    - Decide if `GEMINI_API_KEY_NAMI` and `GEMINI_API_KEY` should merge
    - If yes: pick one, update [director_ui/secrets/gemini.env](secrets/gemini.env),
      drop the `_NAMI` references in director_engine/config.py and nami/config.py

15. **Remove personality backup files** once new behavior is locked in
    - `.host_backup_2026-05-15.{py,yaml}` files become git history

---

## Length-cutting checklist (applies to every prompt touched)

- Default constraint in the YAML: **"1–2 sentences, ~20 words"**
- Every directive constraint gets a length hint
- Speech dispatcher instructions: imperative + short, not descriptive
- The existing `ENERGY_COST_INTERJECTION = 5.0` + `ENERGY_MAX = 100.0` already
  budgets ~20 interjections before regen — short replies make this generous,
  long replies make it tight. Treat brevity as the default, not the exception.

---

## Open questions to revisit during Phase 1

- Does Nami still need a "mood" enum if her role is assistant? (`Horny`, `Scared`
  etc.) — probably collapse to fewer states or repurpose for tone-of-voice only
- Should she ever speak unprompted in `HOST_FOCUSED_QUIET`? Probably no, but
  callbacks ("hey, you said earlier…") might still be allowed at very low rate
- TTS emotion via SSML — flagged as easy win but not in this plan. Add after
  Phase 3 if assistant voice feels flat
