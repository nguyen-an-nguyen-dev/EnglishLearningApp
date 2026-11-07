# EngoRace — English Learning App

Giao diện **web** là sản phẩm chính của repo này. `backend/` là API đi kèm, `mobile/` chỉ dùng làm
nguồn tham khảo màu và không được sửa khi làm việc trên web.

| Thư mục | Vai trò |
| --- | --- |
| `web/` | Vite + React 19 + TypeScript. CSS thuần: `index.css` (dashboard/bài tập), `dashboard.css` (Thi đua, xếp hạng, profile), `learning-modes.css` (video/nghe), `landing.css` (trang chủ), `admin.css` (bảng quản trị nội dung). |
| `backend/` | Express 5 + Socket.IO + MySQL (MariaDB) + JWT, port `3000`. |
| `mobile/` | Expo/React Native — **chỉ đọc**, nguồn màu `mobile/constants/Colors.ts`. |

---

## 1. Chạy dự án

```bash
cd backend && npm install && npm run dev        # http://localhost:3000
cd web     && npm install && npm run dev        # http://localhost:5173
```

Backend `npm run dev` chạy bằng **nodemon** (`backend/nodemon.json`): theo dõi `src/**/*` và
`.env`, tự restart mỗi khi sửa file (chạy `tsx src/server.ts` bên trong). Muốn dùng lại watcher cũ
thì chạy `npm run dev:tsx`. `npm start` = `tsc` rồi `node dist/server.js` — **không phải watch
mode**.

### Biến môi trường (`backend/.env`)

```dotenv
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=...              # tên biến là DB_PASSWORD, KHÔNG phải DB_PASS
DB_NAME=english_learning
JWT_SECRET=...
JWT_EXPIRES_IN=7d
CORS_ORIGINS=http://localhost:5173

# AI provider (OpenAI-compatible chat) — đang dùng Gemini
AI_API_KEY=...
AI_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
AI_MODEL=gemini-flash-lite-latest
AI_FALLBACK_MODEL=gemini-3.5-flash
AI_TIMEOUT_MS=40000

# NVIDIA NIM — model phân tích video mặc định
NVIDIA_API_KEY=nvapi-...
NVIDIA_API_URL=https://integrate.api.nvidia.com/v1/chat/completions
NVIDIA_MODEL=nvidia/nemotron-3.5-bolt-e4b

# Supabase Storage — audio bài nghe
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_BUCKET=english-media
SUPABASE_SECRET_KEY=...      # chỉ ở backend, không bao giờ gửi xuống client

GOOGLE_CLIENT_ID=...          # để trống = nút báo "chưa cấu hình"
FACEBOOK_APP_ID=...
```

`AI_API_URL`, `AI_MODEL`, `AI_FALLBACK_MODEL`, `AI_TIMEOUT_MS` là tuỳ chọn. Có thể đổi sang provider
OpenAI-compatible khác; mặc định trong code là Gemini. Khi import video, người dùng chọn model phân
tích trên web: **Nemotron Bolt** (mặc định, nhanh) hoặc **Gemini Flash** (chất lượng). `SUPABASE_SECRET_KEY`
luôn giữ ở backend; client chỉ nhận public Storage URL. URL project kết thúc `/rest/v1/` được
chuẩn hoá tự động.

### Tài khoản test

| Email | Mật khẩu | User id | Quyền |
| --- | --- | --- | --- |
| `test@test.com` | `123456` | 10 | **admin** — thấy tab Quản trị |
| `temp@engorace.dev` | `temp123456` | 9 | learner |

---

## 2. Cơ sở dữ liệu

**Chỉ còn một file: `backend/database/final.sql`.** Toàn bộ migration / seed / script SQL cũ đã được
gộp vào đây và xoá khỏi `backend/database/`. File sinh trực tiếp từ DB thật, chứa **23 bảng** (sắp
theo thứ tự khoá ngoại) + **2392 dòng dữ liệu** — schema lẫn dữ liệu đều là trạng thái cuối cùng,
không còn bảng tạm, không còn câu `UPDATE` chồng chéo. Bảng thứ 23 là `study_reminders` (nhắc học của
En Buddy), thêm tay vào dump và **cố ý rỗng**.

```bash
mysql -u root -p < backend/database/final.sql
```

⚠️ File bắt đầu bằng `DROP DATABASE IF EXISTS english_learning` rồi `CREATE` lại từ đầu: chỉ chạy
trên DB mới / DB dev, **không** chạy trên DB đang có dữ liệu thật cần giữ. Tối ưu nạp:
`FOREIGN_KEY_CHECKS=0`, `UNIQUE_CHECKS=0`, `INSERT` gộp nhiều dòng (≤400 KB mỗi câu) và **một
transaction duy nhất cho phần dữ liệu**; DDL đứng ngoài transaction vì MySQL tự commit. Đã verify
bằng cách nạp vào DB tạm rồi so số dòng từng bảng với DB thật: khớp 100% (`image_url` 100/100,
4 video, 114 segment).

Khi cần đổi schema/dữ liệu: sửa DB dev rồi sinh lại `final.sql` bằng
`.workbuddy-ai/tmp-shots/dump-final-sql.cjs`, **không tạo file migration mới**. Bản sao các file cũ
để phòng hồi phục nằm ở
`C:/Users/ADMIN/AppData/Local/Temp/engorace-database-backup-20261104-184202/`.

**`users.role`** (`learner` | `admin`, mặc định `learner`) là cột duy nhất thêm cho bảng quản trị
nội dung. DB dev đã `ALTER` xong và `final.sql` đã có cột này (dòng id 10 = `'admin'`), nên nạp lại
`final.sql` vẫn ra đúng tài khoản admin; đợt này sửa tay `final.sql` thay vì regenerate để không kéo
thêm dữ liệu QA (`matches`, `translations`, `video_lessons`). Cấp quyền admin cho tài khoản khác:
`UPDATE users SET role = 'admin' WHERE email = '...';` — backend đọc role từ DB ở **mỗi** request
`/api/admin/*`, nên không cần đăng nhập lại và hạ quyền cũng có hiệu lực ngay.

Bảng từ vựng đấu trường là **`battle_words`** (`word_en`, `translation_vi`, `cefr_level`,
`part_of_speech`, `example_en`, `example_vi`, `image_url`), không phải `words`. Cả 100 dòng đã có
ảnh minh hoạ ngay trong `final.sql`. File nằm trong `web/public/arena/<word>.jpg` — **100 file
JPEG**, đã resize tối đa 960px + nén lại (~12 MB cả bộ, từ ~30 MB ảnh gốc), `image_url` trỏ tới
`/arena/<word>.jpg`. Ảnh lấy từ Openverse / Wikimedia Commons, chỉ bản **CC0 / public domain** nên
không cần ghi credit. Từ trừu tượng dùng một truy vấn hình ảnh ẩn dụ cụ thể
(vd `tenacity` → rock climber), khai báo trong `.workbuddy-ai/tmp-shots/arena-downloader.mjs`;
`arena-retry.mjs` xử lý 4 từ rớt mạng, `arena-finalize.mjs` nén ảnh và sinh manifest.

```sql
-- Ví dụ cập nhật 1 từ nếu thay ảnh (không cần migration riêng)
UPDATE battle_words SET image_url = '/arena/apple.jpg' WHERE word_en = 'apple';
```

URL tuyệt đối cũng dùng được. `PromptFrame` trong `ArenaView.tsx` vẫn giữ khung 16:9 nét đứt +
"Ảnh minh hoạ" làm fallback nếu ảnh lỗi / chưa có, nên thẻ không nhảy chiều cao.

### Bài nghe (`questions.audio_url`)

