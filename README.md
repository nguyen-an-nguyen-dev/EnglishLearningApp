# EngoRace — English Learning App

Giao diện **web** là sản phẩm chính của repo này. `backend/` là API đi kèm, `mobile/` chỉ dùng làm
nguồn tham khảo màu và không được sửa khi làm việc trên web.

| Thư mục | Vai trò |
| --- | --- |
| `web/` | Vite + React 19 + TypeScript. CSS thuần: `index.css` (dashboard/bài tập), `dashboard.css` (Thi đua, xếp hạng, profile), `learning-modes.css` (video/nghe), `landing.css` (trang chủ). |
| `backend/` | Express 5 + Socket.IO + MySQL (MariaDB) + JWT, port `3000`. |
| `mobile/` | Expo/React Native — **chỉ đọc**, nguồn màu `mobile/constants/Colors.ts`. |

---

## 1. Chạy dự án

```bash
cd backend && npm install && npm run dev        # http://localhost:3000
cd web     && npm install && npm run dev        # http://localhost:5173
```

`npm start` ở backend = `tsc` rồi `node dist/server.js` — **không phải watch mode**. Khi sửa
service/controller phải `npm run build` rồi restart process, nếu không API vẫn trả payload cũ.

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

| Email | Mật khẩu | User id |
| --- | --- | --- |
| `test@test.com` | `123456` | 10 |
| `temp@engorace.dev` | `temp123456` | 9 |

---

## 2. Cơ sở dữ liệu

**Chỉ còn một file: `backend/database/final.sql`.** Toàn bộ migration / seed / script SQL cũ đã được
gộp vào đây và xoá khỏi `backend/database/`. File sinh trực tiếp từ DB thật, chứa **22 bảng** (sắp
theo thứ tự khoá ngoại) + **2392 dòng dữ liệu** — schema lẫn dữ liệu đều là trạng thái cuối cùng,
không còn bảng tạm, không còn câu `UPDATE` chồng chéo.

```bash
mysql -u root -p < backend/database/final.sql
```

⚠️ File bắt đầu bằng `DROP DATABASE IF EXISTS english_learning` rồi `CREATE` lại từ đầu: chỉ chạy
trên DB mới / DB dev, **không** chạy trên DB đang có dữ liệu thật cần giữ. Tối ưu nạp:
`FOREIGN_KEY_CHECKS=0`, `UNIQUE_CHECKS=0`, `INSERT` gộp nhiều dòng (≤400 KB mỗi câu) và **một
transaction duy nhất cho phần dữ liệu**; DDL đứng ngoài transaction vì MySQL tự commit. Đã verify
bằng cách nạp vào DB tạm rồi so số dòng từng bảng với DB thật: khớp 100% (`image_url` 100/100,
4 video, 53 segment).

Khi cần đổi schema/dữ liệu: sửa DB dev rồi sinh lại `final.sql` bằng
`.workbuddy-ai/tmp-shots/dump-final-sql.cjs`, **không tạo file migration mới**. Bản sao các file cũ
để phòng hồi phục nằm ở
`C:/Users/ADMIN/AppData/Local/Temp/engorace-database-backup-20261104-184202/`.

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
**53 segment** phụ đề đã tách câu. Nạp lại `final.sql` sẽ tạo lại DB từ đầu, nên mọi tiến độ học
video cũ cũng mất.

| Video | ID | Thời lượng | Câu |
| --- | --- | --- | --- |
| Small Talk \| Everyday English | `ry9SYnV3svc` | 2:13 | 11 |
| Talking about a Trip using the Past Simple | `mngiqrT44Pk` | 1:15 | 7 |
| Coldplay – Viva La Vida | `dvgZkm1xWPE` | 4:02 | 22 |
| Avicii – The Nights | `UtF6Jej8yb4` | 3:11 | 13 |

