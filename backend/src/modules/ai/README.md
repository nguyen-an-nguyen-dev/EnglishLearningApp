# AI module — how one answer is produced

Buddy resolves standalone greetings, exact navigation, coin balance, due review
counts, saved vocabulary, random video requests and simple timed reminders on the backend. Other turns use
DeepSeek via Token Harbor, with Gemini 3.5 Flash-Lite as the default fallback on
Google's endpoint. Use `BUDDY_FALLBACK_MODEL` to override it. The first
usable reply is returned after validation against the learner's records.

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
        ai.provider.ts  ── Token Harbor (DeepSeek) ──► Gemini Flash
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
| `ai.decisions.ts` | Closed-set intent routing for general AI chats when no explicit intent was sent |
| `ai.prompts.ts` | Prompt text, app guide, voice rules, learner data serialisation |
| `ai.parsing.ts` | Strict parsing of the model JSON and reminder heuristics |
| `ai.streaming.ts` | Reads provider events and extracts provisional reply text |
| `ai.vocabulary.ts` | Looks up words and notes in the learner's own notebook |
| `ai.memory.ts` | Resolves references to recent destinations and retrieves older examples on request |
| `ai.search.ts` / `ai.recommendations.ts` | Rank catalogue matches and suggest grounded study destinations |
| `ai.practice.ts` / `ai.schedule.ts` | Provide checked exercises and time-bounded study plans |
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

`parseAiReply` validates feedback, actions and reminders. Buddy's model decoder
keeps a usable reply when optional feedback contains an invalid item. Complete
plain-text replies carry no navigation action or reminder. The service validates
structured destinations with `resolveChatAction`.

Compound requests can return an optional `actions` array with up to three
validated destinations in order. The first remains in `action` for existing
clients. In the web Buddy, compound destinations are separate buttons and a
reminder still requires an explicit confirmation. Clear bundles of supported
navigation commands and a timed reminder resolve locally. Requests with an
unresolved step still go through the coach.

Recommendations use the same buttons and let the learner choose a destination.
Buddy stores the order of destinations in internal chat records. “Mở mục thứ
hai” and “Open the second one” resolve against that order and recheck access.
These records use the existing database schema and stay out of public chat
history. When a learner explicitly asks to recall an older discussion, Buddy
retrieves up to two relevant examples from the same chat alongside the recent
conversation.
Expo shows supported destinations as buttons after the final reply. It
requests `GET /api/ai/chats/:id?include=destinations` to restore those buttons
from chat history. The response includes the destinations shown for each
reply, while ordinal follow-ups still use the original ordered choices.
The older history response keeps its original message fields.
For standalone grammar explanations, any grounded study destinations the
provider suggests are buttons in the reply. The explanation stays visible and
the learner chooses whether to open a destination. A request that explicitly
combines an explanation and navigation can still perform both.

## Time budget

Buddy gives the model chain up to 12 seconds, capped by
`AI_TURN_BUDGET_MS`. The standard sequence allows up to seven seconds
for DeepSeek and five seconds for Gemini. For short replies with streaming
enabled and both providers configured, Buddy can start Gemini after four
seconds without non-blank response content, or sooner when the overall
budget is shorter. Header, role, and reasoning events leave the timer armed.
Both attempts share the deadline. The first reply that passes parsing wins
and cancels the other attempt. A closed client connection cancels both.