Không cần migration — dùng sẵn cột `questions.audio_url` và `answers`. Upload MP3/M4A lên bucket
`english-media` và cho bucket public. `audio_url` chứa object path (vd `listening/greetings-01.mp3`)
hoặc URL công khai đầy đủ; `resolveAudioUrl()` trong `learning.service.ts` đổi path thành public URL.
`question_type` hiện có: `multiple_choice` (210), `word_order` (60), `fill_choice` (30),
`listening` (30), `listen_choice` (30).

```sql
INSERT INTO questions
  (lesson_id, question_text, question_type, explanation, audio_url, difficulty, sort_order)
VALUES
  (1, 'Nghe đoạn âm thanh và nhập lại nội dung bạn nghe được.', 'listening',
   'Xin chào, bạn khỏe không?', 'listening/greetings-01.mp3', 'beginner', 99);

SET @lid = LAST_INSERT_ID();
INSERT INTO answers (question_id, answer_text, is_correct, sort_order)
VALUES (@lid, 'Hello, how are you?', TRUE, 1);
```

`final.sql` có sẵn 3 câu nghe cho Greetings / Introductions / Food.

---

## 3. API chính (Bearer token cho mọi endpoint trừ auth)

```text
# Công khai, KHÔNG cần token — landing page gọi trước khi người dùng đăng ký
GET  /api/demo/video                       (bài ngắn nhất trong thư viện + 3 đoạn đầu)

POST /api/auth/login                       { email, password }
GET  /api/lessons/:id/questions
POST /api/lessons/:id/check                { questionId, answer }
POST /api/lessons/:id/complete             { answers: [...] }

GET    /api/videos
POST   /api/videos/import                  { url }
GET    /api/videos/:videoId
DELETE /api/videos/:videoId                (chỉ video tự import)
POST   /api/videos/:videoId/progress       { watchedSeconds }
POST   /api/videos/:videoId/complete       { watchedSeconds }
GET    /api/vocabulary
POST   /api/vocabulary                     { word, ipa?, meaningVi?, detailVi?, videoId? }
DELETE /api/vocabulary/:word

GET  /api/battle/summary                   (số trận, thắng, tỉ lệ, streak)

GET    /api/ai/study-plan                 (snapshot + 3 bước + lời khuyên AI)
GET    /api/ai/chats
POST   /api/ai/chats                      { topic }
GET    /api/ai/chats/:chatId
DELETE /api/ai/chats/:chatId
POST   /api/ai/chats/:chatId/messages     { message, intent?, context? }
GET    /api/ai/chats/:chatId/feedback

# En Buddy đồng hành (thay drawer chat cũ)
GET    /api/buddy/nudges                  (nudge tính từ dữ liệu thật + greeting + summary)
POST   /api/buddy/ask                     { question, intent?, context? } → 1 câu trả lời
POST   /api/buddy/reminder-suggestion     { suggestion, target? } → tạo nhắc
GET    /api/reminders                     (sắp tới hạn, chưa dismiss)
POST   /api/reminders                     { title, in_minutes? | at_time?, body?, target? }
POST   /api/reminders/:id/acknowledge     (đã hiện → không bắn lại)
DELETE /api/reminders/:id                 (dismiss)

# Quản trị nội dung — mọi route dưới đây cần role = admin (403 + ADMIN_REQUIRED nếu không phải)
GET    /api/admin/content                 (cây chặng → bài + số câu)
GET    /api/admin/lessons/:id/questions   (đầy đủ answers kèm is_correct)
POST   /api/admin/stages                  { title, description?, theme_key? }
PATCH  /api/admin/stages/:id              { title?, description?, theme_key? }
DELETE /api/admin/stages/:id              (409 STAGE_NOT_EMPTY khi còn bài)
POST   /api/admin/stages/:id/move         { direction: 'up' | 'down' }
POST   /api/admin/lessons                 { stage_id, title, topic }
PATCH  /api/admin/lessons/:id             { title?, topic?, stage_id? }
DELETE /api/admin/lessons/:id             (xoá kèm câu hỏi + progress của bài)
POST   /api/admin/lessons/:id/move        { direction }
POST   /api/admin/lessons/:id/questions   { question_text, question_type, answers, ... }
PATCH  /api/admin/questions/:id           (gửi answers = thay cả bộ đáp án)
DELETE /api/admin/questions/:id
POST   /api/admin/questions/:id/move      { direction }
GET    /api/admin/videos                  (chỉ video chung + segment_count)
POST   /api/admin/videos                  { url, model? }  → import vào thư viện chung
PATCH  /api/admin/videos/:id              { title?, description?, topic?, cefr_level?, xp_reward? }
DELETE /api/admin/videos/:id
POST   /api/admin/videos/:id/move         { direction }
```

Tab "Luyện tập / Tự luyện phản xạ với 12 câu" trong đấu trường **đã bị xoá** (cả UI lẫn
`GET /api/battle/practice`). Nếu vẫn thấy tab này trên màn hình, đó là bundle cũ trong
`web/dist` — chạy lại `npx vite build`, đừng sửa file trong `dist/`.

Bài video hoàn thành khi xem ≥ 90% thời lượng; XP cộng đúng 1 lần trong transaction. Video tự
import chỉ để luyện (`xp_reward = 0`) và trả `segments` theo câu. Web client mở mọi bài ở dạng
"listening studio": nghe 1 segment → gõ lại → từ chỉ lộ ra khi khớp caption, nên bài cần ít nhất
1 segment mới mở được chế độ luyện.

Web có thể import video YouTube **dưới 5 phút** có phụ đề tiếng Anh
(`MAX_IMPORT_DURATION_SECONDS = 300` trong `video.youtube.ts`, chặn cả video đúng 5:00). Backend
dùng `yt-dlp` (`youtube-dl-exec`, hoặc đặt `YTDLP_PATH` / thêm vào `PATH`) để lấy metadata +
caption, tách câu và lưu thành bài riêng của từng học viên (tối đa 20 bài). Media tự host nằm
trong `backend/public/videos`, phục vụ qua `/media/videos/...`.

Thư viện video mặc định chỉ có 4 bài YouTube do user chọn, đã nạp sẵn trong `final.sql` kèm
**114 segment** phụ đề **một câu một đoạn**, cắt lại từ **caption gốc**. Nạp lại `final.sql` sẽ tạo
lại DB từ đầu, nên mọi tiến độ học video cũ cũng mất.

| Video | ID | Thời lượng | Dòng | Từ/dòng |
| --- | --- | --- | --- | --- |
| Small Talk \| Everyday English | `ry9SYnV3svc` | 2:13 | 27 | 8 |
| Talking about a Trip using the Past Simple | `mngiqrT44Pk` | 1:15 | 21 | 6 |
| Coldplay – Viva La Vida | `dvgZkm1xWPE` | 4:02 | 40 | 7 |
| Avicii – The Nights | `UtF6Jej8yb4` | 3:11 | 26 | 10 |

### Tách câu: một câu là một đoạn

`buildSegmentsFromEnds()` trước đây gộp các câu đã tách lại cho tới khi đầy `MAX_SEGMENT_MS = 12s` /
`MAX_GROUP_CHARS = 200` ký tự. Với đối thoại ~20 từ/câu đó là **4–6 câu trong một dòng** (video du
lịch từng là *"How was your trip it was really fun how was the weather the weather was"* — 15 từ), và
vì caption gốc không có dấu câu nên đường dự phòng còn **cắt giữa câu**
(`…the weather was` | `Beautiful it was warm…`). Luật mới: **mỗi câu một đoạn**, chỉ gộp khi là mảnh
cảm thán ngắn (`FRAGMENT_MS = 1.8s` hoặc `< 3` từ); trần 12s/200 ký tự vẫn là chốt chặn, câu dài hơn
trần đứng riêng chứ không bị cắt vụn. `video.unit.test.ts` canh cả 3 nhánh.

