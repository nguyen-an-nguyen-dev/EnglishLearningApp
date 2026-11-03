# DESIGN-RULES.md — Đọc lại trước MỌI task UI

Mục đích: không lặp lại "AI slop". Đây là lỗi cụ thể của tôi, không phải lý thuyết.

## 1. Khung trong khung = slop

Lỗi đã mắc: `panel > frame > engine > chip` — 4 lớp viền lồng nhau.
`panel > inspector > card > meaning-box` — 4 lớp nữa.

**Rule:** một khối nội dung chỉ được có **1 viền**. Nếu đã có panel bọc ngoài thì bên trong
**không border, không background, không radius**. Phân tách bằng khoảng trắng và hairline 1px,
không phải bằng hộp.

Trước khi thêm `border`/`background`, tự hỏi: "cái hộp này có mang thông tin gì không?"
Nếu chỉ để "cho nó nổi" → bỏ.

## 2. Khoảng trắng phải có lý do

Lỗi đã mắc: card `flex: 1` để cột cao bằng cột kia → sinh ra 200px trống trong card.
Đó là khoảng trắng do layout, không phải do thiết kế.

**Rule:** không kéo giãn box để lấp chỗ. Cho nội dung cao đúng bằng nội dung.
Cột ngắn hơn cột kia là bình thường — miễn là không có đường viền vẽ ra cái khoảng trống đó.

Padding: dùng thang 4/8/12/16/24/32/48. Không rải `padding: 17px 15px 13px`.

## 3. Căn chỉnh: một trục duy nhất

Lỗi đã mắc: trong cùng 1 cột, chữ bắt đầu ở 696 / 698 / 716px.

**Rule:** mọi text trong một cột phải chung **một** mép trái. Icon không được đẩy chữ lệch đi
— nếu icon nằm ngoài lề thì chữ vẫn phải thẳng hàng với chữ khác, không thụt vào.

Không center text trong UI (trừ hero, empty state, modal ngắn).

## 4. Chiều sâu đến từ tương phản, không từ viền

Lỗi đã mắc: mọi thứ đều `border: 1px solid var(--line)` + `box-shadow` nhẹ → phẳng và xám.

**Rule:** chiều sâu = 1 trong 3:
- đổi **màu nền** (surface sáng/tối hơn),
- đổi **cỡ chữ** (tương phản tỉ lệ),
- đổi **mật độ** (chỗ dày chỗ thoáng).

Chỉ **một** lớp được có shadow trong một khung nhìn. Shadow để nâng vật thể thật
(video, ảnh, modal), không dùng cho mọi card.

## 5. Đừng trang trí bằng thứ không mang thông tin

Đã xoá và không được thêm lại: thanh `.featured-lane`, chấm `.challenge-row-players i`,
badge "VS", vòng avatar, đường kẻ trang trí, watermark chữ mờ.

## 6. Icon: thư viện, không tự vẽ, KHÔNG BAO GIỜ bọc hộp

Icon lấy từ `@phosphor-icons/react`. Không tự viết `<svg>`.

**Tuyệt đối không đặt icon vào ô vuông bo góc có nền/viền.** Đây là lỗi bị nhắc nhiều lần nhất.
Icon đứng trần trên nền, màu do `color` quyết định. Nếu cần vùng chạm thì dùng `padding`
+ hover `background`, còn trạng thái nghỉ **không có hộp**.

Đã dỡ ở: `.stat-pill`, `.streak-pill`, `.xp-pill`, `.streak-icon`, `.challenge-row-icon`,
`.featured-icon`, `.p-stat-box`, `.stop-detail-icon`, `.challenge-row-action`,
`.lp-button-icon-disc`, `.theme-toggle`, `.auth-social-btn`, `.nav-item-action`.

Ngoại lệ hợp lệ: nút bấm thật (có `border` để biết bấm được) và avatar chữ cái.

**Ngoại lệ thứ hai: logo thương hiệu bên thứ ba** (Google, Facebook, Apple...).
Phosphor chỉ có bản một màu, render ra bị mảnh hoặc thành cục đặc — sai nhận diện.
Với social login phải dùng mark chính thức (Google 4 màu, Facebook xanh) dạng inline SVG
đặt trong `AuthModal.tsx`. Đây là yêu cầu của brand guideline, không phải trang trí.

## 7. Màu

- Nền: `#F8FAFC` (sáng) / `#0D1117` (tối). Card: `#FFFFFF` / `#161B22`.
- Thương hiệu: `#00C7FF` cho hành động, `#E6F9FF` cho tint, `#007A9E` cho chữ.
- Không dùng 2 màu nhấn cạnh tranh trong cùng 1 khối.

**Không dùng token đảo theo theme trên surface luôn tối.** `.featured-challenge` tối ở
cả 2 theme, nhưng badge dùng `--accent-200` (`#F8E2B9` sáng → `#4A3A1E` tối) nên dark mode
ra chữ nâu đen trên nền đen. Surface cố định tối thì màu chữ cũng phải cố định sáng
(`--accent-400` sáng ở cả 2 theme).

**Không hardcode `rgb(255 255 255 / x%)` cho surface.** `.mobile-nav` để nền trắng đục
nên dark mode thành thanh trắng. Dùng `color-mix(in srgb, var(--paper) 97%, transparent)`.

## 8. Trước khi báo xong

1. Chụp màn hình ở 1440 và 390, cả light và dark.
2. Đếm số lớp viền trong 1 khối — nếu > 1, sửa.
3. Kiểm tra mép trái các text trong cùng cột — phải thẳng.
4. Không có box nào có khoảng trống > 40% diện tích.
