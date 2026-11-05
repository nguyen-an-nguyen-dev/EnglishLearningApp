# MEMORY.md — EnglishLearningApp

## BẮT BUỘC trước mọi task UI

Đọc **mục 4 của `README.md`** (quy tắc thiết kế) và dùng các skill trong
`.workbuddy-ai/skills/` (`design-taste-frontend`, `minimalist-ui`, `redesign-existing-projects`).
Đó là danh sách lỗi cụ thể đã mắc (khung lồng khung, khoảng trắng thừa, lệch mép trái,
viền hoá mọi thứ). Không lặp lại. `DESIGN-RULES.md` cũ đã gộp vào README, không tạo file luật mới.

## Bối cảnh

- User phụ trách **web + backend**, không đụng `mobile/` (chỉ đọc để lấy màu).
- Mọi tài liệu gom trong **một** `README.md` ở gốc; không tạo plan/implement/doc/DOC_MAP nữa.
- Mobile app (`mobile/`) là **nguồn tham chiếu cho bộ 3 màu wordmark**, không còn là nguồn nền:
  `#00C7FF` / `#7CCB86` / `#F59E0B` (dark) và bản đậm `#009ECB` / `#5CAF6B` / `#D9820B` (light).
- **Palette web hiện tại = kem nâu ấm "latte"** (user chốt, không dùng tông xanh lạnh kiểu AI slop):
  light nền `#F7F1E8`, giấy `#FFFDF9`, chữ `#352C24`; dark `#1C1917` / `#26221F` / `#F5EDE3`.
  Cyan `#00C7FF` chỉ dành cho action. Token ở `:root` / `:root[data-theme="dark"]` trong
  `web/src/index.css`; mọi trang dashboard (kể cả `data-video-mono`) **phải dùng chung** token này,
  không redefine ramp riêng.
- **Landing là ngoại lệ có chủ đích** (user đổi 04/11): **light-only, một gam cyan nhạt**
  `#E4F7FF` nền / `#F1FBFF` giấy / `#0E3542` chữ / `#CFEDFB` CTA cuối; action vẫn `#00C7FF`.
  Bỏ nút sáng/tối ở header landing. `LandingPage.tsx` ép `data-theme=light` + `html.lp-active`
  rồi khôi phục theme đã lưu khi vào dashboard; ramp nằm trong `landing.css`
  (`html.lp-active .landing-page-wrapper`), **không sửa `:root`**. Footer full-width có tagline,
  không còn khối nâu đen. Wordmark vẫn dùng `--brand-wordmark-*` chung. Đây là yêu cầu mới của
  user, **không** tự ý kéo gam này sang dashboard.
- Ngôn ngữ UI: tiếng Việt. Font: Be Vietnam Pro; Fraunces chỉ cho số liệu/serif accent.

## Stack

- `web/`: Vite + React + TS, CSS thuần (`src/index.css` cho dashboard, `src/landing.css` cho landing).
- `backend/`: Express + MySQL (MariaDB), JWT. Chạy `cd backend && npm run dev` (port 3000).
- Token màu nằm ở `:root` trong `web/src/index.css`; dark mode qua `:root[data-theme="dark"]`.

## Tài khoản test

- `test@test.com` / `123456` (id 10)
- `temp@engorace.dev` / `temp123456` (id 9)

## Đã xong / cần nhớ

- **Không còn tên "Parrot" trong web.** Component luyện nghe là
  `web/src/components/video/PracticeView.tsx` (`PracticeView`), CSS dùng `.practice-*`,
  key i18n dùng `practice*`. Đã đổi cả file, class, key, script QA và README; không đặt lại
  tên cũ khi thêm tính năng mới cho màn hình này.
- **DB chỉ còn 1 file `backend/database/final.sql`** (22 bảng / 2392 dòng, sinh từ DB thật,
  DROP+CREATE lại DB). Mọi migration/seed/script SQL cũ đã gộp và dọn khỏi project (bản sao ở
  `Temp/engorace-database-backup-20261104-184202/`). Không tạo file migration mới; đổi DB rồi
  sinh lại bằng `.workbuddy-ai/tmp-shots/dump-final-sql.cjs` + `verify-final-sql.cjs`.
- `web/public/arena/` có 100 ảnh CC0 `≤960px` (~12 MB); `battle_words.image_url` đã điền
  100/100 ngay trong `final.sql`. Nếu deploy tách web/API thì copy cả thư mục `arena/` lên
  server tĩnh.
- Build lại `npx vite build` khi `dist/arena/` đã tồn tại có thể vướng guard xoá >50 file:
  chuyển `dist/arena/` ra Temp trước rồi build. Không sửa tay file trong `dist/`.