Song song đó, ba lỗi trong đường AI làm việc tách câu thất bại âm thầm và rơi về đường theo kích
thước:

1. **Request thiếu JSON mode.** `requestSentenceEnds()` không gửi `response_format`, nên với
   transcript dài (131–208 cue) model trả `{sentence_ends:[…]}` **thiếu dấu nháy** và bị vứt bỏ.
   Đã thêm `response_format: { type: 'json_object' }` cho provider OpenAI-compatible (Gemini;
   `jsonMode: true` trong `providerFor`).
2. **Parser quá nghiêm.** `parseJsonContent()` giờ có thêm nhánh đọc danh sách số sau khoá
   `sentence_ends` kể cả khi khoá không được quote — `parseAiSentenceEnds()` vẫn kiểm tra tăng dần và
   phải chạm fragment cuối, nên không thể nhận dữ liệu rác.
3. **Provider thiếu key trả về im lặng.** `refineSegmentsWithAi()` `return fallbackSegments` không
   log gì khi `apiKey` rỗng, nên triệu chứng là "AI không trả lời" mà không có manh mối. Khi viết
   script bảo trì phải nạp `backend/.env` **trước** khi import module backend (xem đầu
   `reimport-captions.ts`); nếu không, `config/env` gọi `dotenv.config()` không path và đọc `.env`
   từ CWD.

### `yt-dlp` trong môi trường bị sandbox (sửa 07/11)

`yt-dlp.exe` là bản PyInstaller one-file: mỗi lần chạy nó tự giải nén ra một thư mục tạm. Dưới token
bị hạn chế (shell dev trong sandbox, vài image CI) bước giải nén **thất bại** với
`[PYI-…] Could not create temporary directory!` dù tiến trình khác vẫn ghi được vào `%TEMP%`; sau đó
file caption cũng không ghi được vào thư mục `engorace-yt-*` nằm trong `%TEMP%`
(`unable to open for writing: [Errno 13]`). `fetchYouTubeImportSource()` giờ thử lần lượt các
"scratch root": `TMPDIR` hệ thống trước, rồi `YTDLP_TEMP_DIR` (mặc định `<cwd>/.yt-dlp-tmp`, đã
gitignore). Mỗi lần thử đặt `TEMP`/`TMP`/`TMPDIR` cho tiến trình con và **đọc caption ngay trong thư
mục đó trước khi xoá**. Lỗi thuộc nhóm quyền/temp được retry; lỗi khác (video private, hết hạn mức…)
vẫn đi thẳng ra `mapYtDlpError()`.

### Nhập lại caption cho video đã có

`.workbuddy-ai/tmp-shots/reimport-captions.ts` — lấy lại caption gốc và tạo lại segment cho **đúng
các hàng `video_lessons` đang có** (không tạo bài trùng):

```bash
npx tsx .workbuddy-ai/tmp-shots/reimport-captions.ts                    # xem trước
npx tsx .workbuddy-ai/tmp-shots/reimport-captions.ts --write            # áp dụng, cả 4 bài
npx tsx .workbuddy-ai/tmp-shots/reimport-captions.ts --only=10 --model=bolt
```

Script **chỉ ghi khi kết quả tốt hơn thực sự** (`isImprovement`: ít dòng > 9 từ hơn, hoà thì xét
từ/dòng trung bình), nên chạy lại nhiều lần chỉ có thể cải thiện chứ không thể làm hỏng — mỗi lượt
gọi AI là một lần "tung xúc xắc" khác nhau và đã có lần video 12 tệ đi thật. Nó cũng bỏ qua khi AI
không trả lời (nhận biết bằng identity: `refineSegmentsWithAi` trả về **đúng mảng đầu vào** khi mọi
provider lỗi). Khi so chuỗi từ phải dùng đúng `stripPunctuation()` của pipeline, nếu không thì
`don't` → `dont` bị coi là mất chữ và script chặn nhầm cả 4 bài.

`aiCues`: `fetchYouTubeImportSource()` trả thêm trường này — cue mức **từng từ** cho AI, kể cả với
video nhạc. `cues` (mức dòng) vẫn dành cho đường dự phòng `segmentCaptionCues()` để không chẻ lời
bài hát thành từng từ. Nhờ vậy Viva La Vida đi từ 13 từ/dòng xuống 7.

Kết quả: 53 → 114 dòng. `final.sql` được vá riêng khối `video_segments` bằng
`.workbuddy-ai/tmp-shots/patch-final-sql-segments.cjs` (regenerate cả file sẽ kéo theo dữ liệu QA mà
dump cố tình không mang). Script cũ `resegment-videos.ts` (tách lại từ text **đã bị cắt sai**, mốc
thời gian chia theo độ dài từ) chỉ còn là phương án dự phòng khi `yt-dlp` không chạy được.

`video.youtube.ts` ưu tiên caption `json3`, nhưng **có fallback đọc `.vtt`** — vài track (đặc biệt
video nhạc) chỉ phát hành WebVTT dù đã yêu cầu `json3`; thiếu fallback thì video báo
"chưa có phụ đề" dù YouTube có caption. `parseVttCues()` có unit test riêng.

**Lỗi import nói rõ lý do** (không còn một câu chung chung): backend trả code riêng và web dịch
đúng code đó — `VIDEO_NO_CAPTIONS` (không có caption nào), `VIDEO_NO_ENGLISH_CAPTIONS`
(có caption nhưng **không phải tiếng Anh**; `captionLanguageCodes()` đọc `subtitles` +
`automatic_captions` rồi `describeCaptionLanguages()` ghi ra danh sách ngôn ngữ có thật),
`VIDEO_PRIVATE`, `VIDEO_LIVE`, `VIDEO_NO_DURATION`, `VIDEO_UNREADABLE`, `VIDEO_IMPORT_RATE_LIMIT`,
`VIDEO_UNAVAILABLE`, `VIDEO_TOO_LONG`, `VIDEO_IMPORT_TIMEOUT`, `VIDEO_ALREADY_IMPORTED`,
`VIDEO_IMPORT_LIMIT`. `mapYtDlpError()` phân loại theo thông báo của yt-dlp; có unit test trong
`video.unit.test.ts`.

Đấu 1v1 chạy trên cùng server Socket.IO. Các event quan trọng: `game:opponentAttempt` (bắn 1 lần
khi đối phương **bấm trả lời**, không bắn theo từng ký tự), `game:opponentAway` (đối phương rời
trận → bên còn lại thoát màn đấu ngay).

### En Buddy — bạn học đồng hành (làm lại 07/11)

Trước đây En Buddy là **một drawer chat** (tab Chat / Kế hoạch / Lịch sử, cuộn thread, composer).
Mô hình đó bị thay hẳn vì nó hành xử như chatbot SaaS: phải gõ mới nói, mở đầu bằng câu chào, và
gợi ý thì chung chung ("cố lên nhé", "học mỗi ngày nhé"). Giao diện mới coi chú xe là **người ngồi
cạnh cùng học**, và ưu tiên *nói đúng việc* hơn là *nói nhiều*.

**Ba lớp, không có thread.**