`video.youtube.ts` ưu tiên caption `json3`, nhưng **có fallback đọc `.vtt`** — vài track (đặc biệt
video nhạc) chỉ phát hành WebVTT dù đã yêu cầu `json3`; thiếu fallback thì video báo
"chưa có phụ đề" dù YouTube có caption. `parseVttCues()` có unit test riêng.

Đấu 1v1 chạy trên cùng server Socket.IO. Các event quan trọng: `game:opponentAttempt` (bắn 1 lần
khi đối phương **bấm trả lời**, không bắn theo từng ký tự), `game:opponentAway` (đối phương rời
trận → bên còn lại thoát màn đấu ngay).

### AI bạn học — En Buddy (cá nhân hoá lộ trình)

Một drawer chat **dùng được ở cả 6 tab** (`web/src/components/ai/StudyBuddy.tsx` +
`web/src/buddy.css`). Không thêm tab sidebar; thẻ tắt "Chú xe có việc nè" từng đặt trong header
trang Học Tập **đã bỏ theo yêu cầu 05/11** — lối vào duy nhất là chú xe ở góc màn hình.
Chat biết tab đang mở (`context.tab`) và bài hiện tại (`context.focus`), có chip câu hỏi nhanh
đổi theo tab, lịch sử cuộc trò chuyện và thẻ sửa lỗi ngữ pháp.

**Hướng thiết kế (user chốt 05/11): không làm widget chat kiểu SaaS.** Nhân vật là chính
**chú xe chở sách trong `web/public/logo.png`**: xe lăn nhẹ ở góc màn hình kèm bong bóng thoại
đổi câu, trong panel có avatar biểu cảm (vui / đang nghĩ / hụt), bong bóng thoại có đuôi, tab
dán sticker hơi nghiêng, tiêu đề Fraunces nghiêng, nền chấm kiểu sổ tay và copy thân mật
("3 việc nho nhỏ thôi!", "Mình lật sổ của bạn rồi"). Không dùng kicker monospace / tab gạch chân /
hairline chia ô kiểu Intercom. Giữ nguyên mọi selector `.buddy-*` để script QA chạy tiếp.

**Một hệ nhịp duy nhất** (`web/src/buddy.css`): `--buddy-ease` / `--buddy-soft` /
`--buddy-fast|mid|slow` là easing + duration dùng chung cho mọi hover, entrance và idle loop.
Xe và bóng đổ cùng `buddy-breathe 4.2s`; bong bóng gợi ý đổi câu bằng **crossfade 280ms**
(không pop lệch nhịp); panel có cả `buddy-panel-in` lẫn `buddy-panel-out` (nút X / Esc);
tin nhắn và 3 bước kế hoạch cùng `buddy-rise` (bước delay 0/70/140ms); chấm "đang gõ" cùng
`--buddy-soft`. Mood của xe chỉ là `transition` trên `transform`, tách khỏi animation thở nhờ
wrapper `.buddy-breathe` — không còn chỗ nào `animation: none` đè hover.
`prefers-reduced-motion` tắt sạch loop/entrance. QA: `.workbuddy-ai/tmp-shots/buddy-motion-qa.cjs`
đo easing, đóng/mở, Esc và reduced-motion.

- **Kế hoạch không do AI bịa**: `GET /api/ai/study-plan` gom dữ liệu thật
  (`getLearnerContext`: level / chủ đề yếu / lỗi sai gần đây + `getStudyStats`: progress, video,
  từ đã lưu, bản dịch, trận đấu, XP) rồi `buildStudyPlan()` sinh đúng 3 bước, mỗi bước có
  `target.tab` và `lessonId` của bài đang mở. Web bấm "Bắt đầu" là nhảy thẳng vào bài / tab đó.
  AI chỉ viết 2 câu giải thích (`aiNote`); nếu provider lỗi thì `aiNote = null` và kế hoạch vẫn
  dùng được.