The web opts in to `POST /api/buddy/ask`, and the Expo app opts in to
`POST /api/ai/chats/:id/messages`, with `Accept: application/x-ndjson`.
The server can send `draft` lines with replacement text before the final
`answer` line. The server saves the exchange before sending the final line.
An interrupted provider clears its preview before fallback. Navigation and
reminder requests wait for the final result. The chat endpoint still returns
HTTP 201 with the existing JSON envelope when the client omits the header.
The Expo client also accepts that envelope after opting in, so it can talk to
an older backend without retrying the POST.
Its study-plan request starts on opening the Plan tab. A chat-only visit
does not start a plan-note request.
[Token Harbor streaming](https://tokenharbor.ai/docs/api/curl#streaming) ·
[Gemini streaming](https://ai.google.dev/gemini-api/docs/openai#streaming)

## Spoken greetings and check-ins

Buddy answers complete English and Vietnamese greetings and check-ins directly.
The new replies offer the due-review count and a ten-minute study plan. A
learning request appended to the greeting follows the regular intent routing.

Run `node --import tsx scripts/benchmark-buddy.mjs --live --stream --case="spoken greeting and check-in"`
from `backend`. Six calls per version used “Good morning. How are you today?”
against the development database and configured model provider.

| Service measure | Before | After |
| --- | ---: | ---: |
| Correct replies | 6/6 | 6/6 |
| First text p50 | 1,662.3 ms | 19.0 ms |
| Final reply p50 | 2,119.0 ms | 19.0 ms |
| Final reply p95 | 4,953.8 ms | 25.8 ms |
| Model attempts | 7 | 0 |
| Reported input / output tokens | 11,077 / 417 | 0 / 0 |
| Pool SELECTs per request | 18 | 1 |

Five of six reported model completions used cached input before the change,
covering 84.4% of reported input tokens.

### Browser recording and playback

Run `node scripts/benchmark-buddy-voice.mjs <absolute-wav-path> 3250 6` from
`web` with the development server on port 5196 and both speech modes enabled.
Set `BUDDY_BENCH_EMAIL` and `BUDDY_BENCH_PASSWORD` for a dedicated test account.
`CHROME_PATH` and `BUDDY_BENCH_URL` override the local defaults.
The default transcript check expects the A1 “Good morning. How are you today?”
fixture. [Speech integration test](../../../test/speech.integration.test.ts)
Convert that clip to a 16 kHz mono PCM WAV with 180 ms of leading silence and
2 s of trailing silence, for example with FFmpeg's
`adelay=180:all=1,apad=pad_dur=2` filters.

Chrome fed the same file into its microphone input across six complete pairs
per version. Each pair used a real AssemblyAI WebSocket and a real AssemblyAI
recorded upload. Both paths also exercised the app's Edge audio playback.
Each of the four mode/version combinations transcribed the full two-sentence
greeting, returned a matching reply and started playback in 6/6 runs.

| From pressing Stop | Streaming p50, before → after | Recorded upload p50, before → after |
| --- | ---: | ---: |
| Complete transcript | 1,945 → 1,880 ms | 4,618 → 3,996 ms |
| First reply text | 3,745 → 1,903 ms | 6,360 → 4,026 ms |
| Audio playback | 5,536 → 1,981 ms | 6,786 → 4,068 ms |
| Audio playback p95 | 6,151 → 2,644 ms | 8,889 → 4,708 ms |

Transcription logic was identical across versions, so the transcript movement
reflects the two test windows. Repeated replies can share the synthesis cache.
The second sentence arrived after the WebSocket termination request in the
measured streaming turns. The client waits for the completed session before
sending the transcript to Buddy. The sample uses one replayed English clip on
development Chrome. Device latency can vary with the microphone, network,
and provider load.
[AssemblyAI message sequence](https://www.assemblyai.com/docs/streaming/message-sequence)

## Voice output latency

Edge TTS retains one idle connection per voice for up to 20 seconds. Distinct
concurrent clips can open separate connections. A failed idle connection can
be replaced once within the original eight-second deadline. The MP3 cache
still serves identical text and voice without synthesis.

Run `node --import tsx scripts/benchmark-speech-tts.mjs --trace` from `backend`
against the real Edge speech service. Add `--fresh-connection` to close idle
connections before each request and reproduce the original behavior. The
script calls the authenticated `/api/speech/synthesize` route with six English
and six Vietnamese sentences, then replays the same text and checks each MP3
against the original hash.

| Requests | Successful MP3, fresh → reuse | WebSocket upgrades | p50 | p95 |
| --- | ---: | ---: | ---: | ---: |
| Distinct sentences | 12/12 → 12/12 | 12 → 2 | 478.2 → 224.5 ms | 4,775.5 → 481.6 ms |
| Exact replays | 12/12 → 12/12 | 0 → 0 | 2.4 → 1.7 ms | 4.6 → 2.9 ms |

An earlier run returned 7/12 and 11/12 valid MP3s for new sentences before and
after reuse. Edge returned truncated streams and timeouts in that window.
The timings measure HTTP delivery of the complete MP3 over loopback. Microphone
capture, transcription, model generation and device playback are outside this
measurement.

### Playback between speech clips

For text longer than one clip, the web requests the next clip when the
current player has at most two seconds left. It only prepares one clip at
a time. Stop cancels the request, and a failed prefetch falls back to the
existing synthesis and retry flow at the clip boundary.

Run `node --import tsx scripts/benchmark-speech-playback.mjs` from `web`.
The fixture runs the web playback code with two simulated clips and a 90 ms
synthesis response. In 12 measured runs per version, every run played both
clips in order and used exactly two synthesis requests.

| Measure | Before | After |
| --- | ---: | ---: |
| First audio p50 | 94.0 ms | 94.6 ms |
| Gap between clips p50 | 94.9 ms | 0.1 ms |
| Gap between clips p95 | 96.6 ms | 0.3 ms |

This fixture measures overlap in the client. Network latency and audio
decoding on a learner's device can affect the actual gap.

## Coach prompt caching

The coach starts each model request with shared instructions and the public
catalogues relevant to the question or current screen. The current time, page, learner progress,
private videos, shop state, and chat follow that prefix. The Vietnam clock
follows learner data and uses minute precision, so clock changes leave more
of the prefix reusable. DeepSeek can reuse the
matching prefix through Token Harbor. With `LOG_LEVEL=debug`, the backend logs
`ai_provider_usage` with `prompt_tokens` and `cached_prompt_tokens` when Token
Harbor reports them. The Token Harbor usage dashboard shows cache reads and
the billed cost for each request.

## Study plan and web integration

- `GET /api/ai/study-plan` builds a snapshot and up to three study steps from
  stored progress, errors grouped by lesson topic, saved words, video
  progress and due review items. `buildStudyPlan` computes those steps without
  a model call. The optional two-sentence note receives the plan steps,
  learner level, due count and weak topics. Topic ranking uses the number of
  wrong attempts per topic. The note is reused for the same learner, study
  day, and prompt for up to five minutes. Progress and review data are read
  on every request, and a failed note can be retried on the next request.
- The web `VoiceOrb` uses `GET /api/buddy/nudges` and `POST /api/buddy/ask`.
  Try “Chuyển tab sang Hồ sơ”, “Tìm trận đấu”, “Gara có những gì?”,
  “Mua xe màu đỏ”, “Mở video mã ...”, or “Bao lâu rồi mình chưa học?”.
  Matchmaking highlights the Arena button after one second. A shop lookup
  highlights the item and reports its price and availability. Learners
  start matchmaking, confirm purchases, and save reminder suggestions
  through the corresponding app controls.
- Video lookup accepts a title, code or topic and uses the same access
  rules as the video API. Private videos are searchable by their owner.
  An exact unique video match or an exact item lookup in Gara can return
  directly from the catalogue. Unresolved, ambiguous and qualified requests
  keep the coach path. Both paths reuse any catalogue read within the turn.
  Video recommendations draw from the published library and honor an explicit
  CEFR level. An explicit private-library request searches the learner's own
  catalogue. A maximum duration uses each video’s stored length. Topic search
  understands Vietnamese and English curriculum
  terms, ranks exact phrases first, and offers choices for tied results.
  Targeted requests with matches in a large catalogue pass a shortlist to the
  model. Broad requests and unresolved queries retain the catalogue.
- The coach prompt includes the active page, recent study data, and catalogue
  entries relevant to the request. Shop requests receive prices and unlock conditions.
- `pickNextLesson` uses the same lesson state calculation as the learning API
  so the recommendation follows the roadmap's current unlocked lesson.

## Rules for the fallback

- Only a failed provider call uses the offline answer. Intent routing failing
  keeps the client's intent.
- Clear requests for explanation, plans, navigation help and practice select
  their prompt locally. Ordinary tutor dialogue uses the tutor directly.
  Ambiguous tutor requests can still use the configured intent classifier.
- The chat API uses local coach routes for common study requests. It preserves
  message and feedback shapes and cancels in-flight model work when a client
  disconnects before saving the turn.
- The coach offline answer is built from real rows, so a provider outage still
  returns grounded data.

## Reproducing the benchmark

Run from `backend` against a development database with the Engorace curriculum.
The script creates and cleans up a disposable learner and fixtures. Its default
simulated provider spends 125 ms on a reply. Pass `--live` for the configured
providers and `--stream` to request reply previews for supported chat cases.
Use `--case="study plan note"` to run one named scenario or set
`BUDDY_BENCH_CONCURRENCY=4` to exercise concurrent fixture requests.
Live runs report provider tokens and cache usage when the provider supplies
those fields. `pool_reads_per_request` counts SELECT statements through the
pool, outside the conversation-write transaction.

```text
node --import tsx scripts/benchmark-buddy.mjs
node --import tsx scripts/benchmark-buddy.mjs --live
node --import tsx scripts/benchmark-buddy.mjs --live --stream
node --import tsx scripts/benchmark-buddy.mjs --live --stream --evaluate
```

The development database runs used 24 serial samples per case with the simulated
provider. The random private video path fell from six to two pool reads.
The review-count path fell from 34 to two reads and one to zero model calls,
with p50 from 142.6 ms to 4.8 ms. The notebook lookup moved from 141.1 ms to
4.8 ms p50 and returned the saved gloss in 24/24 runs, up from 0/24 for the
provider fixture without the notebook data. This check covers retrieval of
that exact saved note. The generated coach path fell from 34 to 26 pool
reads. The study-plan note went from 7,171 to 1,292 UTF-8 prompt bytes per
request in the same earlier fixture.

In a three-sample live comparison of the study-plan note, p50 moved from
5.57 s to 1.81 s and total output tokens moved from 851 to 278. Later
four-sample runs put the note at 1.88 s and 3.03 s p50. Four coach samples
per mode showed first text at 1.91 s p50 with the JSON response and 1.65 s
with streaming. The streamed replies completed at 2.06 s p50. The provider
reported an input-token cache share of 89.3% for the JSON run and 86.8%
for the streaming run. A representative workload is needed to assess
production tail latency, cache reuse across topics, and model quality.

The follow-up and retrieval benchmarks each used 24 samples with the fixture
provider. Selecting the second destination went from 140.4 ms to 4.0 ms p50
and from 26 to three pool reads. Bilingual video recommendation went from
140.6 ms to 5.9 ms p50 and from 26 to two reads. Both tasks bypassed the model
and returned the expected destination in all 24 samples after the change.
Explicit recall recovered the old example in 24/24 samples with one model call
per turn. The baseline provider fixture had no access to the older example.
The 40-distractor catalogue test reduced UTF-8 prompt bytes from 16,068 to
10,323 and passed all 24 target checks before and after. Its measured p50
varied from 145.9 ms to 154.5 ms.

Ordinary tutor dialogue went from 235.1 ms to 140.5 ms p50 with the simulated
90 ms classifier. It kept its one generation call and skipped the classifier
in all 24 samples. On the live tense-comparison prompt, an experiment with
extra reasoning returned four usable replies in four samples, matching the
default, with p50 at 3.15 s versus 2.00 s. The shipped route keeps the faster
configuration and selects an explanation prompt for that request.

Targeted shop prompts went from 15,123 to 6,442 UTF-8 bytes per request
with 24/24 fixture results in both configurations. A general coach question
went from 26 to 18 pool reads with the same prompt size. The shop catalogue
loads when the query, page, remembered references, or a model action needs it.
The coach chat API recommendation went from 141.9 ms to 2.1 ms p50 and from
20 to two pool reads. The timed-plan case went from 141.2 ms to 3.2 ms p50
with accuracy checks passing in all 24 fixture runs. It uses due review items,
unlocked lessons, saved words and unfinished videos, within the specified
time budget.

The configured-provider suite passed 51/51 checks over 17 named tasks.
For generated coach questions, first visible text arrived at 1.39 s p50 and
the final reply at 2.09 s p50 over three samples. The standard cloze case
returned a checked answer in all three samples at 1.6 ms p50 with zero model
calls. Earlier live runs exposed a missing answer on the same task. These
checks use test accounts and a fixed rubric. Production load and diverse
learner phrasing need wider sampling.

With the plan-note cache warm and the learner state held constant, all
24 fixture requests reused the note. The previous path made a generation
call for every request. p50 moved from 136.2 ms to 1.2 ms and prompt bytes
per repeat request from 1,266 to zero. Four concurrent coach fixture
requests at a time passed 24/24 checks with p50 at 142.8 ms and p95 at
156.7 ms, including the fixture provider's 125 ms delay.

The explicit notebook, review, and reminder bundle went from 139.0 ms to
2.3 ms p50 in the fixture. All 24 requests returned both destinations and
the reminder while bypassing generation. Before the local route, the same
bundle reached 3/3 on the configured provider with p50 at 2.56 s.

`node --import tsx scripts/benchmark-ai-fallback.mjs` runs six concurrent
streams per case with a simulated upstream. With a silent primary, first text
p50 fell from 7.31 s to 4.31 s and completion p50 from 7.42 s to 4.42 s.
All six turns succeeded before and after and used two attempts each.
The healthy fixture succeeded in all six turns before and after with one
attempt each and first text p50 of 312 ms and 303 ms respectively.
The four-second threshold can create a second billable attempt if DeepSeek
resumes soon afterward. The fixtures measure event timing and calls.
They cannot measure production outage frequency or the costs of canceled calls.

To test a silent primary with the configured Gemini backup, run
`node --import tsx scripts/benchmark-buddy.mjs --live --stream --silent-primary --case="coach question"`.
In six measured turns, Gemini returned usable answers in all six with
first visible text at 4.87 s p50 and completion at 5.03 s p50 (5.30 s p95).
The primary delay was simulated. Only the Gemini attempts reached an external
provider. Gemini reported 9,643 input tokens and 563 completion tokens in
total and did not provide cache data in those responses.
The subsequent 17-task run against configured providers passed 51/51
checks. Three coach-question turns each used one model call, with first text
at 1.55 s p50, completion at 1.90 s p50 and a 90.2% reported cache token share.

## Tutor conversations and earlier examples

Topic-based tutor chats give the model the latest ten messages. On a recall
request, the tutor can find up to two matching exchanges from the latest 48
messages in the same chat. Clear requests for a previous example and short
personal statements with a time expression skip the intent classifier.
Ambiguous requests still use it when configured. Corrections and conversation
history use the existing message contract.

Set `BUDDY_BENCH_SAMPLES` to 12 and run
`node --import tsx scripts/benchmark-buddy.mjs --live --stream --case="tutor context" --require-pass`
from `backend`. The run streams tutor replies at the service boundary on a
development database. It tests an older example, a recent follow-up, a
missing example, and a grammar correction, three times each in fresh chats.

| Measure | Before | After |
| --- | ---: | ---: |
| Correct turns by rubric | 8/12 | 12/12 |
| Exact older example recalled | 0/3 | 3/3 |
| First text p50 | 3,006.4 ms | 2,740.7 ms |
| Completion p50 | 3,017.9 ms | 2,824.5 ms |
| Completion p95 | 3,543.2 ms | 3,670.9 ms |
| Intent classifier calls | 12 | 3 |
| Generation calls | 12 | 12 |
| Pool SELECTs per turn | 8 | 7 |
| Prompt bytes per turn | 1,611 | 1,381 |
| Generation input tokens | 5,001 | 4,584 |
| Generation output tokens | 1,914 | 1,847 |
| Requests reporting a cache hit | 7/12 | 9/12 |
| Cached share of reported input tokens | 90.7% | 58.9% |

The other baseline miss was a tentative answer to a missing-example question.
The two runs had different cache-report coverage. They show a lower cached
token share and a higher p95 in this sample. They do not establish the effect
of the stable instruction prefix across topics or on production traffic.

## Tutor conversation openings

A standalone greeting as the first message of a topic-based tutor chat gets
one short English question about the selected topic. The opening uses the
existing chat reply and persists the exchange. The model handles greetings
in existing conversations and requests with extra instructions.

Set `BUDDY_BENCH_SAMPLES` to 16 and run
`node --import tsx scripts/benchmark-buddy.mjs --live --stream --case="tutor opening" --inspect-failures`.
The workload sends `Hello!` twice per topic, each time in a fresh chat on
the development database. The check requires exactly one on-topic question
and an empty correction list.

| Measure | Before | After |
| --- | ---: | ---: |
| Correct openings | 15/16 | 16/16 |
| First text p50 | 1,030.8 ms | 3.8 ms |
| Completion p95 | 1,459.3 ms | 5.6 ms |
| Model attempts | 16 | 0 |
| Pool SELECTs per turn | 7 | 1 |
| Input tokens | 3,234 | 0 |
| Output tokens | 398 | 0 |

The provider did not report cache usage in the before run. The opening path
uses no model cache. The measurement includes chat persistence and excludes
network transit and client rendering.

## Brief tutoring for self-contained turns

Short, self-contained tutor turns can use `reasoning_effort: none` with the
supported DeepSeek Flash primary. The tutor keeps standard reasoning for
recognizable references to earlier turns, compound sentences and requests for
explanations. A reference turn also instructs the tutor to use the concrete
detail from the chat or ask a clarification. Conversation history, corrections,
response limits and the configured fallback still apply.

Set `BUDDY_BENCH_SAMPLES` to 48 and run
`node --import tsx scripts/benchmark-buddy.mjs --live --stream --case="tutor reasoning" --inspect-failures`
from `backend` to alternate the two settings on eight synthetic learner
requests. Each request uses a fresh learner and the same chat data in each
arm. The comparison changes only the reasoning field in the primary request.
Add `--shipped-reasoning` to exercise the actual service routing without a
request override.

| Measure, 24 turns per setting | Standard | Brief |
| --- | ---: | ---: |
| Time before generation request, p50 | 10.7 ms | 9.4 ms |
| First text p50 | 2,387.2 ms | 1,325.8 ms |
| First text p95 | 4,028.9 ms | 4,169.6 ms |
| Completion p50 | 2,658.7 ms | 1,590.0 ms |
| Completion p95 | 4,090.5 ms | 4,236.6 ms |
| Generation attempts | 24 | 24 |
| Input tokens reported by the provider | 5,949 | 4,821 |
| Output tokens reported by the provider | 3,431 | 1,454 |
| Reported cache token share | 58.1% | Unavailable |

The strict initial rubric passed 23/24 standard and 22/24 brief responses.
Both brief misses were responses to “I enjoyed it” that omitted the referenced
dish. The standard miss used a relevant school follow-up outside the original
word list. Both settings passed all 16 checks in an earlier paired run. That
run included one 7.13 s brief turn. Most of the measured delay in the slow
turns occurred before visible text. The provider reported cache hits on all
24 standard attempts in the larger run and supplied no cache fields for the
brief attempts. These runs demonstrate a median gain on synthetic practice
turns. Production tail latency and cache behavior need separate evidence.

After enabling the scoped rule and the reference instruction, the actual
service routing passed 24/24 checks. It used brief mode on 21 turns and
standard reasoning on the three reference turns, with one generation per
turn and no classifier calls. First visible text arrived at 1,314.5 ms p50
across all 24 turns and 1,306.2 ms p50 on the brief subset. Completion p95
was 2,344.2 ms for the mixed run. This verification used a later provider
window and cannot attribute the lower tail to the routing change.

## Fallback for brief tutor streams

With a supported primary and a distinct configured fallback, a brief tutor
stream can start the existing tutor fallback after three seconds without
non-blank content. A shorter overall deadline reduces that threshold. Real
primary content stops the timer. Both attempts share the turn deadline. The
first reply that passes validation wins and any preview from the other reply
is cleared. The standard tutor path and JSON requests use sequential fallback.

Run `node --import tsx scripts/benchmark-ai-fallback.mjs --tutor` from
`backend` for six concurrent simulated turns per case with a 30-second
budget. Both providers return the expected tense correction. The slow
primary waits 5.2 seconds before it starts to respond.

| Primary behavior | First text p50, before → after | Completion p50, before → after | Model attempts | Correct turns |
| --- | ---: | ---: | ---: | ---: |
| Healthy | 307 → 309 ms | 408 → 420 ms | 6 → 6 | 6/6 in both |
| Already writing | 310 → 312 ms | 3,622 → 3,627 ms | 6 → 6 | 6/6 in both |
| Slow but responsive | 5,531 → 3,327 ms | 5,639 → 3,437 ms | 6 → 12 | 6/6 in both |
| Silent | 18,319 → 3,325 ms | 18,428 → 3,436 ms | 12 → 12 | 6/6 in both |

The supported primary can resume just after the threshold. In that case a
second attempt may already be billable. In eight ordinary tutor turns with
the configured text providers, all eight succeeded, first text arrived at
1,193.6 ms p50, and one turn started a second attempt. The measured turns do
not estimate the frequency of slow requests in production.

To use the configured tutor fallback while simulating primary silence, set
`BUDDY_BENCH_SAMPLES=3` and `BUDDY_BENCH_CONCURRENCY=3` and run
`node --import tsx scripts/benchmark-buddy.mjs --live --stream --silent-primary --case="tutor backup" --inspect-failures`.
First text p50 moved from 26.54 to 11.60 seconds and completion p50 from
26.70 to 11.69 seconds. The slowest completion moved from 27.30 to 28.31
seconds. Both measured runs corrected `goed` to `went` in all three turns.
Each run issued six attempts, three of which reached an external provider.
Reported input and output tokens moved from 717 to 720 and 202 to 222,
respectively. The fallback did not report cache usage. A warm-up in an
earlier run timed out. A healthy fallback remains necessary for this path
to reduce the time the learner waits.

## Gemini reasoning experiment

The configured Gemini 3.5 Flash endpoint accepted `reasoning_effort: minimal`
and returned a valid tense correction in a direct probe. In one paired tutor
experiment, 7 of 16 requests received HTTP 429. A rerun spacing requests by
eight seconds received HTTP 429 on 15 of 16 requests, affecting both arms.
These runs do not establish a quality or latency comparison. The runtime
uses the configured Gemini reasoning defaults.

To repeat the experiment, set `BUDDY_BENCH_SAMPLES=16` and run
`node --import tsx scripts/benchmark-buddy.mjs --live --stream --case="tutor reasoning" --gemini-reasoning --inspect-failures`.
The benchmark isolates the configured Gemini fallback and uses the same
fresh-chat fixtures for both arms. `GEMINI_TUTOR_BENCH_INTERVAL_MS` controls
the spacing. It reports HTTP failures separately from completed-reply latency
and records total tokens when the provider supplies them.
[Gemini OpenAI compatibility documentation](https://ai.google.dev/gemini-api/docs/openai#thinking)

## Expo chat transport benchmark

Run `node --import tsx scripts/benchmark-ai-chat-stream.mjs` from `backend`
to compare JSON and NDJSON over HTTP with the Expo app's stream decoder.
Pass `--live` for the configured provider and `--mode=json` for the legacy
response. The script creates and deletes a test learner. It warms each
mode once and runs six samples per mode by default on fresh chat threads.

The generated study-coach endpoint went from 20 to 18 SELECTs per turn by
loading the coach's learner context and study snapshot in parallel and
skipping tutor-only queries. In the same-code fixture comparison, first text
arrived at 620.9 ms p50 with JSON and 212.3 ms with NDJSON. Final responses
arrived at 620.9 ms and 621.1 ms p50 respectively. Each mode passed 6/6
checks with six model calls and 5,836 prompt bytes per request.

In a six-sample configured-provider comparison, first text was 2.04 s p50
with JSON and 1.65 s p50 with NDJSON. Final response p50 was 2.04 s and 2.24 s
respectively. Each mode passed 6/6, used six model calls and reported 10,748
input tokens in total with a 94.1% cached-token share. Completion token totals
were 545 and 517, respectively. The fixture isolates the transport gain. The
live measurements include provider variation and local HTTP, so mobile
network and production tail latency may differ.

## Expo study-plan preview

The Plan tab sends `Accept: application/x-ndjson` on `GET /api/ai/study-plan`.
On a cold note, the `plan` event makes the snapshot and three navigable steps
available while generation runs. The `answer` event adds the note. An
unavailable note leaves the steps usable. A ready cached note is sent with
the complete plan in one event. Clients requesting JSON still receive the
same complete plan and envelope.

Run `node --import tsx scripts/benchmark-ai-chat-stream.mjs --plan` from
`backend`. Add `--live` for configured providers. Each mode uses six cold
learners with the same starting data. The app's decoder records time to usable
steps over local HTTP.

| Provider | Steps p50, JSON → stream | Steps p95, JSON → stream | Complete p50, JSON → stream | Correct plans |
| --- | ---: | ---: | ---: | ---: |
| 600 ms fixture | 608.0 → 4.1 ms | 623.3 → 7.8 ms | 608.0 → 608.5 ms | 6/6 in both |
| Configured | 1,877.7 → 5.8 ms | 2,101.6 → 6.8 ms | 1,877.7 → 1,971.1 ms | 6/6 in both |

Each mode issued six generation calls and eight pool SELECTs per plan. Each
configured-provider mode reported 2,178 input tokens and six requests with a
cache hit, accounting for 70.5% of input tokens. Output totals were 542 and
532 tokens. The measured gain is when the learner can start the plan. The note
still takes time to generate. The sample excludes mobile network and device
rendering time.

## Expo navigation and review

Chat and plan destinations open the existing lesson, roadmap, video and
notebook screens. A locked lesson opens its position on the roadmap. The
video screen includes its active title and topic in the coach's page context.
Review buttons open the due queue from `GET /api/review`. The existing
answer endpoint grades typed vocabulary and lesson questions and updates
their schedules. Reloading the queue preserves the next due date unless a
newer mistake makes that item due again.

Set `AI_CHAT_BENCH_SAMPLES` to 24 and run
`node --import tsx scripts/benchmark-ai-chat-stream.mjs --destinations --mode=stream`
to check the ordered request to open the notebook, translation and due review.
All 24 turns returned all three mobile routes in order with no generation
calls or prompt tokens. The HTTP fixture was 6.0 ms p50 and 8.1 ms p95,
with one pool SELECT per turn. It measures the chat response before the
learner taps a destination.

## Exact catalogue lookups

Run the provider benchmark with `--live --case="catalogue retrieval prompt"`
or `--live --case="shop item discovery"`. Each case used six measured turns
before and after. The video case included 40 unrelated catalogue entries.

| Request | p50 before → after | p95 before → after | Pool SELECTs per turn | Correct turns |
| --- | ---: | ---: | ---: | ---: |
| Find a video about grocery shopping A2 | 1,955 → 3.8 ms | 2,781 → 7.9 ms | 18 → 2 | 6/6 → 6/6 |
| Find a streak shield in the shop | 1,785 → 7.6 ms | 2,242 → 12.0 ms | 26 → 9 | 6/6 → 6/6 |

Each case went from six generation calls to zero. Before the change, the
provider reported 18,395 input tokens and 416 completion tokens for the
video case, with a 96.0% cached-token share. Gara used 12,190 input tokens
and 550 completion tokens, with a 91.4% cached-token share. The measured
lookups now use zero tokens. These timings cover the named lookups on the
development database.

## Mixed learner requests

Set `BUDDY_BENCH_SAMPLES` to 24 and `BUDDY_BENCH_CONCURRENCY` to 4. Run
`node --import tsx scripts/benchmark-buddy.mjs --live --stream --case="mixed learner requests" --inspect-failures`
from `backend`. Add `--require-pass` to fail the benchmark when a task
misses its rubric.

The workload interleaves 12 English and Vietnamese prompts on one test
learner, twice each. The checks cover published and private video
recommendations, unavailable levels, maximum durations, study budgets,
open-ended grammar, and a compound request. Video fixtures include similar
titles at different durations and CEFR levels.

| Measure | Before | After |
| --- | ---: | ---: |
| Correct turns | 6/24 | 24/24 |
| First text p50 | 1,621.7 ms | 36.7 ms |
| Final reply p50 | 2,114.5 ms | 36.7 ms |
| Final reply p95 | 2,681.6 ms | 2,258.4 ms |
| Generation attempts | 23 | 4 |
| Input tokens reported | 51,667 | 7,666 |
| Output tokens reported | 2,095 | 390 |
| Cached share of reported input tokens | 79.9% | 86.8% |

The cache share describes the model calls left in each run. The changed
mix limits direct comparison of cache behavior. The four remaining model
calls were the two grammar cases. Results measure the Buddy service with
a development database and configured providers. Production traffic,
audio transport, and other formulations need separate evidence.