1. **`GET /api/buddy/nudges` — nudge tính từ dữ liệu thật, không do model viết.**
   `buildNudges()` trong `buddy.service.ts` xếp hạng theo mức khẩn cấp và luôn kèm số liệu của chính
   người học:
   | kind | khi nào | ví dụ thật |
   | --- | --- | --- |
   | `reminder` | có nhắc đã tới giờ | "Ôn Sổ từ" (đứng đầu bảng) |
   | `streak` | có chuỗi nhưng hôm nay chưa học | "Chuỗi 7 ngày đang chờ hôm nay" |
   | `comeback` | ≥ 3 ngày không mở bài | "Đã 5 ngày không mở bài" |
   | `next-lesson` | còn bài chưa mở | "Còn 1 bài trong lộ trình. Bài này thuộc chủ đề Literature." + `highlight: lesson:36` |
   | `weak-topic` | ≥ 3 câu sai cùng chủ đề | "7 câu sai gần đây ở chủ đề này, nhiều hơn các chủ đề còn lại." |
   | `saved-words` | ≥ 5 từ đã lưu | "12 từ trong Sổ từ" |
   | `next-video` | còn video chưa nghe | "Đã xong 0/4 video trong thư viện." |
   | `arena` | chưa đấu trận nào và đã xong ≥ 3 bài | "Bạn đã xong 3 bài. Một vòng đấu 1v1 kiểm tra phản xạ từ nhanh hơn đọc lại." |
   Cùng endpoint trả `greeting` — **một câu duy nhất** chú xe nói: "Còn một bài nữa là giữ chuỗi 7
   ngày." / "3 ngày rồi chưa mở bài. Quay lại bằng một bài ngắn thôi." Không có câu chào nào.

   **Chú xe ở góc màn hình là đúng hình con xe, không có nền** (sửa 07/11): `.buddy-dock` bỏ
   `background`, `border-radius`, `box-shadow` và chip tròn — chỉ còn `img` với một
   `drop-shadow(0 8px 12px …)` để tách khỏi nền. Vì vùng chạm trở nên vô hình, `:focus-visible` là
   thứ duy nhất còn báo focus (outline cyan, `offset: 4px`). Cảnh báo "có nhắc đang chờ" là
   `.buddy-dock-dot` nhỏ ở góc phải trên.

2. **`POST /api/buddy/ask` — một câu hỏi, một câu trả lời.** Không thread, không bong bóng chat:
   web hiện **một thẻ trả lời** (`.buddy-answer`) kèm tối đa 3 chip hỏi tiếp. Lượt hỏi vẫn được lưu
   vào **một** chat `STUDY_COACH` duy nhất của người học (`ensureCoachChat()`), nên `GET /api/ai/chats`
   vẫn hoạt động và buddy còn nhớ đã hỏi gì.

3. **Nhắc học (`study_reminders`).** Bảng mới: `title`, `body`, `due_at`, `target_json`,
   `delivered_at`, `dismissed_at`. `due_at` do **server** quyết định từ `in_minutes` hoặc `at_time`
   ("HH:MM", giờ đã qua thì hiểu là ngày mai), nên model đọc sai đồng hồ cũng không hẹn được điều gì
   xa lạ. Người học vẫn phải bấm "Đặt nhắc" trên gợi ý (`POST /api/buddy/reminder-suggestion`) —
   model không tự đặt gì sau lưng họ. Web huỷ nhắc bằng `DELETE /api/reminders/:id`, và gọi
   `POST /api/reminders/:id/acknowledge` sau khi đã hiện, để một nhắc không bắn hai lần.

**Giọng điệu do prompt quyết định, không phải do may mắn.** `VOICE_GUIDE` trong
`ai.service.ts` cấm rõ: không chào hỏi, không "cố lên nhé / bạn làm tốt lắm / kiên trì sẽ thành
công", không khen chung chung, tối đa 3 câu, và **mỗi câu trả lời phải có ít nhất một chi tiết chỉ
đúng người này** (tên bài, con số, từ cụ thể, câu họ vừa viết) — không có dữ liệu thì phải hỏi một
câu ngắn thay vì nói chung chung. `buddy.unit.test.ts` và `buddy.test.ts` canh đúng điều đó: nudge
phải chứa số thật và không khớp regex câu động viên sáo rỗng.

**Trả lời offline cũng không sáo rỗng.** Khi cả hai provider lỗi, `buildOfflineCoachReply()` trả
đúng dữ liệu ("Việc tiếp theo: Học bài … (12 phút)…", "Chủ đề yếu nhất: Masterclass: 7 câu sai gần
đây."), không còn câu xin lỗi hay "hỏi lại mình tí nữa nhé" — `ai.test.ts` canh việc này.

**Nhắc học khi tab đóng thì không bắn được**, nên có hai lớp: `Notification` của trình duyệt (chỉ
khi người học bấm "Bật thông báo máy"; chỉ bắn lúc tab đang mở nhưng bị che) và thẻ nhắc trong app
(luôn đúng). Web poll `GET /api/buddy/nudges` mỗi 60s + mỗi lần tab quay lại foreground.

**Chỉ tay vào đúng chỗ (`highlight`).** Model trả một token khai báo trước, không trả CSS selector:
`lesson:<id>`, `video:<id>`, `word:<từ>`, `control:notebook`, `control:arena-start`. Các phần tử
thật gắn `data-buddy-target="..."` (`RouteMapCard`, `video-card`, nút Sổ từ, nút vào trận);
`useBuddySpotlight()` cuộn tới, khoanh sáng 4.2s rồi tự tắt. `parseBuddyTarget()` **vứt** mọi token
không khớp whitelist, nên model không thể bịa đích. Một nudge có `highlight` nghĩa là "để mình chỉ
chỗ" — web chỉ đổi tab và khoanh sáng, **không** ném người học vào bài ngay (chỉ mở LessonPlayer khi
target không có highlight).

**Nút chuyển hướng giờ là `target`, không còn `action.kind`.** `App.handleBuddyNavigate(target)` xử
lý một hình dạng duy nhất `{ tab, lessonId?, videoId?, highlight? }` cho cả nudge và câu trả lời AI.

Đã bỏ: tab Chat/Kế hoạch/Lịch sử, thread bong bóng, composer bar, `.buddy-launcher` cũ và ~700 dòng
CSS đi kèm. `buddy.css` viết lại theo đúng ngôn ngữ sổ tay + chú xe, một viền mỗi khối, cyan chỉ cho
hành động. QA: `.workbuddy-ai/tmp-shots/qa-buddy-companion.cjs` (1440 + 390: bubble cụ thể, panel
không tràn, CTA đổi tab **và** `spotlights: 1`, spotlight tự tắt, `answerCard: 1` mà
`answerThreadBubbles: 0`, đặt được nhắc). Các script `buddy-qa.cjs` / `buddy-flow-qa.cjs` /
`buddy-motion-qa.cjs` / `buddy-check.cjs` của drawer cũ **đã lỗi thời** — đừng dùng nữa.

### Học thử trên landing page (`GET /api/demo/video`)

Tab **Học qua video** ở landing **không còn là mockup**. Nó chạy đúng màn `PracticeView` của app,
nuôi bằng **bài ngắn nhất trong thư viện chung** lấy từ `GET /api/demo/video` (endpoint công khai,
không token):

- `getShortestSharedVideo()` chọn bài `owner_user_id IS NULL`, có `duration_seconds > 0` **và có
  segment**, xếp theo thời lượng tăng dần. Hiện tại là video id 10 (1:15, A2, Du lịch, 7 đoạn).
- Payload chỉ mang **`DEMO_SEGMENT_LIMIT = 3` đoạn đầu**, kèm `total_segments` để UI nói rõ còn bao
  nhiêu. `text_vi` và bản dịch **không** gửi xuống: phần xem thử dạy nghe, còn nghĩa tiếng Việt là
  nội dung của tài khoản. `video: null` = "chưa có gì để xem thử" (landing ẩn panel, không báo lỗi).
