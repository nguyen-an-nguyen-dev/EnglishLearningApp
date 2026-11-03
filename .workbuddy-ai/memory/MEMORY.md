# MEMORY.md — EnglishLearningApp

## BẮT BUỘC trước mọi task UI

Đọc `.workbuddy-ai/DESIGN-RULES.md`. Đó là danh sách lỗi cụ thể đã mắc (khung lồng khung,
khoảng trắng thừa, lệch mép trái, viền hoá mọi thứ). Không lặp lại.

## Bối cảnh

- User chỉ phụ trách **web** (không đụng mobile/backend trừ khi được yêu cầu).
- Mobile app (`mobile/`) là **nguồn tham chiếu màu**: `mobile/constants/Colors.ts`.
  Nền sáng `#F8FAFC`, tối `#0D1117`, thương hiệu `#00C7FF` / `#E6F9FF` / `#009ECB`.
- Ngôn ngữ UI: tiếng Việt. Font: Be Vietnam Pro; Fraunces chỉ cho số liệu/serif accent.

## Stack

- `web/`: Vite + React + TS, CSS thuần (`src/index.css` cho dashboard, `src/landing.css` cho landing).
- `backend/`: Express + MySQL (MariaDB), JWT. Chạy `cd backend && npm run dev` (port 3000).
- Token màu nằm ở `:root` trong `web/src/index.css`; dark mode qua `:root[data-theme="dark"]`.

## Tài khoản test

- `test@test.com` / `123456` (id 10)
- `temp@engorace.dev` / `temp123456` (id 9)

## Việc còn treo

- Social login (Google/Facebook) chưa có backend OAuth — cần client ID từ user.
- Thumbnail YouTube ở section "Học qua ngữ cảnh" chói, lệch tông.
