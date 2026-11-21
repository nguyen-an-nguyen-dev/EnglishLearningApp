# Engorace — Cosmetic asset brief

Tài liệu này là “hợp đồng bàn giao” cho designer/AI vẽ asset. Làm đúng tên file,
kích thước và nền trong suốt là mình import thẳng vào app, không phải sửa DB.

---

## 1. Phong cách chung

- Glossy 3D cartoon / Pixar-lite.
- Hình khối dày, viền sạch, ít chi tiết vụn.
- Ánh sáng studio mềm, cùng một hướng (top-left) cho cả bộ.
- Màu bão hoà vừa phải, không gradient tối om.
- Nhân vật/đồ vật phải có silhouette đọc được ở 40–60px.
- **Không** chèn chữ, watermark, logo, khung UI, nền trang trí, bóng đổ dưới đất.

---

## 2. Ba nhóm asset

### A. Khung avatar — chỉ giao ĐẦU mascot

App đã tự vẽ vành, hiệu ứng, hạt sáng. Designer **chỉ cần giao đầu thú** trên nền
trong suốt. Không vẽ vành, không vẽ paws, không vẽ badge.

- Kích thước: **1024 × 1024 px** (vuông).
- Định dạng: **PNG-24, có alpha**.
- Đầu thú chiếm ~75–80% canvas, chừa 8–10% trong suốt quanh đầu.
- Nhìn chính diện (front view), mắt nhìn thẳng hoặc hơi chếch nhẹ.
- Không có thân, không có tay, không có nền, không có bóng đổ.

Thư mục:

```text
web/public/cosmetics/frames/heads/
```

Tên file:

| File | Nhân vật | Ghi chú |
| --- | --- | --- |
| `tiger.png` | hổ con | cam/kem, mắt to, tai tròn |
| `koala.png` | gấu túi | xám/trắng, mũi to, tai bông |
| `dog.png` | cún vàng | vàng golden, lưỡi hồng |
| `owl.png` | cú mèo | nâu/tím nhạt, mắt to |
| `unicorn.png` | kỳ lân | trắng/pastel, sừng cầu vồng |
| `cat.png` | mèo | kem/cam nhạt, mắt xanh |
| `dragon.png` | rồng | xanh ngọc/vàng, sừng nhỏ |
| `penguin.png` | cánh cụt | xanh đen/trắng, mỏ cam |
| `fox.png` | cáo | cam/trắng, tai nhọn |

Prompt mẫu (thay `<animal>`):

```text
A cute glossy 3D-rendered <animal> mascot head, front view, Pixar-style,
big expressive eyes, soft studio lighting from top-left, rich clean shapes,
no body, no hands, no ring, no frame, no text, no watermark,
isolated on a fully transparent background, centered, head fills 80% of a
square 1:1 canvas, high detail, crisp silhouette.
```

Negative prompt:

```text
text, watermark, logo, background, floor, ground shadow, ring, frame, badge,
body, arms, hands, multiple heads, cropped ears, low resolution, blurry,
extra eyes, distorted face, checkerboard background, UI
```

Nếu AI không xuất được alpha: xuất trên nền phẳng **#FF00FF** (magenta), không
dùng #00FF00 vì rồng/cáo có màu xanh. Sau đó xoá nền bằng Photopea/Photoshop/
remove.bg, kiểm tra lại mép tóc/lông.

---

### B. Xe — ảnh side-view

App hiện đang dùng xe vector. Nếu designer giao ảnh xe mới, mình sẽ bật lại nhánh
ảnh raster. Vì vậy file phải đúng chuẩn:

- Kích thước: **2048 × 1024 px** (tỉ lệ 2:1).
- Định dạng: **PNG-24, có alpha**.
- Xe nhìn **ngang, hướng sang phải** (mũi xe bên phải).
- Xe chiếm ~80–85% chiều rộng, bánh xe nằm trên đường đất ở ~88% chiều cao.
- Không có tài xế, không có bóng đổ dưới đất, không có nền, không có chữ.
- Cùng một góc nhìn, cùng hướng sáng cho cả 10 xe.

Thư mục:

```text
web/public/cosmetics/cars/
```

Tên file:

| File | Mẫu xe |
| --- | --- |
| `car_classic_yellow.png` | coupe cổ điển vàng, chrome, đuôi vịt |
| `car_sport_red.png` | supercar đỏ thấp, cánh gió sau |
| `car_mint.png` | kei van bạc hà, mui cao, cửa trượt, giá nóc |
| `car_navy.png` | muscle car navy dài, hốc gió nắp ca-pô |
| `car_aurora.png` | hover car tím/xanh, không bánh |
| `car_gold.png` | limousine vàng rất dài, cờ nhỏ |
| `car_rickshaw.png` | tuk-tuk 3 bánh xanh/vàng, mui vải |
| `car_monster.png` | monster truck xanh, bánh khổng lồ |
| `car_formula.png` | F1 đỏ, bánh lộ, cánh trước/sau |
| `car_jeep.png` | jeep/pickup đỏ, lốp dự phòng, giá nóc |

