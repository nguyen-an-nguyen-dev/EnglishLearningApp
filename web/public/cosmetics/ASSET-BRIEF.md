# Engorace · Asset mỹ phẩm

Xe và khung avatar dùng SVG trong [catalog Gara](../../src/components/cosmetics/garage/README.md). Mở `/cosmetics-preview.html` để xem mẫu đang dùng.

## Ảnh nền nameplate

- Kích thước: **1600 × 900 px** (16:9).
- Định dạng: **JPG quality 80–85** hoặc **WebP quality 82**.
- Không chữ, không nhân vật, không UI, không watermark.
- Bố cục thoáng ở giữa (chỗ đặt tên), chi tiết mạnh ở hai bên/trên.
- Có thể tối nhẹ 4 góc để chữ trắng dễ đọc.

Thư mục:

```text
web/public/cosmetics/plates/
```

Tên file:

| File | Cảnh |
| --- | --- |
| `plate_slate.jpg` | núi tuyết trên biển mây, bình minh |
| `plate_cyan.jpg` | biển mây trắng, nắng |
| `plate_sunset.jpg` | đồi cỏ hoàng hôn |
| `plate_forest.jpg` | rừng thông, nắng xuyên tán |
| `plate_royal.jpg` | đêm sao trên núi tuyết |
| `plate_desert.jpg` | hẻm núi sa mạc lúc chiều |
| `plate_space.jpg` | tinh vân xanh tím |
| `plate_sakura.jpg` | hoa anh đào / đền Nhật |
| `plate_ocean.jpg` | biển nhiệt đới, cát vàng |
| `plate_aurora.jpg` | cực quang trên tuyết |

Prompt mẫu (thay `<scene>`):

```text
A cinematic painterly 3D game background of <scene>, 16:9 wide composition,
rich colour, soft atmospheric light, detailed but not busy, darker corners,
empty calm centre for a name plate, no text, no characters, no UI,
no watermark, high resolution.
```

Negative prompt:

```text
text, typography, logo, watermark, character, animal, UI, frame, border,
collage, split screen, low resolution, blurry, oversaturated, messy centre
```

---

## Prompt theo từng nền

```text
plate_slate.jpg:
A cinematic painterly 3D game background of snowy mountains rising above a sea of clouds at sunrise, warm pink and blue sky, 16:9 wide composition, detailed peaks, calm empty centre for a name plate, darker corners, no text, no characters, no UI, no watermark, high resolution.

plate_cyan.jpg:
A cinematic painterly 3D game background of a bright sea of white clouds under a clear blue sky, soft sun rays, 16:9 wide composition, airy and calm, empty centre for a name plate, no text, no characters, no UI, no watermark, high resolution.

plate_sunset.jpg:
A cinematic painterly 3D game background of rolling grass hills at sunset, warm orange and pink sky, long shadows, 16:9 wide composition, calm empty centre for a name plate, no text, no characters, no UI, no watermark, high resolution.

plate_forest.jpg:
A cinematic painterly 3D game background of a sunlit pine forest, soft god rays through the canopy, deep green and gold palette, 16:9 wide composition, empty centre for a name plate, no text, no characters, no UI, no watermark, high resolution.

plate_royal.jpg:
A cinematic painterly 3D game background of a starry night sky and the Milky Way over snowy mountain peaks, deep navy and violet, 16:9 wide composition, empty centre for a name plate, no text, no characters, no UI, no watermark, high resolution.

plate_desert.jpg:
A cinematic painterly 3D game background of a red desert canyon at dusk, layered rock formations, warm dusty light, 16:9 wide composition, empty centre for a name plate, no text, no characters, no UI, no watermark, high resolution.

plate_space.jpg:
A cinematic painterly 3D game background of a blue and violet nebula in deep space, scattered stars, subtle planet glow, 16:9 wide composition, empty centre for a name plate, no text, no characters, no UI, no watermark, high resolution.

plate_sakura.jpg:
A cinematic painterly 3D game background of cherry blossoms around a Japanese temple in spring, soft pink petals, warm afternoon light, 16:9 wide composition, empty centre for a name plate, no text, no characters, no UI, no watermark, high resolution.

plate_ocean.jpg:
A cinematic painterly 3D game background of a tropical ocean and golden beach, turquoise water, gentle waves, bright sky, 16:9 wide composition, empty centre for a name plate, no text, no characters, no UI, no watermark, high resolution.

plate_aurora.jpg:
A cinematic painterly 3D game background of green and violet aurora over snowy pine trees, starry night, 16:9 wide composition, empty centre for a name plate, no text, no characters, no UI, no watermark, high resolution.
```

Negative prompt dùng chung:

```text
text, watermark, logo, UI, frame, border, background clutter, floor, ground shadow, driver, people, body, arms, hands, ring, badge, multiple subjects, cropped subject, extra wheels, wrong direction, front view, rear view, blurry, low resolution, distorted, duplicate, checkerboard
```

---

## Cập nhật ảnh

Giữ tên file và `visual_key` hiện tại khi thay ảnh. Nếu đổi tên file, cập nhật đường dẫn trong `web/src/cosmeticAssets.ts`.