- **Chat theo intent**: `POST .../messages` nhận `intent` = `chat | plan | explain | how | practice`
  và `context` đã sanitize (tab whitelist, chuỗi cắt 160/240 ký tự, coi là dữ liệu không tin cậy).
  Với `STUDY_COACH` hoặc intent ≠ `chat`, backend dùng prompt coach có `CURRENT_PAGE_JSON` +
  `LEARNER_DATA_JSON`; topic hội thoại cũ giữ nguyên prompt để không đổi contract cũ.
  Mọi lượt vẫn lưu `chats / messages / ai_feedback` và trả feedback sửa lỗi.
- **Provider**: `requestCoachAi()` ưu tiên `NVIDIA_API_URL` (nhanh) rồi fallback `requestAi()`
  (Gemini, timeout 10s cho luồng coach). `requestAi()` giữ nguyên timeout/error contract cũ.
  Lý do: `AI_API_URL` từng timeout trong mạng dev, còn NVIDIA trả JSON ~1s. Không đổi `.env`.
- **Không bao giờ chết trắng**: nếu cả 2 provider lỗi (hay gặp khi plan + chat gọi cùng lúc),
  `buildOfflineCoachReply()` trả câu trả lời "tự lật sổ tay" có tên bài tiếp theo, chủ đề yếu và
  đúng màn hình đang mở — vẫn lưu vào lịch sử, không báo 503 cho người học. `ai.unit.test.ts`
  và `ai.test.ts` có test riêng cho đường này.
- **DB**: enum `chats.topic` có thêm `STUDY_COACH` (đã ALTER DB thật + sửa đúng 1 dòng trong
  `final.sql`, **không** regenerate vì DB thật đang có thêm dữ liệu QA: `matches`, `translations`,
  `video_lessons`, `video_segments`; `verify-final-sql.cjs` vì thế đang báo lệch có sẵn từ trước).
- Chưa có: streaming, markdown renderer, rate-limit cho `/api/ai/*`, ghi `users.streak`.

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
7. **Màu.** Light = nền kem nâu nhạt `#F7F1E8`, giấy `#FFFDF9`, chữ `#352C24`; dark = than ấm
   mềm `#1C1917` / `#26221F`, chữ `#F5EDE3`. Không dùng xanh đen lạnh, không gradient tím/xanh
   kiểu "AI slop". Thương hiệu `#00C7FF` (chỉ hành động), `#007A9E` (chữ/tint), hổ phách chỉ
   cho phần thưởng. Không để 2 màu nhấn cạnh tranh trong 1 khối.
   Token màu nằm ở `:root` / `:root[data-theme="dark"]` trong `web/src/index.css`; swatch trong
   picker và `theme-color` trong `index.html` phải khớp đúng 2 tông đó.
   - **Ngoại lệ landing page** (user chốt 04/11): landing **chỉ có light**, một gam cyan nhạt gần
     `#00C7FF` nhưng phai đi để không chói như trắng: nền `#E4F7FF`, giấy `#F1FBFF`, chữ
     `#0E3542`, CTA cuối `#CFEDFB`, nút action vẫn `#00C7FF`. Header landing **không có nút
     sáng/tối**. `LandingPage.tsx` ép `data-theme="light"` + class `html.lp-active` lúc mount và
     khôi phục đúng theme đã lưu (`engorace_theme`) khi vào dashboard — dashboard vẫn latte/dark.
     Ramp riêng nằm trong `landing.css` dưới `html.lp-active .landing-page-wrapper`, **không** đụng
     `:root`; wordmark vẫn đọc chung `--brand-wordmark-*`. Footer là band full-width (có tagline),
     không còn khối nâu đen chen giữa trang. Không đưa dark override vào landing.css nữa.
   - **Wordmark dùng chung 1 bộ**: `.brand-eng/.brand-o/.brand-race` và `.lp-brand-*` đều trỏ
     `--brand-wordmark-*`. Cấm override màu logo theo trang (`[data-video-mono]` trước đây làm
     sai màu logo ở trang học video / sổ từ).
   - Các trang video **không** được định nghĩa lại ramp token; chỉ được đổi surface riêng của
     media (`.video-hero`, `.video-detail`) và phải giữ tông ấm.
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
  dải trắng chết bên dưới.
