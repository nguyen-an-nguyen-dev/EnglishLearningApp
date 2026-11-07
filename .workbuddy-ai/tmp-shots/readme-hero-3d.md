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