Prompt mẫu (thay `<type>`):

```text
A cute glossy 3D-rendered <type> car, full side view facing right,
Pixar-style proportions, thick clean shapes, soft studio lighting from
top-left, detailed wheels and rims, no driver, no text, no watermark,
no ground shadow, isolated on a fully transparent background,
centered, car fills 85% of a wide 2:1 canvas.
```

Negative prompt:

```text
text, watermark, logo, background, road, floor, ground shadow, driver, people,
cropped nose, cropped wheels, extra wheels, wrong direction, front view,
rear view, low resolution, blurry, duplicated car, UI
```

Nếu AI vẽ xe quay trái: lật ngang (flip horizontal) trước khi giao. Không tự ý
đổi góc nhìn giữa các xe.

---

### C. Nền nameplate — ảnh phong cảnh

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

## 3. Prompt copy nhanh (English)

Dùng đúng một dòng cho mỗi file. Các prompt đã bao gồm style lock, hướng nhìn và
nền trong suốt.

### Frames — `frames/heads/`

```text
tiger.png:
A cute glossy 3D-rendered tiger cub mascot head, front view, bright orange and cream fur, big expressive eyes, soft studio lighting from top-left, Pixar-style, no body, no hands, no ring, no frame, no text, no watermark, isolated on a fully transparent background, centered, head fills 80% of a square 1:1 canvas, crisp silhouette.

koala.png:
A cute glossy 3D-rendered koala mascot head, front view, soft grey and white fur, big round fluffy ears, large dark nose, sleepy-cute expression, soft studio lighting from top-left, Pixar-style, no body, no hands, no ring, no frame, no text, no watermark, isolated on a fully transparent background, centered, square 1:1, crisp silhouette.

dog.png:
A cute glossy 3D-rendered golden retriever puppy mascot head, front view, warm golden fur, floppy ears, happy tongue-out expression, big shiny eyes, soft studio lighting from top-left, Pixar-style, no body, no hands, no ring, no frame, no text, no watermark, isolated on a fully transparent background, centered, square 1:1, crisp silhouette.

owl.png:
A cute glossy 3D-rendered owl mascot head, front view, warm brown and lavender feathers, enormous round eyes, tiny beak, soft studio lighting from top-left, Pixar-style, no body, no wings, no ring, no frame, no text, no watermark, isolated on a fully transparent background, centered, square 1:1, crisp silhouette.

unicorn.png:
A cute glossy 3D-rendered unicorn mascot head, front view, pearly white fur with pastel pink and cyan mane, small rainbow spiral horn, big sparkling eyes, soft studio lighting from top-left, Pixar-style, no body, no hands, no ring, no frame, no text, no watermark, isolated on a fully transparent background, centered, square 1:1, crisp silhouette.

cat.png:
A cute glossy 3D-rendered cream-and-peach cat mascot head, front view, soft fluffy cheeks, big green eyes, tiny pink nose, gentle smile, soft studio lighting from top-left, Pixar-style, no body, no hands, no ring, no frame, no text, no watermark, isolated on a fully transparent background, centered, square 1:1, crisp silhouette.

dragon.png:
A cute glossy 3D-rendered baby emerald dragon mascot head, front view, deep green scales with gold horns and belly, large friendly eyes, tiny fangs, soft studio lighting from top-left, Pixar-style, no body, no hands, no ring, no frame, no text, no watermark, isolated on a fully transparent background, centered, square 1:1, crisp silhouette.

penguin.png:
A cute glossy 3D-rendered baby penguin mascot head, front view, blue-black and white feathers, bright orange beak, big curious eyes, soft studio lighting from top-left, Pixar-style, no body, no wings, no ring, no frame, no text, no watermark, isolated on a fully transparent background, centered, square 1:1, crisp silhouette.

fox.png:
A cute glossy 3D-rendered orange fox mascot head, front view, white muzzle and cheeks, pointed ears, clever friendly eyes, soft studio lighting from top-left, Pixar-style, no body, no hands, no ring, no frame, no text, no watermark, isolated on a fully transparent background, centered, square 1:1, crisp silhouette.
```

### Cars — `cars/`