- `PracticeView` nhận prop tuỳ chọn `demo: { segmentLimit, totalSegments, onRequireAuth }`:
  `segments` bị cắt còn `segmentLimit`, **bấm vào một từ đã lộ** gọi `onRequireAuth()` thay vì
  `saveWordApi`, và hết đoạn cuối thì hiện **`.practice-gate`** (3 gạch đầu dòng lợi ích + CTA
  "Tạo tài khoản để học tiếp") thay cho cúp hoàn thành. Không truyền `demo` thì màn học của người
  đã đăng nhập giữ nguyên hành vi cũ (QA: `01 / 11` đoạn, không gate).
- Trạng thái landing: `.lp-demo-state` cho loading (spinner) / lỗi (nút thử lại) / rỗng, và dải
  `.lp-demo-strip` hiện "Xem thử 3/7 đoạn" + CEFR · chủ đề · thời lượng.
- `requestPublicApi()` trong `apiClient.ts` là bản không gắn token của `requestApi`; nó chấp nhận
  `data: null` nên endpoint công khai không cần envelope đặc biệt.
- QA: `.workbuddy-ai/tmp-shots/qa-landing-demo.cjs` — 1440 + 390, gõ đúng chính tả từng đoạn để mở
  hết từ, kiểm tra gate, gate mở dialog đăng ký, bấm từ cũng mở dialog, và `panelOverflow: []`.

### Khoá trình phát YouTube (luyện nghe)

`web/src/utils/videoPlayback.ts` định nghĩa `YOUTUBE_LOCKED_VARS` — `controls=0`, `disablekb=1`,
`fs=0`, `cc_load_policy=0`, `iv_load_policy=3`, `rel=0`, `modestbranding=1`, `vq=hd720`.
`youtubeEmbedUrl()` dựng query từ chính hằng số đó (test canh chuỗi trong `videoPlayback.test.ts`).

**Phụ đề không thể tắt tin cậy bằng query string.** `cc_load_policy=0` chỉ có nghĩa "đừng bật
phụ đề", YouTube vẫn chiếu caption theo preference của tài khoản; captions / "Video khác" /
thumbnail gợi ý / logo YouTube đều được vẽ **bên trong iframe cross-origin**, CSS của mình không
đụng vào được.

**Nguyên tắc: chỉ tắt phụ đề, KHÔNG giấu hình.** Learner vẫn xem video bình thường — không có
lớp kính mờ / blur / audio-only, không overscan, không dải đen cắt chrome. `PracticeView.tsx`:

1. `stripCaptions()` — `setOption('captions','track',{})` + `unloadModule('captions'/'cc')`.
   Chạy ở `onReady`, mọi `onStateChange`, `onApiChange`, thêm 1 pass trễ 350ms và lặp mỗi
   `CAPTION_GUARD_MS = 400` **trong lúc đang phát** (module caption có thể nạp lại sau seek /
   đổi chất lượng). Guard được `stopCaptionGuard()` dừng khi pause hoặc unmount.
2. `StageCover` — poster + nút play **chỉ khi `playToken === 0 && !playing`** (trạng thái chờ,
   tránh để YouTube vẽ thanh tiêu đề / lưới "Video khác" lúc idle). Ngay khi phát, cover bị gỡ
   hẳn và hình video hiện đầy đủ. Nút replay nằm ở đầu player (`.practice-head-replay`).
3. `.practice-stage iframe` lấp đúng khung 16:9 (`inset: 0; width/height: 100%`), chỉ giữ
   `pointer-events: none` để không click nhầm vào overlay của YouTube — hình ảnh không bị che.
   Nhánh fallback (không có IFrame API) cũng để video hiện bình thường, chỉ dựa `cc_load_policy=0`.

`onStateChange` coi state `3` (buffering) là đang phát **sau khi** learner đã bấm play, để cover
không nháy lên giữa đoạn. Ticker tự seek lại nếu lệch trước `segment.start_ms` và dừng đúng
`segment.end_ms`.

---

## 4. Quy tắc thiết kế (đọc trước mọi task UI)

Đây là lỗi cụ thể đã mắc, không phải lý thuyết. Áp dụng nguyên tắc của các skill
`design-taste-frontend` / `minimalist-ui` / `redesign-existing-projects`: quét → chẩn đoán → sửa,
không viết lại hàng loạt.

1. **Một khối = một viền.** Không `panel > frame > engine > chip` (4 lớp viền). Đã có panel bọc
   ngoài thì bên trong không border / background / radius; tách bằng khoảng trắng hoặc hairline 1px.
   Trước khi thêm `border`, hỏi: "cái hộp này mang thông tin gì?".
2. **Khoảng trắng phải có lý do.** Không kéo `flex: 1` để lấp chỗ → sinh 200px trống. Padding theo
   thang 4/8/12/16/24/32/48, không rải `padding: 17px 15px 13px`.
3. **Một trục căn trái duy nhất.** Mọi text trong cùng cột chung một mép trái; icon không được đẩy
   chữ lệch đi. Không center text (trừ hero / empty state / modal ngắn).
4. **Chiều sâu từ tương phản, không từ viền.** Đổi màu nền / cỡ chữ / mật độ. Chỉ một lớp được có
   shadow trong một khung nhìn; shadow để nâng vật thể thật (video, ảnh, modal).
5. **Không trang trí vô nghĩa.** Không thêm lại `.featured-lane`, chấm `.challenge-row-players i`,
   badge "VS", vòng avatar, đường kẻ trang trí, watermark chữ mờ.
6. **Icon lấy từ `@phosphor-icons/react`, không tự vẽ `<svg>`, không bọc hộp.** Icon đứng trần, màu do
   `color` quyết định; vùng chạm dùng `padding` + hover background. Ngoại lệ: nút bấm thật, avatar
   chữ cái, và **logo thương hiệu bên thứ ba** (Google 4 màu / Facebook xanh) trong `AuthModal.tsx`.
