# AI module — how one answer is produced

Two model families, three layers:

```
POST /api/ai/chats/:id/messages          POST /api/buddy/ask
                │                                 │
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
        ai.provider.ts  ── Cloudflare Workers AI (Sea-Lion) ──► Gemini 3.5 Flash
                │
                ▼
        ai.parsing.ts  (JSON contract: reply / feedback / followups / action / reminder)
                │
                ▼
        ai.decisions.ts  reviewAnswer()  ──► ship ─────────────► save + return
                │                        └─► repair → one rewrite → review again
                │                        └─► reject → ai.study.ts offline answer
                ▼
        ai.repository.ts  (save message + feedback rows)
```

| File | Responsibility |
| --- | --- |
| `ai.routes.ts` / `ai.controller.ts` | HTTP surface only |
| `ai.validation.ts` | Trims and bounds untrusted input, closes the intent/tab enums |
| `ai.pipeline.ts` | One turn: budget, intent routing, generate, review, repair, fallback |
| `ai.provider.ts` | The only generative chain: Sea-Lion → Gemini Flash |
| `ai.decisions.ts` | Gemini Decision 1: closed-set intent and answer review (`ship`/`repair`/`reject`) |
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

`parseAiReply` rejects empty replies, unknown feedback types, more than 6 feedback
items or more than 3 follow-ups, and drops actions/ids that are not in the real
catalogue (`resolveChatAction`).

## Time budget

`AI_TURN_BUDGET_MS` (default 30s) is shared by every step of one turn, so a slow
provider cannot stack past the web client's 35s request timeout. When the budget
is spent the deterministic offline answer is returned instead.

## Rules that keep the gate safe

- The gate can never break a turn: a disabled or failing Decisions API means the
  draft ships unchanged.
- Only the coach flow has a `grounding` question; the legacy English tutor only
  gets the shape verdict.
- Any rejected coach answer is replaced, never shown; a repair that is rejected
  on the second review is replaced too.