- **Sân luyện nghe: chỉ TẮT phụ đề, KHÔNG giấu hình.** User đã từ chối `ListeningVeil`
  (blur/audio-only) — đã xoá hẳn khỏi TSX + CSS + i18n. Giữ `cc_load_policy=0` +
  `stripCaptions()` (`setOption`/`unloadModule`, chạy ở onReady/onStateChange/onApiChange +
  lặp 400ms lúc phát). `StageCover` **chỉ** hiện trước lần play đầu
  (`playToken === 0 && !playing`); sau đó video hiện đầy khung 16:9, không overscan/blur.
- **Chống tràn viền**: card con `display:grid` phải có `grid-template-columns: minmax(0,1fr)`
  + `min-width:0`; hàng flex có input `flex:1 1 0` và nút `flex:0 0 auto; white-space:nowrap`.
  Track `auto` = `max-content` từng làm nút `Trả lời` thò ra khỏi `.arena-reply` ở 730px.
  Quy tắc số 10 trong mục 4 README.

## En Buddy — AI bạn học (chốt 05/11)

- **Kiến trúc (user giao, cập nhật 05/11)**: drawer chat toàn cục ở cả 6 tab. Thẻ tắt
  "Chú xe có việc nè" trong header trang Học Tập **đã bị user bắt bỏ** — lối vào duy nhất là chú
  xe ở góc màn hình. **Không thêm tab sidebar**, không tạo file plan/doc riêng, không thêm lại
  card vào roadmap.
  Code: `web/src/components/ai/StudyBuddy.tsx`, `web/src/buddy.css`,
  `web/src/services/aiChatService.ts`, gắn trong `App.tsx`.
- Backend `/api/ai/chats*` đã có từ trước (Gemini + `getLearnerContext`), web từng không gọi.
  Bổ sung `GET /api/ai/study-plan`, enum `chats.topic` + `STUDY_COACH`, `intent`/`context` cho
  `POST .../messages`. **Plan 3 bước luôn tính từ DB thật** (`buildStudyPlan`), AI chỉ viết
  `aiNote`; bước có `target.tab`/`lessonId` để web nhảy thẳng vào bài.
- `AI_API_URL` (Gemini) timeout trong mạng dev; `NVIDIA_API_URL` trong `.env` chạy ~1s.
  `requestCoachAi()` (chỉ luồng coach/plan) ưu tiên NVIDIA rồi fallback Gemini 15s;
  **giữ nguyên `requestAi()`** để contract/test cũ không đổi. Không sửa `.env`.
- `final.sql` chỉ sửa 1 dòng enum, KHÔNG regenerate (DB thật có dữ liệu QA thừa;
  `verify-final.sql` báo lệch có sẵn từ trước). Đừng "sửa" cái lệch đó bằng cách dump lại DB.
- **Giao diện phải vui, KHÔNG phải widget chat SaaS** (user chê bản đầu 05/11): nhân vật là
  chú xe chở sách `web/public/logo.png` (bong bóng thoại, mood, sticker nghiêng, nền chấm sổ tay,
  copy thân mật). Cấm quay lại kicker monospace / tab gạch chân / pill Intercom.
- Nếu cả 2 provider AI lỗi, `buildOfflineCoachReply()` trả câu "tự lật sổ tay" từ dữ liệu thật;
  không để chat báo 503 cho người học. Giữ selector `.buddy-*` cho script QA.
- **Motion có 1 hệ nhịp chung** (`--buddy-ease/soft/fast/mid/slow` trong `buddy.css`): thở xe +
  bóng 4.2s, bong bóng crossfade, panel in/out, tin nhắn + bước `buddy-rise`, chấm gõ cùng easing.
  Mood xe là transition tách khỏi animation nhờ wrapper `.buddy-breathe`. Đừng thêm animation
  độc lập nhịp riêng; `prefers-reduced-motion` phải tắt sạch. UI thiên gần gũi: nghiêng rất nhẹ,
  không tab gạch chân, padding rộng.

## Roadmap / sương mù (05/11)

- Chặng chưa học bị phủ sương **2 lớp**: nhẹ từ chặng đầu còn bài chưa `done`, dày từ chặng đầu
  mà mọi bài `locked`. Lý do có 2 lớp: `test@test.com` đã xong 35/36 bài, nếu chỉ mờ chặng
  "toàn locked" thì tài khoản chính không thấy hiệu ứng gì. Chặng đã xong hết thì trong suốt.
- Code nằm trong `RouteMapCard.tsx` (`fog` memo + gradient id) và `index.css`
  (`.roadmap-stage-scene.is-misty/.is-foggy`, `.roadmap-fog-wisp`, `.roadmap-fog-label`).
  Sương có `pointerEvents="none"` để marker khoá vẫn bấm được; nhãn ẩn ≤640px; wisps dùng chung
  `--buddy-soft` và tắt khi reduced-motion. Không dùng một rect trắng đặc (tẩy trắng cảnh).

## Việc còn treo

- Social login (Google/Facebook) chưa có backend OAuth — cần client ID từ user.
- AI: streaming, markdown renderer, rate-limit `/api/ai/*`, ghi `users.streak`, bản en cho nội dung AI.