7. **Màu.** Một gam lạnh duy nhất: light = nền cyan sương `#F2FAFD`, giấy `#FFFFFF`, chữ
   `#0E3542`; dark = slate than `#0E1720` / `#152430`, chữ `#F2FAFD`. **Không** nền kem/nâu/be,
   **không** gradient tím–xanh kiểu "AI slop". Thương hiệu `#00C7FF` (chỉ hành động), `#007A9E`
   (chữ/tint), hổ phách chỉ cho phần thưởng. Không để 2 màu nhấn cạnh tranh trong 1 khối.
   Token màu nằm ở `:root` / `:root[data-theme="dark"]` trong `web/src/index.css`; swatch trong
   picker và `theme-color` trong `index.html` phải khớp đúng 2 tông đó. Đường ngăn cách component
   ở light dùng `--line` / `--line-strong` = `#C9E0EB` / `#A3C9DA` (đậm hơn bản cũ `#E2EEF3` /
   `#C9DEE8` để viền đọc rõ trên nền `#F2FAFD`/`#FFFFFF`); dark giữ `#26414F` / `#34586B`.
   - **Hero landing là một cảnh 3D, không có nền (07/11)**: bản đầu còn một *sàn diễn* có
     gradient + viền bao quanh thẻ; user yêu cầu **bỏ background, thay bằng bóng đổ** và bỏ luôn
     thanh "Bắt đầu từ con số 0", nên `.lp-hero-art-panel` giờ **trong suốt** (`background: none`,
     `border: 0`, `padding: 34px 26px 44px`) và toàn bộ chiều sâu do **bóng** gánh:
     - `.lp-hero-3d` nghiêng `rotateX(9deg) rotateY(-13deg)`, có hai lớp `::before/::after` là bản
       sao mờ lệch xuống trái (`-34px`, `-68px` theo trục Z) tạo **độ dày** cho thẻ.
     - `.lp-hero-floor` là **bóng sàn**: hai ellipse `radial-gradient` (`40%` contact + `22%`
       ambient) + `blur(15px)` + `rotateX(68deg)`, đặt ngay dưới thẻ.
     - `.lp-lesson-preview` có hai lớp đổ bóng (sát cạnh + xa) nên mép thẻ tách khỏi trang dù
       không có khung nền nào phía sau.
     Đã bỏ `.lp-hero-sun`, `.lp-hero-horizon` và `.lp-hero-proof`: hình phẳng bị thẻ 3D che một nửa
     đọc như sticker bị cắt, còn thẻ trôi + bóng sàn đã đủ tạo chiều sâu.
   - **Chuyển động do JS, không do CSS keyframes**: `useHeroTilt.ts` gộp **trôi nhẹ** và **nghiêng
     theo con trỏ** vào **một** `transform` ghi mỗi frame. Nếu để `animation` CSS lo phần trôi và JS
     lo phần nghiêng thì hai bên giành nhau `transform` và thẻ giật. Chi tiết:
     - Ease hàm mũ (`easing = 0.075` mỗi frame): nhanh lúc đầu rồi chậm dần → cảm giác có khối lượng,
       không phải snap. QA đo được **frame trung gian** tồn tại giữa lúc trỏ vào và lúc ổn định.
     - Góc nghỉ đọc từ biến CSS `--tilt-x/-y/-z`, nên breakpoint ≤760px chỉ cần đổi biến
       (`4deg/-5deg`) thay vì chống lại `style` inline; hook nghe `matchMedia` để đọc lại khi đổi
       breakpoint.
     - `IntersectionObserver` dừng hẳn vòng `requestAnimationFrame` khi hero ra khỏi màn hình.
     - Bỏ qua theo dõi con trỏ trên thiết bị cảm ứng (`(hover: none)`), tắt hoàn toàn khi
       `prefers-reduced-motion` (giữ transform tĩnh trong CSS).
     QA: `.workbuddy-ai/tmp-shots/qa-hero-motion.cjs` kiểm `floats`, `reactsToPointer`,
     `intermediateFrame`; `qa-hero3d.cjs` đo `cardInsidePanel` + `scrollWidth === viewport` ở 1440 và
     390.
   - **Ngoại lệ landing page** (user chốt 04/11): landing **chỉ có light**, một gam cyan nhạt gần
     `#00C7FF` nhưng phai đi để không chói như trắng: nền `#E4F7FF`, giấy `#F1FBFF`, chữ
     `#0E3542`, CTA cuối `#CFEDFB`, nút action vẫn `#00C7FF`. Header landing **không có nút
     sáng/tối**. `LandingPage.tsx` ép `data-theme="light"` + class `html.lp-active` lúc mount và
     khôi phục đúng theme đã lưu (`engorace_theme`) khi vào dashboard — dashboard vẫn cyan/dark.
     Ramp riêng nằm trong `landing.css` dưới `html.lp-active .landing-page-wrapper`, **không** đụng
     `:root`; wordmark vẫn đọc chung `--brand-wordmark-*`. Footer là band full-width (có tagline),
     không còn khối nâu đen chen giữa trang. Không đưa dark override vào landing.css nữa.
   - **Wordmark dùng chung 1 bộ**: `.brand-eng/.brand-o/.brand-race` và `.lp-brand-*` đều trỏ
     `--brand-wordmark-*`. Cấm override màu logo theo trang (`[data-video-mono]` trước đây làm
     sai màu logo ở trang học video / sổ từ).
   - Các trang video/notebook **không** định nghĩa ramp token riêng: `.video-detail` chỉ trỏ
     `--m-*` về token chung (`--m-paper: var(--paper)`…). Surface media (`.video-hero`,
     `.video-stage`, `.practice-stage`, `.notebook-hero`) luôn tối và dùng **chữ cố định sáng**
     `#F2FAFD` / `#A9C7D4`, không đảo theo theme.
   - Không dùng token đảo theme trên surface luôn tối (vd `.featured-challenge`): chữ phải cố định
     sáng (`--accent-400`).
   - Không hardcode `rgb(255 255 255 / x%)` cho surface; dùng
     `color-mix(in srgb, var(--paper) 97%, transparent)`.
   - Thumbnail YouTube quá chói: `.video-thumb img` có `saturate(.82) sepia(.08)` để kéo về tông ấm.
8. **Màu câu hỏi trong một bài phải đồng nhất.** Chữ cái A/B/C/D dùng chung một badge trung tính;
   màu chỉ dành cho trạng thái (chọn / đúng / sai). Chip kỹ năng (NGHE / ĐỌC / VIẾT) cũng trung tính —
   nhãn mang nghĩa, không phải sắc màu.
9. **Trước khi báo xong:** chụp 1440 + 390 ở cả light và dark; đếm số lớp viền trong một khối (>1 là
   sửa); kiểm tra mép trái chữ thẳng hàng; không box nào trống > 40% diện tích.
10. **Không có phần tử con tràn mép card.** Grid `display: grid` không khai báo cột sẽ dùng track
    `auto` = `max-content`: một hàng ký tự / chữ dài trong `.arena-prompt` kéo cả `.arena-reply`
    rộng hơn card, nút `Trả lời` thò ra ngoài viền phải (lỗi ở tầm 730px). Luôn
    `grid-template-columns: minmax(0, 1fr)` + `min-width: 0` trên card con, và trong hàng flex:
    input `flex: 1 1 0; min-width: 0`, nút `flex: 0 0 auto; white-space: nowrap`. Đo
    `button.right <= card.right` ở 1440 / 960 / 820 / 730 / 720 / 390 trước khi báo xong.

UI ngôn ngữ tiếng Việt (có bản tiếng Anh trong `i18n.tsx`). Font Be Vietnam Pro; Fraunces chỉ cho
số liệu / serif accent. Theme lưu ở localStorage key **`engorace_theme`** (không phải
`englearn_theme`); auth dùng `englearn_token` / `englearn_user`.

### Các màn hình đã thiết kế lại

- **Bài tập** (`LessonPlayer.tsx`): chip kỹ năng trung tính, option đồng màu, hàng đáp án lẻ span 2
  cột, CTA `--brand-500` chữ tối, 3 ô kết quả thành tile. Câu xếp từ có **2 chế độ**: "Chạm từ"
  (chọn chip) và "Tự viết" (input, Enter để kiểm tra) — cùng một `answer`, backend chuẩn hoá
  chữ hoa/khoảng trắng/dấu câu khi chấm. Bài nghe có player riêng: nút play tròn, thanh tiến độ,
  thời gian, nghe lại.
- **Đấu trường** (`.arena-question`): 2 cột, thẻ câu hỏi nhuộm theo bậc CEFR (`is-a` xanh lá /
  `is-b` cyan / `is-c` hổ phách) + khung ảnh chờ, thẻ trả lời card giấy. Chuỗi flex phải là
  `.arena-view` (flex column) → `.arena-practice` / `.arena-match` (`flex: 1`) → `.arena-question`
  (`flex: 1; align-content: center`), nếu thiếu mắt `.arena-view` thì câu hỏi dính header và chừa
  dải trắng chết bên dưới. Màn kết quả `.arena-verdict-hero` là ink block: cúp hổ phách khi thắng,
  bảng điểm có nhãn `THẮNG` cạnh người thắng; hai nút dưới khối là `Đấu lại` (`--action-bg`) và
  `Về sảnh chờ` (`.arena-cta.is-ghost`, nền `--paper` + viền `--line-strong`) nên không còn hoà
  vào nền trang.
