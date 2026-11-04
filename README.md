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

# Gemini / OpenAI-compatible chat (AI talk)
AI_API_KEY=...
AI_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
AI_MODEL=gemini-3.8-flash
AI_TIMEOUT_MS=30000

# Supabase Storage — audio bài nghe
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_BUCKET=english-media
SUPABASE_SECRET_KEY=...      # chỉ ở backend, không bao giờ gửi xuống client

GOOGLE_CLIENT_ID=...          # để trống = nút báo "chưa cấu hình"
FACEBOOK_APP_ID=...
```

`AI_API_URL`, `AI_MODEL`, `AI_TIMEOUT_MS` là tuỳ chọn (Gemini là mặc định). `SUPABASE_SECRET_KEY`
luôn giữ ở backend; client chỉ nhận public Storage URL. URL project kết thúc `/rest/v1/` được
chuẩn hoá tự động.

### Tài khoản test

| Email | Mật khẩu | User id |
| --- | --- | --- |
| `test@test.com` | `123456` | 10 |
| `temp@engorace.dev` | `temp123456` | 9 |

---

## 2. Cơ sở dữ liệu

Cài mới: chạy `backend/database/final.sql`. Với DB đã tồn tại, chạy migration **theo thứ tự**:

1. `migration_add_ai_talk.sql`
2. `migration_add_translation_file_name.sql`
3. `migration_video_arena.sql` — bảng `battle_words`, `video_lessons`, `video_vocabulary`, `video_progress`, `saved_words` + 3 bài mẫu
4. `migration_video_import.sql` — `video_lessons.owner_user_id`, `video_segments`
5. `migration_video_practice_seed.sql` — segment cho bài mẫu ngắn
6. `migration_video_small_talk_segments.sql` — segment mở đầu cho bài YouTube mẫu
7. `migration_6_lessons.sql`

Bảng từ vựng đấu trường là **`battle_words`** (`word_en`, `translation_vi`, `cefr_level`,
`part_of_speech`, `example_en`, `example_vi`, `image_url`), không phải `words`. Hiện
`image_url` đang `NULL` cho cả 100 dòng. Để thêm ảnh minh hoạ cho thẻ câu hỏi: bỏ file vào
`web/public/arena/` rồi

```sql
UPDATE battle_words SET image_url = '/arena/apple.jpg' WHERE word_en = 'apple';
```

URL tuyệt đối cũng dùng được. Khi chưa có ảnh, cả đấu 1v1 lẫn luyện tập đều hiện khung 16:9
nét đứt + "Ảnh minh hoạ" (`PromptFrame` trong `ArenaView.tsx`) nên thẻ không nhảy chiều cao.

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

`database/seed.sql` có sẵn 3 câu nghe cho Greetings / Introductions / Food.

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
GET  /api/battle/practice?count=12&levels=A1,A2,B1,B2
```

Bài video hoàn thành khi xem ≥ 90% thời lượng; XP cộng đúng 1 lần trong transaction. Video tự
import chỉ để luyện (`xp_reward = 0`) và trả `segments` theo câu. Web client mở mọi bài ở dạng
"listening studio": nghe 1 segment → gõ lại → từ chỉ lộ ra khi khớp caption, nên bài cần ít nhất
1 segment mới mở được chế độ luyện.

Web có thể import video YouTube ≤ 3 phút có phụ đề tiếng Anh. Backend dùng `yt-dlp`
(`youtube-dl-exec`, hoặc đặt `YTDLP_PATH` / thêm vào `PATH`) để lấy metadata + caption, tách câu
và lưu thành bài riêng của từng học viên (tối đa 20 bài). Media tự host nằm trong
`backend/public/videos`, phục vụ qua `/media/videos/...`.

Đấu 1v1 chạy trên cùng server Socket.IO. Các event quan trọng: `game:opponentAttempt` (bắn 1 lần
khi đối phương **bấm trả lời**, không bắn theo từng ký tự), `game:opponentAway` (đối phương rời
trận → bên còn lại thoát màn đấu ngay).

### Khoá trình phát YouTube (luyện nghe)

`web/src/utils/videoPlayback.ts` định nghĩa `YOUTUBE_LOCKED_VARS` — `controls=0`, `disablekb=1`,
`fs=0`, `cc_load_policy=0`, `iv_load_policy=3`, `rel=0`, `modestbranding=1`, `vq=hd720`.
`youtubeEmbedUrl()` dựng query từ chính hằng số đó (test canh chuỗi trong `videoPlayback.test.ts`).
`ParrotPracticeView.tsx` trong `onReady` ghim `setPlaybackQualityRange('hd720','hd720')` và
`unloadModule('captions'/'cc')`; iframe có `pointer-events: none`. `StageCover` tự vẽ poster + nút
play thay vì để lộ chrome của YouTube, chỉ unmount khi `playing === true`. Ticker tự seek lại nếu
lệch trước `segment.start_ms` và dừng đúng `segment.end_ms`.

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
7. **Màu.** Nền `#F8FAFC` / `#0D1117`, card `#FFFFFF` / `#161B22`, thương hiệu `#00C7FF`
   (hành động), `#E6F9FF` (tint), `#007A9E` (chữ). Không để 2 màu nhấn cạnh tranh trong 1 khối.
   Token màu nằm ở `:root` trong `web/src/index.css`; dark mode qua `:root[data-theme="dark"]`.
   - Không dùng token đảo theme trên surface luôn tối (vd `.featured-challenge`): chữ phải cố định
     sáng (`--accent-400`).
   - Không hardcode `rgb(255 255 255 / x%)` cho surface; dùng
     `color-mix(in srgb, var(--paper) 97%, transparent)`.
8. **Màu câu hỏi trong một bài phải đồng nhất.** Chữ cái A/B/C/D dùng chung một badge trung tính;
   màu chỉ dành cho trạng thái (chọn / đúng / sai). Chip kỹ năng (NGHE / ĐỌC / VIẾT) cũng trung tính —
   nhãn mang nghĩa, không phải sắc màu.
9. **Trước khi báo xong:** chụp 1440 + 390 ở cả light và dark; đếm số lớp viền trong một khối (>1 là
   sửa); kiểm tra mép trái chữ thẳng hàng; không box nào trống > 40% diện tích.

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
npm test                       # 51 tests
```

Chụp màn hình bằng Playwright: binary
`C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe`, chạy với
`NODE_PATH=C:/Users/ADMIN/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules`.
Đăng nhập test qua `POST /api/auth/login` rồi inject `englearn_token`, `englearn_user`,
`engorace_theme` bằng `addInitScript`.

Lưu ý eslint vẫn còn vài finding có sẵn ở các file không thuộc đợt sửa này
(`SettingsPanel.tsx`, `AuthContext.tsx`, `i18n.tsx` — `react-refresh/only-export-components`).

---

## 6. Việc còn treo

- Social login Google/Facebook chưa có backend OAuth — cần client ID / App ID thật.
- Thumbnail YouTube ở section "Học qua ngữ cảnh" hơi chói, lệch tông.
- `battle_words.image_url` chưa có ảnh nào; khung chờ đã sẵn sàng, chỉ cần điền dữ liệu.