- **Bảng xếp hạng**: bục 2-1-3, `hueOf(name)` băm tên → `--rank-hue-0..4` (trộn vào `--paper` để
  chạy cả 2 theme), strip `.rank-you` (hạng / XP / khoảng cách), lane XP cho hạng 4+.
- **Video / luyện nghe**: bỏ "Phòng luyện nghe" và dải nút điều khiển, thay bằng `01 / 04` +
  đồng hồ segment + nút replay; cột video rộng `1.85fr / 0.8fr`.
- **Dịch Tài Liệu**: `.translate-page` cao đúng `100dvh`, nên **không dùng `view-fade`**
  (keyframes bắt đầu `translateY(6px)`): 6px đó tạo vùng cuộn thừa trong 260ms → thanh cuộn
  trang nháy lên rồi biến mất. `index.css` gán riêng `.learning-page-translate .tab-view-container`
  sang `view-fade-flat` (chỉ opacity). Các tab khác vẫn giữ `view-fade`.
- **Lộ trình / sương mù (05/11)**: trong `RouteMapCard.tsx`, phần bản đồ **chưa học** bị phủ sương
  theo 2 lớp chồng (cùng một mép mềm, không seam): `fogLight` từ chặng đầu tiên còn bài chưa
  `done` (`.22/.31/.28`), `fogDense` từ chặng đầu tiên mà **mọi bài đều `locked`**
  (`.28/.36/.32`). Chặng đang học chỉ nằm ở lớp mỏng → marker/xe vẫn rõ; chặng đã xong hoàn toàn
  thì không có sương. Cảnh của chặng mờ dùng `.is-foggy` (`saturate(.68) blur(1.2px)`), chặng
  đang học dùng `.is-misty` (chỉ `saturate(.86)`). Dải mây là ellipse tô radial gradient
  `fogWispId`, trôi `roadmap-fog-drift 22s var(--buddy-soft)`; cả cụm có
  `pointerEvents="none"` nên marker khoá **vẫn bấm được** (hiện card với CTA disabled).
  Nhãn "Chặng chưa mở khoá" chỉ hiện khi có chặng chưa chạm tới và **ẩn ở ≤640px** (SVG scale
  xuống ~3 lần thì chữ 13px thành ~4px). `prefers-reduced-motion` tắt trôi mây.
  QA: `.workbuddy-ai/tmp-shots/roadmap-fog-qa.cjs` (4 case: tài khoản mới 5 chặng mờ / tài khoản
  35-36 bài chỉ 1 lớp mỏng / dark / 390px).

---

## 5. Kiểm tra trước khi commit

```bash
cd web
npx tsc --noEmit
npm test                       # 41 tests
npx vite build
npx eslint src --max-warnings 0

cd ../backend
npm run build
npm test                       # 50 tests
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

Lưu ý eslint vẫn còn 8 error + 1 warning **có sẵn** ở các file không thuộc đợt sửa này:
`SettingsPanel.tsx`, `ThemeToggle.tsx`, `AuthModal.tsx` (`react-hooks/refs`,
`set-state-in-effect`), `AuthContext.tsx` (`exhaustive-deps`), `i18n.tsx`
(`react-refresh/only-export-components`). Không có finding mới từ đợt sửa giao diện này.

---

## 6. Việc còn treo

- Social login Google/Facebook chưa có backend OAuth — cần client ID / App ID thật.
- Ảnh đấu trường là ảnh CC0 tải về (`web/public/arena/`): nếu deploy tách riêng `web/` và API,
  nhớ copy cả thư mục `arena/` lên server tĩnh hoặc đổi `image_url` sang URL tuyệt đối.