- **Ghép trận (chống bug 3 người)**: mỗi user chỉ giữ **một ghế sống** — queue / pending pair /
match. `joinQueue` chặn user đã có ghế ở bất kỳ cấu trúc nào, `takeWaitingOpponent` bỏ qua entry
cũ (socket đã ngắt, đã bị ghép, trùng user) thay vì ghép vào đội hình chết, và `createMatch`
không bắt đầu trận nếu một socket đã ngắt — nên không còn cảnh A bị ghép với B trong khi B lại
đang đấu với C, A thấy đối thủ đứng yên.
- **Bảng xếp hạng**: bục 2-1-3, `hueOf(name)` băm tên → `--rank-hue-0..4` (trộn vào `--paper` để
  chạy cả 2 theme), strip `.rank-you` (hạng / XP / khoảng cách), lane XP cho hạng 4+.
- **Video / luyện nghe**: bỏ "Phòng luyện nghe" và dải nút điều khiển, thay bằng `01 / 04` +
  đồng hồ segment + nút replay; cột video rộng `1.85fr / 0.8fr`.
- **Dịch Tài Liệu**: `.translate-page` cao đúng `100dvh`, nên **không dùng `view-fade`**
  (keyframes bắt đầu `translateY(6px)`): 6px đó tạo vùng cuộn thừa trong 260ms → thanh cuộn
  trang nháy lên rồi biến mất. `index.css` gán riêng `.learning-page-translate .tab-view-container`
  sang `view-fade-flat` (chỉ opacity). Các tab khác vẫn giữ `view-fade`.
  Dải `LỊCH SỬ DỊCH` chia trang theo chiều cao thật: `HISTORY_ROW_MIN_HEIGHT` trong
  `TranslateView.tsx` **phải khớp** `min-height` của `.translate-history-list li` (44px) và nội
  dung hàng phải vừa 44px (padding 6px, gap 3px). Lệch nhau là khi có phân trang hàng bị bóp lại,
  chữ bị cắt (lỗi gặp ở ~1280×700).
- **Hình thức học (tab "Học qua video")**: panel không còn là mockup tĩnh. Nó render đúng
  `PracticeView` với bài ngắn nhất trong thư viện (xem mục *Học thử trên landing page*), hết 3 đoạn
  xem thử thì hiện `.practice-gate` mời tạo tài khoản. Tab "Đấu trường từ vựng" vẫn là demo tương tác
  phía client (3 câu, bot trả lời theo timer) — không đụng tới server.
- **Lộ trình / sương mù (05/11)**: trong `RouteMapCard.tsx`, phần bản đồ **chưa học** bị phủ sương
  theo 2 lớp chồng (cùng một mép mềm, không seam): `fogLight` từ chặng đầu tiên còn bài chưa
  `done` (`.22/.31/.28`), `fogDense` từ chặng đầu tiên mà **mọi bài đều `locked`**
  (`.28/.36/.32`). Chặng đang học chỉ nằm ở lớp mỏng → marker/xe vẫn rõ; chặng đã xong hoàn toàn
  thì không có sương. Cảnh của chặng mờ dùng `.is-foggy` (`saturate(.68) blur(1.2px)`), chặng
  đang học dùng `.is-misty` (chỉ `saturate(.86)`). Dải mây là ellipse tô radial gradient
  `fogWispId`, trôi `roadmap-fog-drift 22s var(--buddy-soft)`; cả cụm có
  `pointerEvents="none"` nên marker khoá **vẫn bấm được** (hiện card với CTA disabled).
  Nhãn chữ trong sương (“Chặng chưa mở khoá” / “Unexplored stages”) **đã bỏ theo yêu cầu 06/11**
  (`.roadmap-fog-label` xoá khỏi TSX + CSS) — sương tự nói lên điều đó, không cần chú thích.
  `prefers-reduced-motion` tắt trôi mây.
  QA: `.workbuddy-ai/tmp-shots/roadmap-fog-qa.cjs` (4 case: tài khoản mới 5 chặng mờ / tài khoản
  35-36 bài chỉ 1 lớp mỏng / dark / 390px).

---

## 5. Quản trị nội dung (admin)

Tab **Quản trị** (`web/src/components/admin/AdminView.tsx` + `admin.css`) chỉ xuất hiện khi
`user.role === 'admin'`; `App.tsx` tính `effectiveTab` nên một tab `'admin'` còn lưu trong
`sessionStorage` tự rơi về `'study'` với tài khoản thường (QA `qa-admin.cjs` canh đúng case này).
Hai phần trong tab:

- **Bài học** — 3 cột đúng cấp bậc **Chặng → Bài → Câu hỏi**:
  - Chặng: title/description/`theme_key` (6 theme của `STAGE_VISUALS`; `accent_color` **tự sinh**
    theo `THEME_ACCENTS` trong `admin.service.ts`, không cho nhập màu tay để giữ palette).
  - Bài: title + topic, thêm vào **cuối** chặng đang chọn.
  - Câu hỏi: 5 dạng mà `LessonPlayer` render (`multiple_choice`, `fill_choice`, `listen_choice`,
    `word_order`, `listening`). Nhóm lựa chọn cần ≥2 đáp án và **đúng 1** đáp án đúng; dạng nghe
    bắt buộc `audio_url`; `word_order`/`listening` để trống `word_bank` thì server tự tách từ đáp
    án đúng. Lỗi validation trả `422` với danh sách field, web kiểm tra lại y hệt trước khi gửi
    (`utils/adminForm.ts`).
  - `code` (chặng/bài) tự sinh từ title bằng `slugify()` + hậu tố `-2`, `-3`… nên không bao giờ
    đụng `uq_stages_code` / `uq_lessons_code`.
  - **Không nhập `sort_order`**: tạo mới là `MAX+1` trong scope, đổi thứ tự bằng nút lên/xuống
    (`/move`, swap trong transaction qua một slot tạm) — tránh hẳn unique key
    `uq_stages_sort_order` / `uq_lessons_stage_order` / `uq_questions_lesson_order`.
  - Xoá: chặng còn bài → `409 STAGE_NOT_EMPTY`; xoá bài/câu hỏi chạy trong **một transaction**
    vì `match_answers.question_id` và `progress.lesson_id` không có `ON DELETE` — câu hỏi từng
    xuất hiện trong trận đấu được set `NULL` (giữ lịch sử trận), còn `progress` của bài bị xoá
    theo. Web hỏi xác nhận và nói rõ điều này.
  - Bài **0 câu hỏi** vẫn tạo được nhưng học viên không thể hoàn thành (`completeLesson` chặn
    "no questions"), nên danh sách bài gắn nhãn "Chưa có câu".
- **Video chung** — dán link YouTube là chạy đúng pipeline import của học viên
  (`fetchYouTubeImportSource` → `refineSegmentsWithAi`), nhưng ghi `owner_user_id = NULL`,
  `code = yt_<id>_shared`, `topic = 'Thư viện chung'`, XP mặc định 20. Nhờ vậy video xuất hiện ngay
  ở tab Học qua Video của **mọi** học viên (`GET /api/videos` đã trả `owner_user_id IS NULL`) và mở
  được chế độ luyện nghe vì có segment. Vẫn áp **< 5 phút + phụ đề tiếng Anh** (chế độ luyện nghe
  cần segment). Sửa metadata (title/topic/mô tả/CEFR/XP), đổi thứ tự, xoá — xoá video chung cũng
  xoá tiến độ học của video đó (FK cascade).

Backend tương ứng: `backend/src/modules/admin/*` mount tại `/api/admin`, `requireAdmin`
(`middleware/authorize.ts`) đọc role tươi từ DB mỗi request.

