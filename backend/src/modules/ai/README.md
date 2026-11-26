# AI module — how one answer is produced

Every turn is one model call. The model picks the reply, the action and any reminder from the learner's data; the app only validates them against real records. There is no review or repair pass: the first draft is the reply. Deterministic command matching (`ai.commands.ts` / `ai.copilot.ts`) is a fallback used only when no model can answer.

```
POST /api/ai/chats/:id/messages          POST /api/buddy/ask
                │                                 │
                │                                 ▼
                │                 ai.service.ts (authenticated learner data)
                ▼                                 ▼
        ai.validation.ts  (message, intent, context)
                │
                ▼
        ai.pipeline.ts  ── resolveTurnIntent() ──────────► ai.decisions.ts
                │                                          (intent choice)
                │
                ▼
        ai.prompts.ts  (system prompt + learner JSON + page JSON + history)
                │
                ▼
        ai.provider.ts  ── Token Harbor (DeepSeek) ──► Gemini 2.5 Flash
                │                                       (on failure: ai.study.ts offline answer)
                ▼
        ai.parsing.ts  (JSON contract: reply / feedback / followups / action / reminder)
                │
                ▼
        ai.repository.ts  (save message + feedback rows)
```

| File | Responsibility |
| --- | --- |
| `ai.routes.ts` / `ai.controller.ts` | HTTP surface only |
| `ai.validation.ts` | Trims and bounds untrusted input, closes the intent/tab enums |
| `ai.commands.ts` / `ai.copilot.ts` | Offline fallback: recognises guide commands and resolves them against learner records and catalogues when every provider is down |
| `ai.pipeline.ts` | One turn: budget, intent routing, one generation, fallback |
| `ai.provider.ts` | The only generative chain: Token Harbor (DeepSeek) → Gemini Flash |
| `ai.decisions.ts` | Gemini Decision 1: closed-set intent routing |
| `ai.prompts.ts` | Prompt text, app guide, voice rules, learner data serialisation |
| `ai.parsing.ts` | Strict parsing of the model JSON and reminder heuristics |
| `ai.study.ts` | Snapshot, deterministic plan, deep-link resolution, offline answer |
| `ai.repository.ts` | All SQL for chats, messages, feedback and study stats |
| `ai.types.ts` | Shared DTOs and enums |

## Answer contract

```json
{
  "reply": "câu trả lời tiếng Việt",
  "feedback": [{ "type": "GRAMMAR", "original_text": "...", "corrected_text": "...", "explanation": "..." }],
  "followups": ["...", "..."],
  "action": null,
  "reminder": null
}
```

`parseAiReply` validates replies, feedback and follow-ups. The coach prompt
sets `action` and `reminder` to null. The service derives both fields from
app rules and uses `resolveChatAction` to validate navigation destinations.

## Time budget

`AI_TURN_BUDGET_MS` (default 30s) is shared by every step of one turn, so a slow
provider cannot stack past the web client's 35s request timeout. When the budget
is spent the deterministic offline answer is returned instead.

## Study plan and web integration

- `GET /api/ai/study-plan` builds a snapshot and up to three study steps from
  stored progress, errors grouped by lesson topic, saved words, video
  progress and due review items. `buildStudyPlan` computes those steps without
  a model call. Topic ranking uses the number of wrong attempts per topic.
- The web `VoiceOrb` uses `GET /api/buddy/nudges` and `POST /api/buddy/ask`.
  Try “Chuyển tab sang Hồ sơ”, “Tìm trận đấu”, “Gara có những gì?”,
  “Mua xe màu đỏ”, “Mở video mã ...”, or “Bao lâu rồi mình chưa học?”.
  Matchmaking highlights the Arena button after one second. A shop lookup
  highlights the item and reports its price and availability. Learners
  start matchmaking, confirm purchases, and save reminder suggestions
  through the corresponding app controls.
- Video lookup accepts a title, code or topic and uses the same access
  rules as the video API. Private videos are searchable by their owner.
  Random recommendations draw from the published library by default.
- The coach prompt includes the active page, recent lesson history and
  scores, the next roadmap lesson, frequent errors, days since recorded
  practice, and the full shop catalogue with prices and unlock conditions.
- `pickNextLesson` currently returns the first unfinished lesson after a
  completed predecessor, including the first lesson when unfinished. The
  learning API instead finds the checkpoint after the furthest completed
  lesson. If unfinished content is inserted into an earlier stage, the
  coach can suggest that catch-up lesson while the roadmap points further
  ahead.

## Rules for the fallback

- Only a failed provider call uses the offline answer. Intent routing failing
  keeps the client's intent.
- The coach offline answer is built from real rows, so a provider outage still
  returns grounded data.
