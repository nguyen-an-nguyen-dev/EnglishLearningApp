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

## Việc còn treo

- Social login (Google/Facebook) chưa có backend OAuth — cần client ID từ user.