```text
car_classic_yellow.png:
A cute glossy 3D-rendered classic 1950s yellow coupe, full side view facing right, chrome bumpers and trim, whitewall tyres, small ducktail spoiler, rounded retro silhouette, soft studio lighting from top-left, Pixar-style, no driver, no text, no watermark, no ground shadow, isolated on a fully transparent background, wide 2:1 composition, car fills 85% of the canvas.

car_sport_red.png:
A cute glossy 3D-rendered low red supercar, full side view facing right, long wedge nose, large rear wing, wide black tyres with silver rims, soft studio lighting from top-left, Pixar-style, no driver, no text, no watermark, no ground shadow, isolated on a fully transparent background, wide 2:1 composition, car fills 85% of the canvas.

car_mint.png:
A cute glossy 3D-rendered mint-silver kei van, full side view facing right, tall boxy roof, sliding side door, roof rack, short flat nose, soft studio lighting from top-left, Pixar-style, no driver, no text, no watermark, no ground shadow, isolated on a fully transparent background, wide 2:1 composition, car fills 85% of the canvas.

car_navy.png:
A cute glossy 3D-rendered long navy muscle car, full side view facing right, long bonnet with hood scoop, wide rear tyres, chrome details, low stance, soft studio lighting from top-left, Pixar-style, no driver, no text, no watermark, no ground shadow, isolated on a fully transparent background, wide 2:1 composition, car fills 85% of the canvas.

car_aurora.png:
A cute glossy 3D-rendered futuristic hover car, full side view facing right, purple and cyan paint, no wheels, glowing underglow pods, rounded canopy, soft studio lighting from top-left, Pixar-style, no driver, no text, no watermark, no ground shadow, isolated on a fully transparent background, wide 2:1 composition, car fills 85% of the canvas.

car_gold.png:
A cute glossy 3D-rendered long gold limousine, full side view facing right, three side windows, chrome trim, small flag on the bonnet, elegant low silhouette, soft studio lighting from top-left, Pixar-style, no driver, no text, no watermark, no ground shadow, isolated on a fully transparent background, wide 2:1 composition, car fills 85% of the canvas.

car_rickshaw.png:
A cute glossy 3D-rendered green and yellow three-wheel tuk-tuk, full side view facing right, fabric canopy, open passenger cabin, one small front wheel and one visible rear wheel, soft studio lighting from top-left, Pixar-style, no driver, no text, no watermark, no ground shadow, isolated on a fully transparent background, wide 2:1 composition, vehicle fills 75% of the canvas.

car_monster.png:
A cute glossy 3D-rendered green monster truck, full side view facing right, enormous black tyres, high suspension, short aggressive body, front grille, soft studio lighting from top-left, Pixar-style, no driver, no text, no watermark, no ground shadow, isolated on a fully transparent background, wide 2:1 composition, truck fills 85% of the canvas.

car_formula.png:
A cute glossy 3D-rendered red formula race car, full side view facing right, open wheels, pointed nose, front and rear wings, low long silhouette, soft studio lighting from top-left, Pixar-style, no driver, no text, no watermark, no ground shadow, isolated on a fully transparent background, wide 2:1 composition, car fills 90% of the canvas.

car_jeep.png:
A cute glossy 3D-rendered red off-road jeep pickup, full side view facing right, boxy body, roof rack, spare tyre on the rear, high clearance, chunky tyres, soft studio lighting from top-left, Pixar-style, no driver, no text, no watermark, no ground shadow, isolated on a fully transparent background, wide 2:1 composition, vehicle fills 85% of the canvas.
```

### Nameplates — `plates/`

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

## 4. Cách giao file

Chỉ cần đặt file đúng thư mục và đúng tên ở trên. Không cần sửa code, không cần
sửa database nếu giữ nguyên `visual_key` cũ.

Cấu trúc bàn giao:

```text
web/public/cosmetics/
  frames/heads/
    tiger.png
    koala.png
    dog.png
    owl.png
    unicorn.png
    cat.png
    dragon.png
    penguin.png
    fox.png
  cars/
    car_classic_yellow.png
    car_sport_red.png
    car_mint.png
    car_navy.png
    car_aurora.png
    car_gold.png
    car_rickshaw.png
    car_monster.png
    car_formula.png
    car_jeep.png
  plates/
    plate_slate.jpg
    plate_cyan.jpg
    plate_sunset.jpg
    plate_forest.jpg
    plate_royal.jpg
    plate_desert.jpg
    plate_space.jpg
    plate_sakura.jpg
    plate_ocean.jpg
    plate_aurora.jpg
```

Kiểm tra trước khi gửi:

- [ ] Đúng tên file, đúng thư mục.
- [ ] PNG còn alpha (mở bằng Photopea, nền ca-rô).
- [ ] Không có viền trắng/viền xanh quanh nhân vật.
- [ ] Không có chữ/watermark.
- [ ] Xe hướng phải, không bị cắt mũi/bánh.
- [ ] Đầu thú không có vành/tay/thân.
- [ ] Nền 16:9, không chữ, không UI.
- [ ] Cùng một phong cách ánh sáng cho cả bộ.

---

## 5. Import phía app

Khi có file, mình sẽ:

1. Thêm đầu thú vào `FRAME_HEAD` trong `web/src/cosmeticAssets.ts`.
2. Bật lại `CAR_ART` + nhánh `<img>` trong `CarSidePreview` nếu nhận xe raster.
3. Cập nhật `PLATE_ART` nếu tên file nền thay đổi.
4. Chạy typecheck, lint, test, build; xem lại Gara/Profile/Rankings.

Không cần đổi `visual_key` trong `shop_items`, nên không phải làm migration mới.