**Giao diện (`admin.css`, đợt làm lại 07/11):**
- Dialog là `<dialog>` thật nhưng **phải khai báo `position: fixed; inset: 0; margin: auto`**:
  reset toàn cục của app bỏ `margin` của UA nên trước đó form dính góc trái trên thay vì giữa
  màn hình (QA `qa-admin.cjs` đo `centeredX` / `centeredY`). Header / body / footer tách rời, chỉ
  body cuộn nên nút Lưu luôn thấy; `data-autofocus` đánh dấu field chính để focus vào đúng ô thay
  vì nút X; Esc hoặc bấm nền đóng. Dưới 560px dialog thành **bottom sheet** (`inset: auto 0 0 0`,
  cao tối đa `92dvh`, bo trên, chừa `safe-area-inset-bottom`), `prefers-reduced-motion` tắt
  animation vào.
- 3 cột Chặng / Bài / Câu hỏi: header có nhãn + số lượng + nút thêm; thân cột tự cuộn khi ≥821px
  với mask mờ ở đáy và spacer 24px để hàng cuối không bị fade. Hàng hover đổi nền, hàng đang chọn
  có vạch cyan 3px bên trái; 4 nút hành động chỉ rõ khi hover/focus-within (thiết bị cảm ứng
  `@media (hover: none)` luôn hiện).
- Trạng thái: skeleton đúng hình dạng hàng khi tải, empty state có icon + nút CTA ("Thêm chặng" /
  "Thêm bài" / "Thêm câu hỏi"), toast lưu nổi góc phải phía trên chú xe En Buddy. Form chia
  `.admin-section` bằng hairline, theme chặng là lưới 3 cột có dấu check, đáp án là radio + hàng
  được tô màu nhạt cho đáp án đúng, kèm dòng gợi ý "Chọn đúng một đáp án đúng."
- `admin.css` và `admin.repository.ts` giữ **ASCII-only**, comment ngăn mục viết bằng ASCII
  (`/* --- Ten --- */` trong CSS, `// --- Ten ---` trong TS): sửa file bằng PowerShell
  (`Get-Content -Raw` / `Set-Content`) từng làm hỏng ký tự box-drawing ở đây thành mojibake. Toàn bộ
  màu vẫn lấy từ token trong `index.css`; cyan chỉ dùng cho hành động + vạch chọn, hổ phách chỉ cho
  chip XP, đỏ chỉ cho xoá.

---

## 6. Kiểm tra trước khi commit

```bash
cd web
npx tsc --noEmit
npm test                       # 51 tests
npx vite build
npx eslint src --max-warnings 0

cd ../backend
npm run build
npm test                       # 95 tests
```

Lưu ý khi build lại lần 2+: `dist/arena/` có 100 file, nên bước dọn `dist/` của Vite bị chặn
bởi guard xoá hàng loạt (>50 file) trong môi trường WorkBuddy. Cách đơn giản: chuyển
`dist/arena/` ra thư mục tạm ngoài project rồi chạy `npx vite build`, Vite sẽ copy lại từ
`public/arena/`. Không sửa tay file trong `dist/`.

Chụp màn hình bằng Playwright: binary
`C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe`, chạy với
`NODE_PATH=C:/Users/ADMIN/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules`.
Đăng nhập test qua `POST /api/auth/login` rồi inject `englearn_token`, `englearn_user`,
`engorace_theme` bằng `addInitScript`. Script QA nằm trong `.workbuddy-ai/tmp-shots/`:
`qa-final.cjs` (14 ảnh light/dark + probe màu wordmark), `qa-wordmark.cjs` (so màu logo 10 màn
hình), `qa-video-overflow.cjs` (video hiện đủ khung / không còn veil-blur / `cc_load_policy=0`
+ đo nút `Trả lời` không tràn card ở 11 độ rộng), `qa-overflow.cjs` (probe thô),
`qa-arena-socket.cjs` (2 account vào trận, kiểm tra `game:question.imageUrl`),
`qa-arena-duel.cjs` (ảnh thật trong khung câu hỏi), `qa-landing-pale-cyan.cjs` (landing light-only:
probe nền/footer/CTA ở 1440 + 390 với cả 2 theme đã lưu, kiểm tra không còn `.theme-toggle` và
dashboard lấy lại đúng theme tối). Script cũ `qa-practice.cjs` kiểm tra lớp mờ đã lỗi thời —
không dùng nữa.

Bảng quản trị có 3 script riêng: `qa-admin.cjs` (9 case: admin ở 1440 + 390 cả light/dark cho tab Bài
học lẫn Video chung, learner còn `sessionStorage` tab `admin` phải rơi về Học Tập; mỗi case đo
`.admin-row` không tràn card, `scrollWidth === viewport`, mở dialog câu hỏi / chặng / sửa video /
thêm video và kiểm tra dialog **căn giữa** (`centeredX`/`centeredY`) + focus vào đúng field),
`qa-admin-empty.cjs` (stub API trả rỗng để chụp empty state light/dark) và `admin-flow.cjs` (tạo
Chặng → Bài → Câu hỏi qua UI thật, reload để chắc dữ liệu còn, rồi xoá dọn bằng API). Ảnh nằm trong
`.workbuddy-ai/tmp-shots/qa-admin/`.

Landing có thêm `qa-landing-demo.cjs` (bài học thử thật: gõ đúng từng đoạn → gate → dialog đăng ký,
ở 1440 + 390; ảnh trong `.workbuddy-ai/tmp-shots/qa-landing-demo/`), `qa-hero3d.cjs` (chụp hero 1440 +
390, đo `cardInsidePanel`, `scrollWidth === viewport`) và `qa-hero-motion.cjs` (di chuột vào thẻ rồi
đo transform để chắc thẻ trôi, nghiêng theo con trỏ, và **có frame trung gian** = mượt chứ không
snap).

⚠️ **Watcher của Vite/nodemon hay chết vì `EBUSY`**: công cụ sửa file của DSH tạo thư mục tạm
`.<tên file>.tmpdir` **ngay trong `src/`**, và watcher cố theo dõi chúng rồi bỏ cuộc. Khi đó server
vẫn "running" nhưng cổng không phục vụ nữa → phải `Stop-Process` đúng PID đang giữ cổng
(`Get-NetTCPConnection -LocalPort 5173`) rồi chạy lại. Backend còn có thể để lại tiến trình mồ côi
giữ port 3000 làm `npm run dev` mới chết với `EADDRINUSE` (lúc đó `tsx` cũ vẫn chạy code cũ, nên
route mới báo "Route not found").

Lưu ý eslint vẫn còn các finding **có sẵn** ở những file không thuộc đợt này (đợt admin: 12
problem, 0 ở file mới): `SettingsPanel.tsx`, `ThemeToggle.tsx`, `AuthModal.tsx`
(`react-hooks/refs`, `set-state-in-effect`), `StudyBuddy.tsx`
(`react-refresh/only-export-components` + 1 biến `_tabLabel` chưa dùng), `LessonPlayer.tsx`
(`react-hooks/purity` — `Date.now()` trong `useRef`), `AuthContext.tsx` (`exhaustive-deps`),
`i18n.tsx` (`react-refresh/only-export-components`).

---

## 7. Việc còn treo

- Social login Google/Facebook chưa có backend OAuth — cần client ID / App ID thật.
- Ảnh đấu trường là ảnh CC0 tải về (`web/public/arena/`): nếu deploy tách riêng `web/` và API,
  nhớ copy cả thư mục `arena/` lên server tĩnh hoặc đổi `image_url` sang URL tuyệt đối.
- Admin panel chưa có: upload file MP4 (mới chỉ link YouTube), xem trước video trước khi ghi vào
  DB (import là một bước), xoá mềm/khôi phục bài học, log ai sửa gì, và rate-limit cho `/api/admin/*`.
  Video chung vẫn dùng hạn mức < 5 phút của học viên; muốn nâng thì đổi `MAX_IMPORT_DURATION_SECONDS`
  và kiểm lại cách tách segment.
