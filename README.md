# Engorace — English Learning Platform

Engorace là nền tảng học tiếng Anh trên web và mobile. Người học đi theo lộ trình
bài học có cấu trúc, luyện nghe qua video YouTube, ôn từ vựng theo lịch lặp lại
ngắt quãng, và thi đấu từ vựng thời gian thực với người khác. Trợ lý AI **En Buddy**
trả lời câu hỏi và gợi ý nội dung nên học tiếp.

---

## 1. Tổng quan kiến trúc

```
┌──────────────────────┐      ┌──────────────────────┐
│  web/ (React 19)     │      │  mobile/ (Expo, RN)  │
│  Vite, Tailwind 4    │      │  expo-router         │
└──────────┬───────────┘      └──────────┬───────────┘
           │ HTTP /api, /media          │ HTTP /api
           │ WebSocket /socket.io       │ WebSocket /socket.io
           ▼                            ▼
┌────────────────────────────────────────────────────────┐
│  backend/ — Express 5 + Socket.IO (Node.js, TypeScript)│
│  middleware: request-id, security headers, CORS,       │
│              authenticate (JWT), requireAdmin          │
│  modules: auth · learning · review · gamification ·    │
│           battle · ai · buddy · video · speech ·       │
│           translation · ranking · badges · reminders · │
│           analytics · admin                            │
└───────────┬───────────────────────┬────────────────────┘
            ▼                       ▼
   MariaDB / MySQL (mysql2)   Dịch vụ ngoài
   pool 10 kết nối            Token Harbor · Gemini ·
                              SMTP · Google / Facebook · YouTube
                              (yt-dlp) · Cloudinary · Supabase
```

### Công nghệ

| Lớp | Công nghệ |
|---|---|
| Web | React 19, TypeScript, Vite, Tailwind 4, Phosphor icons, Fontsource (Be Vietnam Pro, Fraunces) |
| Mobile | Expo, React Native, expo-router, socket.io-client, expo-secure-store |
| API | Node.js, Express 5, Socket.IO, multer (upload), nodemailer (OTP) |
| Dữ liệu | MariaDB/MySQL qua `mysql2`, schema trong `backend/database/init.sql` |
| Xác thực | bcrypt (mật khẩu), JWT, Google ID token, Facebook Graph API |
| AI & giọng nói | Token Harbor (DeepSeek V4.1 Flash), Google Gemini, AssemblyAI (speech-to-text), giọng Microsoft Neural (`msedge-tts`) |

### Cấu trúc thư mục

```
backend/   API Express, các module nghiệp vụ, script và test
web/       Ứng dụng React cho người học và trang /admin
mobile/    Ứng dụng Expo
docs/      Đặc tả, sơ đồ UML, ghi chú kiến trúc
```

### Quy ước backend

- Mỗi module thường có `*.routes.ts` → `*.controller.ts` → `*.service.ts` → `*.repository.ts`.
  Repository chỉ chạy SQL; quy tắc nghiệp vụ nằm ở service.
- **Xác thực**: route cần đăng nhập đi qua `authenticate`, đọc Bearer JWT và gán
  `request.auth.userId`. Route admin thêm `requireAdmin`.
- **Ghi nhiều bảng** (XP, ví, streak, bảng xếp hạng) dùng transaction.
- **Lỗi nghiệp vụ** ném `HttpError(status, message, codes)`.
- **Con số thưởng** tập trung ở `gamification.rewards.ts`; các module khác đọc từ đây.

### Phía client

- **Web** không dùng react-router. `App.tsx` tự quản lý tab (Lộ trình, Video, Dịch,
  Đấu trường, Xếp hạng, Hồ sơ, Cửa hàng); các màn nặng được lazy-load.
  Route `/admin` được tách ở `admin/adminRoute.ts` và render `AdminApp`.
- Thứ tự provider trong `main.tsx`: `LanguageProvider` → `AuthProvider` →
  `LearningProvider` → `WalletProvider`.
- `services/apiClient.ts` tự gắn token. Khi API trả 401, client xóa phiên và phát
  sự kiện `englearn:session-expired`.
- **Mobile**: `services/api.ts` chọn địa chỉ API theo thứ tự `EXPO_PUBLIC_API_URL`,
  rồi host của Expo dev server (`http://<host>:3000/api`), Android emulator
  (`10.0.2.2`), cuối cùng là `localhost`. Token lưu trong SecureStore; trên web dùng
  bộ nhớ tạm.

---

## 2. Cài đặt môi trường local

1. **Cơ sở dữ liệu**: `init.sql` chỉ tạo schema; `seeds.sql` chỉ chứa dữ liệu.
   ```bash
   mysql -u root -p < backend/database/init.sql
   mysql -u root -p english_learning < backend/database/seeds.sql
   ```
2. **`backend/.env`** (tối thiểu):
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=root
   DB_NAME=english_learning
   JWT_SECRET=<chuỗi ngẫu nhiên đủ dài>
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
   ```
   Các biến AI, OTP/SMTP, speech, Cloudinary và đăng nhập mạng xã hội được mô tả ở các mục bên dưới.
3. **Chạy**:
   ```bash
   cd backend && npm install && npm run dev
   cd web && npm install && npm run dev
   ```
   Vite proxy `/api`, `/media` và `/socket.io` sang `http://localhost:3000`.
   Trang quản trị: `http://localhost:5173/admin`.

   Các địa chỉ tab người học gồm `/study`, `/videolearning`, `/translate`, `/arena`,
   `/rankings`, `/gara` và `/profile`. Các tab quản trị nằm tại `/admin/overview`,
   `/admin/content`, `/admin/videos`, `/admin/shop`, `/admin/arena`, `/admin/users` và
   `/admin/stats`. Khi triển khai bản web, cấu hình máy chủ trả về `index.html` cho
   các đường dẫn trang để mở trực tiếp và tải lại được. Các đường dẫn API và tài nguyên
   tĩnh tiếp tục được phục vụ riêng.

Avatar: nếu cấu hình Cloudinary thì upload lên đó; lỗi hoặc thiếu cấu hình thì lưu cục
bộ dưới `/media/avatars`. CSDL tạo từ trước các thay đổi này cần chạy các file trong
`backend/database/migrations/` theo thứ tự ngày (`2026-11-22-user-avatars.sql`,
`2026-11-23-remove-lapis-league.sql`, `2026-11-24-video-publish-status.sql`,
`2026-11-26-speaking-question-type.sql`) sau khi sao lưu. Seed mới bổ sung câu đọc mẫu và
đáp án tương ứng bằng ID riêng.

### Dữ liệu demo và kiểm tra

```bash
cd backend
npm run seed:demo    # scripts/seed-demo.mjs: tạo 60 learner demo (10 người mỗi hạng)
npm run db:verify    # scripts/verify-database-split.mjs: kiểm tra tách schema/seed
```

### Lệnh kiểm thử và build

```bash
# backend
npm run typecheck
npm test             # scripts/run-tests.mjs

# web
npm run lint
npm run test
npm run build        # tsc -b && vite build
```

---

## 3. Xác thực và tài khoản

**Route**: `/api/auth/*`.

### Đăng ký bằng OTP qua email
1. `POST /register/start`: kiểm tra dữ liệu. Email đã có tài khoản → `409`. Nếu không,
   lưu bản ghi `pending_registrations` với mã OTP **đã băm**, gửi OTP qua SMTP (nodemailer).
2. `POST /register/verify`: kiểm tra theo thứ tự:
   - hết hạn → `OTP_EXPIRED`;
   - vượt số lần thử → `OTP_TOO_MANY_ATTEMPTS` (429);
   - so sánh hash bằng phép so sánh timing-safe; sai thì tăng bộ đếm → `OTP_INVALID`.
   Khi đúng: tạo `users`, xóa bản ghi pending, khởi tạo streak, cấp JWT.
   Trùng khóa duy nhất do yêu cầu song song → `409`.
3. `POST /register/resend` gửi lại OTP, có giới hạn khoảng cách giữa hai lần gửi (`OTP_RESEND_SECONDS`).

Mỗi bước có giới hạn tần suất theo IP (`registerIpLimit`, `verifyOtpLimit`, `resendOtpLimit`).

Biến liên quan: `OTP_EXPIRY_MINUTES`, `OTP_MAX_ATTEMPTS`, `OTP_RESEND_SECONDS`,
`OTP_DEBUG` (chế độ phát triển: trả `dev_code` trong phản hồi, không dùng khi production),
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.

### Đăng nhập
- `POST /login`: bcrypt so sánh mật khẩu. Có giới hạn tần suất theo **IP** và theo
  **tài khoản** để chống dò mật khẩu.
- Phát JWT có thời hạn `JWT_EXPIRES_IN`. `authenticate` xác minh bằng `JWT_SECRET`.

### Đăng nhập Google / Facebook
- `POST /google` nhận ID token, xác minh qua `oauth2.googleapis.com/tokeninfo` và kiểm tra
  `GOOGLE_CLIENT_ID`.
- `POST /facebook` nhận access token, xác minh qua `graph.facebook.com`.
- Định danh lưu theo cặp **(provider, provider_user_id)**. Hệ thống **không gộp tài khoản
  theo email** để tránh chiếm tài khoản qua email chưa xác minh.
- Liên kết thêm phương thức: `GET /providers` (danh sách bật/tắt),
  `GET /providers/links` (liên kết của tôi), `POST /providers/:provider/link`,
  `DELETE /providers/:provider`.

### Hồ sơ
- `GET /me`, `PATCH /profile`, `POST /avatar` (multer, lưu Cloudinary hoặc cục bộ),
  `PATCH /password`.

---

## 4. Lộ trình bài học (Learning)

**Route**: `GET /api/stages`, `GET /api/stages/:id/lessons`, `GET /api/lessons/:id`,
`GET /api/lessons/:id/questions`, `POST /api/lessons/:id/questions/:qid/check`,
`POST /api/lessons/:id/complete`, `GET /api/progress`.

### Cấu trúc nội dung
`stage` (chặng) → `lesson` (bài) → `question` (câu hỏi). Admin quản lý nội dung (mục 13).
Loại câu: `multiple_choice`, `fill_choice`, `listen_choice`, `fill_blank`, `translate`,
`word_order`, `listening`, `speaking`.
Câu `listening` và `listen_choice` có audio: `resolveAudioUrl` ghép đường dẫn tương đối thành URL của bucket
Supabase Storage (`SUPABASE_URL`, `SUPABASE_BUCKET`); URL tuyệt đối để nguyên. Thiếu cấu hình thì báo lỗi 500.

### Mở khóa bài học
`buildLessonStates` xếp bài theo thứ tự giáo trình. Mốc tiến độ là vị trí ngay sau bài
hoàn thành xa nhất:
- Bài đã hoàn thành là **completed**.
- Bài đúng tại mốc là **unlocked** (bài đang học).
- Bài trước mốc nhưng chưa làm là **available** (làm được, không bắt buộc).
- Bài sau mốc là **locked**.

### Chấm từng câu
`POST .../check` (`isAnswerCorrect`):
- Nhóm trắc nghiệm (`multiple_choice`, `fill_choice`, `listen_choice`): khớp theo **ID đáp án**
  hoặc theo **nội dung đã chuẩn hóa**.
- Nhóm nhập chữ (`fill_blank`, `translate`, `word_order`, `listening`): so sánh nội dung
  đã chuẩn hóa (bỏ hoa thường, dấu câu, khoảng trắng thừa).

- `speaking` là dạng đọc to câu tiếng Anh mẫu. Admin nhập mẫu một lần và hệ thống đồng bộ
  đáp án chuẩn. Nút nghe mẫu phát `audio_url` nếu có hoặc gọi `/api/speech/synthesize`.
- `alignWords` so từ khớp theo thứ tự. Câu trên 3 từ cần đạt ít nhất 80%. Câu tối đa
  3 từ cần khớp 100%. Web gửi transcript vào `/check` rồi dùng cùng chuỗi khi nộp `/complete`.
- Nếu nhận `NO_SPEECH`, giao diện yêu cầu thu lại ngay, không gọi `/check` và không trừ tim.
  **Hiện không nói được (15 phút)** chuyển các câu Nói sang nghe và gõ. Mốc
  `speakingMutedUntil` trong localStorage áp dụng qua các câu và bài. Khi đồng hồ đếm
  ngược về 0 hoặc chọn **Tôi đã nói được**, mic xuất hiện trở lại. Mobile dùng ô gõ cho câu Nói.

Câu sai của các loại bài hiện có được ghi vào `learning_answer_attempts` và đưa vào hàng đợi
ôn tập (mục 5). Với `speaking`, ứng dụng chỉ lưu tiến độ hoàn thành bài học thông thường.
Bản thu, transcript, điểm từng lượt thu và dữ liệu nhịp nói không được ghi vào DB.

### Hoàn thành bài
`POST .../complete` (`completeLesson`):
1. Chấm lại đáp án của **mọi** câu. Nếu chưa đúng hết, trả `retry` và không ghi gì.
2. Nếu đúng hết, trong **một transaction** ghi: XP, RC, thưởng hoàn thành chặng (khi chặng xong),
   huy hiệu, streak và điểm đua tuần (`rpLesson = 10`).
   - Lần đầu: `lessonXp = 20`, `lessonRc = 15`.
   - Chơi lại: chỉ `lessonReplayXp = 10`, không nhận lại thưởng một lần.
   - Hoàn thành chặng: `stageRc = 40`, `stageXp = 40`, trả một lần cho mỗi chặng.

### 4.1 Lượt chơi trên web (`LessonPlayer.tsx`, `utils/lessonRun.ts`)
- Mỗi lượt có `LESSON_MAX_HEARTS = 3` tim.
- `advanceLessonRun`: đúng thì bỏ câu khỏi hàng đợi; sai thì xếp lại câu đó sau
  `LESSON_REQUEUE_GAP = 3` vị trí và tăng `attempt`, đồng thời mất một tim.
- Hết tim thì lượt kết thúc với `status: 'failed'`; hết câu thì `cleared`.

---

## 5. Ôn tập ngắt quãng (Review / SRS)

**Route**: `GET /api/review`, `POST /api/review/sync`, `POST /api/review/items`,
`POST /api/review/items/:itemId/answer`, `GET /api/analytics`.

### Đưa câu vào hàng đợi
- `POST /review/sync` (`syncHistoricalMistakes`) lấy tối đa **40** câu sai từ
  `learning_answer_attempts` và từ `match_answers` (từ vựng trong đấu trường), rồi thêm vào hàng đợi.
- Câu sai trong bài học và trong battle được đưa vào hàng đợi khi xảy ra. Lỗi ghi hàng đợi
  trong battle được ghi log và không làm hỏng trận đấu.
- Mỗi phiên ôn lấy tối đa `REVIEW_SESSION_LIMIT = 7` thẻ.

### Trả lời một thẻ
`POST /review/items/:itemId/answer` (`review.service`):
1. Chấm bằng `isReviewAnswerCorrect(expected, submitted)`:
   - chuẩn hóa (bỏ dấu, hạ chữ thường), khớp đúng thì đạt;
   - từ ≤ 4 ký tự phải khớp chính xác;
   - từ dài ≥ 10 ký tự cho phép sai 2 ký tự (Damerau–Levenshtein), các độ dài khác sai 1.
2. Xếp loại bằng `gradeAnswer(isCorrect, responseMs)`:
   - sai → `again`;
   - đúng trong ≤ 4 giây → `easy`;
   - đúng nhưng > 12 giây → `hard`;
   - còn lại → `good`.
3. Cập nhật lịch theo biến thể **SM-2 xác định** (không ngẫu nhiên, để test và trình duyệt cho kết quả giống nhau):
   - hệ số dễ (`ease`) khởi tạo 2.5, kẹp trong khoảng 1.3–3.0;
   - sai → quay lại sau `LAPSE_MINUTES = 10` phút;
   - đúng → khoảng cách tăng theo `ease`.
4. Trả `is_correct`, `correct_answer`, `explanation`, `grade`, `next_due_at`,
   `interval_days`, `repetitions`, `ease`. `responseMs` bị kẹp tối đa 10 phút.

`GET /api/analytics` tổng hợp kết quả học tập.

---

## 6. Đấu trường từ vựng thời gian thực (Battle)

**REST**: `GET /api/battle/summary`. **Socket.IO** (`modules/battle/battle.socket.ts`): phần đấu chạy qua socket.

### Ghép trận
1. Client kết nối socket kèm JWT; server xác thực và gán `userId`.
2. Client gửi `match:join`. Nếu đã trong hàng chờ, server trả `ALREADY_QUEUED`; nếu đang trong trận, trả `ALREADY_IN_MATCH`.
3. Nếu đang có người chờ, server ghép cặp theo thứ tự đến trước và phát `match:found`.
   Nếu không, người chơi nằm chờ.
4. Bộ từ lấy từ `battle_words` (quản lý ở admin). Mỗi trận có khoảng **70% từ dễ** (A1–B1)
   và **30% từ khó** (B2–C2) (`BATTLE_EASY_SHARE = 0.7`).

### Diễn biến một trận
- **8 vòng** (`BATTLE_ROUNDS`), mỗi vòng **25 giây** (`BATTLE_ROUND_MS`).
- Server phát `game:question`. Đáp án không được gửi trước.
- Cứ mỗi **5 giây** (`BATTLE_HINT_STEP_MS`), tối đa 4 bước, server phát `game:hint`
  mở dần các chữ cái của đáp án.
- Client gửi `game:answer`. Đáp án được chuẩn hóa rồi so khớp. **Người trả lời đúng
  đầu tiên thắng vòng**; trạng thái `resolving` ngăn hai đáp án đúng cùng được tính.
  Hết giờ mà không ai đúng thì vòng không có người thắng.
- Sau khi có kết quả, server ghi `match_answers`, phát `game:answerResult` và
  `game:roundEnd`, rồi chờ `BATTLE_REVEAL_MS = 3` giây trước vòng tiếp theo.
- Khi đối thủ đang gõ, client gửi `game:attempt` và đối thủ nhận `game:opponentAttempt`
  với nội dung đang nhập. Đối thủ mất kết nối thì phát `game:opponentAway`.

### Kết thúc và mất kết nối
- Sau vòng 8, server phát `game:finish` và ghi kết quả bằng `battleRepository.finishMatch`.
- Thưởng: thắng `duelWinRc = 20`, `duelWinXp = 15`, `rpDuelWin = 25`; thua `duelLossRc = 8`,
  `duelLossXp = 5`.
- Giới hạn `duelDailyCap = 5`: đếm mọi trận `duel_play` trong ngày (kể cả trận không hoàn tất);
  từ trận thứ 6 trở đi không cộng RC/XP/RP. Nhiệm vụ và mốc "đã chơi" vẫn được ghi nhận.
  Trận bị hủy giữa chừng (`rated = false`) không trả thưởng nào. Thẻ nhân đôi RC chỉ bị tiêu khi trận nằm trong hạn mức.
- Mất kết nối: người chơi có **10 giây** (`BATTLE_RECONNECT_GRACE_MS`) để kết nối lại.
  Sự kiện `game:resume` khôi phục trạng thái; nếu không khôi phục được thì trả `game:resumeFailed`.
- Lỗi lưu kết quả trả `PERSISTENCE_ERROR` và hủy trận (`server_error`).

---

## 7. Gamification: XP, RC, streak, ví và cửa hàng

**Route**: `GET /api/wallet`, `GET /api/shop`, `POST /api/shop/items/:itemId/purchase`,
`POST /api/shop/items/:itemId/equip`, `POST /api/shop/slots/:slot/unequip`,
`GET /api/rewards`, `POST /api/rewards/quests/:code/claim`, `GET /api/league`, `GET /api/badges/me`.

### Các loại điểm và cấp độ
- **XP** tích lũy vĩnh viễn và quyết định **cấp độ**. Cấp độ không lưu trong DB mà tính từ
  `users.xp` theo `LEVEL_THRESHOLDS = [0, 60, 160, 320, 540, 820, 1160, 1560, 2020, 2540]`
  (tối đa cấp 10), qua `levelForXp` và `levelProgress`.
- **RC** (`users.coins`) là tiền tiêu được, dùng để mua vật phẩm.
- **RP** (Race Points) là điểm đua tuần, lưu trong `season_standings`.
- Mọi khoản cộng đi qua `grantInTx`, ghi vào `economy_ledger` với `INSERT IGNORE` theo khóa
  nguồn nên một thưởng không bị nhận hai lần khi gọi lại.
- **Thẻ x2 XP** (booster) được áp dụng ngay trong `grantInTx`, tại một chỗ duy nhất.

### Streak
- `touchStreakInTx` ghi nhận hoạt động trong ngày và tăng streak.
- `ensureStreakState` xử lý khi người học quay lại sau nhiều ngày: mỗi ngày bỏ lỡ tiêu **một
  lá chắn** (`streak_shield`). Không đủ lá chắn thì streak về 0, giá trị cũ được lưu vào
  `streak_lost` để hiển thị.

### Nhiệm vụ và điểm đua
- `GET /api/rewards` trả nhiệm vụ ngày và tuần (`questProgress`) cùng streak.
  `POST .../quests/:code/claim` nhận thưởng khi đã đủ tiến độ.
- RP tích lũy từ hoạt động: bài học `rpLesson = 10`, video `rpVideo = 8`, thắng đấu
  `rpDuelWin = 25`. Các hằng `rpQuest` và `rpDailyLogin` đã khai báo nhưng hiện chưa được dùng.

### Mùa giải và giải đấu (league)
- Mỗi **tuần ISO** là một mùa. `ensureCurrentSeason` tạo mùa mới khi có người đọc bảng xếp hạng.
- Có 6 hạng theo thứ tự: `coal → copper → iron → gold → redstone → diamond`.
  Người học được xếp hạng với những người cùng hạng hiện tại theo RP.
- Khi mùa kết thúc (`settleSeason`, idempotent):
  - mỗi hạng xếp hạng riêng. Top 3 (`LEAGUE_PROMOTION_SLOTS = 3`) lên một bậc; ba người cuối
    (`LEAGUE_DEMOTION_SLOTS = 3`) xuống một bậc. Coal không xuống, diamond không lên, và người
    đứng đầu hạng không bị xuống;
  - thưởng RC = `PAYOUT_RC` theo hạng (coal 60, copper 110, iron 170, gold 250, redstone 330,
    diamond 520) cộng thưởng thứ hạng (top 1 +100, top 2 +60, top 3 +30); XP = `PAYOUT_XP`
    (coal 15 … diamond 130). Ghi qua sổ cái để không nhận trùng;
  - cập nhật `users.league_tier`.

### Huy hiệu
`awardEligibleBadges` cấp `first_lesson` (≥1 bài), `lessons_10` (≥10 bài), `xp_100` (≥100 XP),
`xp_500` (≥500 XP). Gọi khi hoàn thành bài học và video (`learning.repository`,
`video.repository`). Route `GET /api/badges/me` trả huy hiệu đã có.

### Cửa hàng
1. `GET /api/shop` trả danh mục `shop_items` đang bật, cùng số dư và cấp độ hiện tại.
2. `POST .../purchase` (`purchaseItem`, transaction có khóa hàng `FOR UPDATE`):
   - **Cosmetic**: kiểm tra điều kiện mở khóa (`unlock_type`/`unlock_value`), trừ RC, ghi vào
     `user_inventory` (sở hữu vĩnh viễn). Vật phẩm bị khóa trả `ITEM_LOCKED` (403),
     thiếu RC trả `INSUFFICIENT_COINS` (422).
   - **Booster** (`BOOSTER_SPECS`): lưu dưới dạng số lượt còn lại hoặc thời hạn. Streak shield và
     RC x2 cấp 1 lượt; XP x2 có thời hạn 30 phút; gói starter gồm 3 streak shield và 1 thẻ XP x2.
3. `POST .../equip` gắn cosmetic vào slot; `POST /shop/slots/:slot/unequip` gỡ ra.

---

## 8. En Buddy — trợ lý AI và gợi ý

**Route**: `/api/buddy/*` (Buddy), `/api/ai/*` (chat và kế hoạch học). Đều cần đăng nhập.

### Gợi ý tự động (không dùng AI)
`GET /api/buddy/nudges` gọi `buildNudges`, một bộ quy tắc dựa trên tiến độ, lỗi sai và các
mục đến hạn ôn tập. Không gọi model nên luôn nhanh.

### Lời nhắc học
- `POST /api/buddy/reminder-suggestion` (`acceptSuggestion`) nhận gợi ý người dùng chấp nhận,
  rồi `createFromSuggestion` tạo bản ghi nhắc học và trả `201`.
- Module `reminders` quản lý trực tiếp: `GET /api/reminders`, `POST /api/reminders`,
  `POST /api/reminders/:reminderId/acknowledge`, `DELETE /api/reminders/:reminderId`.

### Hỏi đáp: `POST /api/buddy/ask`
`aiService.askBuddy` nhận lệnh tiếng Việt hoặc tiếng Anh. Lệnh rõ ràng được xử lý bằng
quy tắc và dữ liệu thật trước khi đến pipeline AI (mục 8.1). Buddy trả lời theo ngôn ngữ
của tin nhắn, mặc định là tiếng Việt.

- Hồ sơ, ví và giải đấu tuần dùng số liệu của người học.
- “Bài N” mặc định tra trong chặng có bài đang mở tiếp theo. Nếu chặng đó thiếu bài N,
  Buddy hỏi lại. Với bài khóa, Buddy khoanh vị trí và báo bài cần bắt đầu cùng số bài còn thiếu.
- Video ngẫu nhiên ưu tiên video chưa hoàn thành trong thư viện đã xuất bản. Lệnh mở video
  đưa người học vào màn luyện nghe.
- Với vật phẩm, Buddy mở Gara, khoanh thẻ và báo điều kiện mở khóa hoặc số RC còn thiếu.
  Người học tự chọn nút mua trên thẻ.

`parseBuddyCommand` nhận diện lệnh rõ ràng trước pipeline AI. Nội dung và đích được giải từ
snapshot dữ liệu thật (`buildBuddySnapshot`), gồm tiến độ, catalog video đã xuất bản, ví,
Gara và giải đấu. Action `open_lesson` có `mode: 'open' | 'reveal'`. `open` vào bài,
còn `reveal` chỉ khoanh vùng, kể cả khi bài khóa. `show_shop_item` mở Gara và khoanh
đúng vật phẩm. `spotlight` khoanh các vùng hồ sơ, số dư và hạng tuần.

### 8.1 Chat AI (`/api/ai/chats`)
- `POST /chats` tạo phiên; `GET /chats`, `GET /chats/:chatId`, `DELETE /chats/:chatId` quản lý phiên.
- `POST /chats/:chatId/messages` gửi tin nhắn và nhận lượt trả lời.
- `GET /chats/:chatId/feedback` trả phản hồi của phiên; `GET /study-plan` trả kế hoạch học
  (`buildStudyPlan`, dựa trên `pickNextLesson`).

Mỗi lượt của `ai.service` đi qua `ai.pipeline.ts`:

1. **Phân loại ý định** (`resolveTurnIntent`): chỉ khi ý định là `chat` chung mới gọi
   `classifyChatIntent`. Yêu cầu điều hướng, kế hoạch học… được xử lý theo quy tắc trong `ai.study.ts`
   (`resolveNavigationRequest`, `resolveChatAction`), không cần model.
2. **Sinh bản nháp** (`answerTurn` → `generateReply`): thử lần lượt **Token Harbor**
   (`TH_MODEL`, mặc định `deepseek-v4.1-flash-1017`), rồi **Gemini** (`AI_FALLBACK_MODEL`,
   mặc định `gemini-2.5-flash`). Llama đã bị bỏ khỏi chain sinh văn bản. Mỗi lần gọi có thời hạn riêng; một bước bị bỏ qua khi thời gian còn lại
   dưới `MIN_STEP_MS = 750` ms. Nếu lượt sinh bản nháp lỗi, có câu trả lời offline
   (`buildOfflineCoachReply`) thì dùng nó, không thì báo lỗi.
3. **Không kiểm duyệt, không sửa lại.** Bản nháp đầu tiên là câu trả lời. Các bước review
   (`reviewAnswer`) và sửa (`repairReply`) đã bỏ khỏi luồng chat để giảm độ trễ. Mỗi lượt chỉ có một
   lần sinh câu trả lời; chỉ khi provider lỗi mới chuyển sang provider dự phòng.

Ngân sách thời gian: `AI_TURN_BUDGET_MS` (mặc định 30 giây) cho toàn lượt, `AI_TIMEOUT_MS`
(mặc định 40 giây) cho một lần gọi; `COACH_TIMEOUT_MS = 25 giây`, `MAX_REPLY_TOKENS = 1500`. Lượt `chat` và `plan` (và kế hoạch học) dùng
`SHORT_REPLY_TOKENS = 700` và prompt yêu cầu dưới 400 ký tự, vì câu trả lời được đọc to.
Lịch sử đưa vào model là 10 tin nhắn gần nhất (`MAX_CONTEXT_MESSAGES = 10`). Khi tất cả provider lỗi, API trả 503
`The AI service is temporarily unavailable. Please try again later.`

Tài liệu chi tiết nhất về AI: [backend/src/modules/ai/README.md](backend/src/modules/ai/README.md).

---

## 9. Học nghe qua video (Video)

**Route**: `GET /api/demo/video` (công khai), `GET /api/videos`, `POST /api/videos/import`,
`GET /api/videos/:videoId`, `DELETE /api/videos/:videoId`, `POST /api/videos/:videoId/progress`,
`POST /api/videos/:videoId/complete`, `GET|POST /api/vocabulary`, `DELETE /api/vocabulary/:word`.

### Thư viện
`GET /api/videos` trả video chung do admin thêm và video cá nhân đã nhập. Mỗi video có các
**đoạn** (segments) gồm câu tiếng Anh và phụ đề.

### Video chung: nháp và xuất bản
Admin nhập video chung qua YouTube thì video luôn ở trạng thái **nháp** (`published_at` rỗng).
Học viên không thấy bản nháp (`assertVideoAccess` trả 404), chỉ admin thấy trong `/admin/videos`.
Quy trình:
1. Admin nhập link, hệ thống tạo nháp kèm các đoạn tự động.
2. Trong hộp thoại duyệt, admin sửa thời gian và nội dung từng đoạn (`GET|PUT /api/admin/videos/:videoId/segments`).
   Đoạn không được chồng nhau, mỗi đoạn tối đa 12 giây, nội dung không rỗng và tối đa 300 ký tự, và đoạn không kết thúc quá
   1 giây so với thời lượng video. Vi phạm thì báo lỗi; lưu là một transaction, không lưu một phần.
3. `POST /api/admin/videos/:videoId/publish` xuất bản để học viên thấy;
   `POST /api/admin/videos/:videoId/unpublish` gỡ về nháp. Nút xuất bản chỉ bật khi không còn thay đổi chưa lưu.

### Nhập video YouTube (`importVideo`)
1. `extractYouTubeId` kiểm tra đường dẫn. Sai thì `400 INVALID_YOUTUBE_URL`.
2. Đã có video này trong thư viện của người dùng thì `409 VIDEO_ALREADY_IMPORTED`.
3. Mỗi người tối đa **20** video nhập (`MAX_IMPORTS_PER_USER`), vượt thì `422 VIDEO_IMPORT_LIMIT`.
4. `fetchYouTubeImportSource` dùng `youtube-dl-exec` (yt-dlp) lấy tiêu đề, phụ đề tiếng Anh và thời lượng.
   Video từ `MAX_IMPORT_DURATION_SECONDS = 300` giây (5 phút) trở lên bị từ chối với `422 VIDEO_TOO_LONG`.
   Livestream bị từ chối với `422 VIDEO_LIVE`, video không có thời lượng cố định với `422 VIDEO_NO_DURATION`.
5. Phụ đề được chia thành đoạn (`video.segmentation.ts`), mỗi đoạn không vượt `MAX_SEGMENT_MS = 12 giây`
   (`video.youtube.ts`). Sau đó `refineSegmentsWithAi` gửi tối đa `MAX_AI_UNITS = 500` câu để tinh
   chỉnh ranh giới theo chuỗi Token Harbor → Gemini, với thời gian chờ tối đa `MAX_AI_TIMEOUT_MS = 45` giây.
   Lỗi AI thì dùng kết quả theo quy tắc.
6. Lưu video và đoạn. Trùng khóa thì trả `409`. Trả về chi tiết video (`getVideoDetail`).

### Tiến độ và hoàn thành
- `POST /videos/:id/progress` (`saveWatchProgress`) lưu số giây đã xem. Khi đạt
  `ceil(thời_lượng × 0.9)` (`VIDEO_COMPLETION_RATIO = 0.9`) và video chưa hoàn thành, server
  gọi `completeVideo`.
- `POST /videos/:id/complete` cũng hoàn thành video trực tiếp.
- `completeVideo` cộng `videoRc = 10` RC, XP lấy từ video và `rpVideo = 8` RP, rồi xét huy hiệu.
  Chỉ thưởng một lần, trong một transaction.

### Luyện nói theo đoạn trong `PracticeView`

Với mỗi segment có phụ đề tiếng Anh, người học có thể thu âm đọc lại và gửi tới
`POST /api/speech/practice` để xem từ đúng, thiếu, khác và nhịp nói. Đây là bước tùy chọn,
điều kiện hoàn thành video vẫn dựa trên luồng luyện hiện có. Bản demo ẩn điều khiển luyện nói.

### Tra và lưu từ vựng
- Bấm vào từ trong video để tra qua `lookupWordApi` (`web/src/services/translationService.ts`).
- `POST /api/vocabulary` lưu từ, `GET /api/vocabulary` hiển thị sổ từ (`VideoNotebookView`),
  `DELETE /api/vocabulary/:word` xóa.
- Admin gắn từ vựng riêng cho từng video qua `/api/admin/videos/:videoId/vocabulary`.

---

## 10. Giọng nói (Speech): nhận dạng và đọc

**Route**: `POST /api/speech/transcribe` (cần đăng nhập, giới hạn 20 lần/phút, nhận audio thô),
`POST /api/speech/synthesize` (cần đăng nhập, giới hạn 60 lần/phút, nhận `{ text, lang }`, trả MP3),
`GET /api/speech/status`.

**Đọc (TTS)**: backend dùng thư viện `msedge-tts` để gọi giọng Microsoft Neural của dịch vụ đọc
của Edge, không cần API key. Giọng: `en-US-AriaNeural` (Anh) và `vi-VN-HoaiMyNeural` (Việt).
Văn bản được loại ký tự điều khiển không hợp lệ trong XML và escape `& < > " '` trước khi gửi
(thư viện không tự làm). Mỗi yêu cầu tối đa 500 ký tự, vượt quá trả 400 `TEXT_TOO_LONG`;
cache clip trong bộ nhớ giới hạn 64 MB (xóa clip cũ nhất khi đầy).
Backend giữ tối đa một kết nối rảnh cho mỗi giọng trong 20 giây để đọc các câu
mới. Nếu kết nối dùng lại gặp lỗi, backend thử kết nối mới trong cùng thời hạn.
Các câu khác nhau đến đồng thời có thể dùng kết nối riêng. [Số đo API đọc](backend/src/modules/ai/README.md#voice-output-latency)
Bubble Bác Turbo hiện chữ ngay khi API trả lời. Bác Turbo, bài học và Sổ từ vựng
đều phát MP3 do Edge TTS tạo. Câu dài được chia thành các đoạn vừa giới hạn API.
Web tải trước một đoạn khi đoạn đang phát còn tối đa hai giây. Bấm Dừng sẽ huỷ
yêu cầu tải trước. Nếu tải trước lỗi, web tiếp tục luồng thử lại khi tới đoạn đó.
Khi Edge báo lỗi tạm thời, web thử lại một lần với cùng giọng.

Luồng ở web (`components/ai/VoiceOrb.tsx`, `services/speechService.ts`):
1. Khi mở, web gọi `GET /api/speech/status` để biết backend có sẵn sàng hay không.
2. Nếu backend sẵn sàng, web ghi âm tối đa 30 giây (`MAX_RECORD_MS`). Theo mặc định, bubble
   lấy token ngắn hạn từ `POST /api/buddy/voice/session` và gửi PCM qua WebSocket tới
   **AssemblyAI-STT-3.7-Realtime** trong lúc nói. AudioWorklet đổi tần số mic sang 16 kHz và
   gửi các khung 50 ms. Khi dừng mic, nếu phiên đã kết nối, bubble chờ tối đa 2,6 giây để
   ghép các đoạn chép lời đã chốt. Nếu streaming bị tắt bằng
   `BUDDY_STREAMING_STT=false` trong môi trường backend,
   không được trình duyệt hỗ trợ hoặc kết nối lỗi, web gửi clip ghi âm qua
   `POST /api/speech/transcribe` với nhận diện ngôn ngữ tự động. Cả hai endpoint yêu cầu
   đăng nhập và có giới hạn 20 lần/phút mỗi người dùng.
   Clip rỗng không được gửi đi. Nếu backend không sẵn sàng, web ẩn mic và chuyển sang ô nhập
   chữ; không còn fallback sang Web Speech API của trình duyệt.
   Benchmark dùng cùng một đoạn ghi âm để so sánh streaming và gửi clip.
   [Số đo từ lúc dừng mic đến lúc phát tiếng](backend/src/modules/ai/README.md#browser-recording-and-playback)
3. Với đường ghi âm, backend nhận audio thô (`Content-Type` là MIME của clip, chấp nhận webm, ogg, mp4, mpeg,
   wav, flac) và giới hạn `SPEECH_MAX_BYTES` (mặc định 4 MB). Thứ tự xử lý:
   - Thử **AssemblyAI** (`SPEECH_MODEL`, mặc định `assemblyai-stt-3-7`) qua REST: tải clip lên
     `/v2/upload`, gửi `/v2/transcript` với `speech_models`, rồi poll `/v2/transcript/{id}`
     (ngân sách chung `SPEECH_TIMEOUT_MS`, chu kỳ `SPEECH_POLL_INTERVAL_MS`). AssemblyAI nhận gợi ý
     ngôn ngữ (`language_code=vi|en`) hoặc tự nhận diện khi không có gợi ý. Model realtime
     `assemblyai-stt-3-7-realtime` chỉ chạy qua WebSocket, không dùng endpoint HTTP này.
   - AssemblyAI là provider nhận diện duy nhất của app. Lỗi provider trả 503/504 kèm lý do;
     không fallback sang provider khác.
   - Nếu bản chép lời dài quá 60 giây, trả 413. Kết quả bị cắt còn tối đa 500 ký tự.
   - Không có chữ thì trả 422 `NO_SPEECH`, web báo người dùng nói lại.
4. Web nhận transcript và gửi vào buddy (`sendRef` → `askBuddyApi`, cờ `spoken: true`).
   Lệnh điều hướng (ví dụ mở tab hoặc màn đánh giá) được `routeVoiceCommand` xử lý ngay trên
   máy. Các câu còn lại đi qua `POST /api/buddy/ask` như khi gõ chữ. Backend xử lý trực tiếp
   câu chào, lệnh điều hướng rõ ràng, câu hỏi số dư, mở video bất kỳ và nhắc giờ cụ thể.
5. Với câu nói, câu trả lời của buddy được đọc lại bằng giọng TTS, trừ khi người dùng tắt tiếng.

Để đo độ trễ của bubble, xem các mục `buddy.transcript-ready`, `buddy.answer-api`,
`buddy.text-ready` và `buddy.audio-ready` trong Performance Timeline của trình duyệt.
Backend ghi thời gian lấy ngữ cảnh, tạo phản hồi và lưu chat trong log `buddy_ask_timing`.

Biến cần đặt: `ASSEMBLYAI_API_KEY`, `SPEECH_MODEL` (mặc định `assemblyai-stt-3-7`),
`SPEECH_TIMEOUT_MS` (mặc định 40000), `SPEECH_POLL_INTERVAL_MS` (mặc định 500),
`SPEECH_MAX_BYTES` (mặc định 4 MB). `AI_API_KEY` vẫn dùng cho các tính năng văn bản, không
dùng cho nhận diện giọng nói nữa.

**Luyện nói v1.** `POST /api/speech/practice?text=<câu mẫu>` nhận audio thô, yêu cầu
đăng nhập và dùng cùng giới hạn 20 lần/phút với `/transcribe`. Phản hồi gồm `transcript`,
`completeness` (tỉ lệ 0–1), các từ `matched` / `missing` / `different` và `pacing`
(từ/phút và khoảng ngập ngừng). Backend lấy mốc thời gian từ `segments[].words` và đánh dấu
khoảng ngập ngừng từ `PAUSE_THRESHOLD_SECONDS = 0.7` giữa hai từ liên tiếp. Nếu provider
không có đủ mốc thời gian, `pacing` trả `null`. Người học bấm dừng mic thủ công.
Recorder giữ giới hạn tối đa 30 giây cho một bản thu. Kết quả chỉ hiển thị trong lượt luyện
và phần luyện nói được ẩn trong demo.

---

## 11. Dịch Anh–Việt (Translation)

**Route**: `GET /api/translations` (lịch sử), `DELETE /api/translations`,
`POST /api/translate` (văn bản), `POST /api/translate/file` (tệp, multipart).

### Dịch văn bản
1. Văn bản được chia khối; các khối được gửi song song tối đa `PROVIDER_CONCURRENCY = 4` lượt cùng lúc.
2. `requestWithModelFallback` thử lần lượt **Token Harbor** (`TH_MODEL`), rồi **Gemini**
   (`AI_FALLBACK_MODEL`, cần `AI_API_KEY`).
3. Kết quả được đọc từ JSON trả về và lưu vào lịch sử. Mỗi người giữ tối đa **10** bản dịch
   gần nhất (`trimTranslations`).

### Dịch tệp
`POST /translate/file` nhận tệp qua multipart (`parseMultipartFile` trong `translations.routes.ts`), đọc nội dung văn bản rồi
đi qua luồng dịch văn bản.

---

## 12. Xếp hạng (Ranking)

**Route**: `GET /api/ranking/` (cần đăng nhập). Trả về `RankingResponse`:

- `leaderboard`: bảng XP trọn đời (`ORDER BY xp DESC, id ASC`), kèm `current_user_rank`.
- `league`: bảng RP của **hạng giải hiện tại** của người gọi (`league_tier`), kèm
  `current_user_league_rank` và `league_rules` (số suất thăng và xuống hạng).

Mỗi dòng có `avatar`, `frame_style` và `nameplate_style` để hiển thị khung và thẻ tên cosmetic.

---

## 13. Quản trị (Admin)

**Giao diện**: `/admin`. **API**: `/api/admin/*`, mọi route qua `authenticate` và `requireAdmin`.

- **Thống kê**: `/stats/overview`, `/stats/content`, `/stats/lessons`, `/stats/trend`,
  `/stats/inactive-users`.
- **Nội dung học**: `/content` (cây nội dung), CRUD `/stages`, `/lessons`, `/questions`.
- **Video**: CRUD `/videos`, từ vựng `/videos/:videoId/vocabulary`, sửa từ `/video-vocabulary/:vocabularyId`.
- **Cửa hàng**: CRUD `/shop-items`.
- **Đấu trường**: CRUD `/battle-words`.
- **Người dùng**: `/users`.

---

## 14. Ứng dụng mobile

`mobile/app` dùng expo-router:
- `(auth)`: đăng nhập, đăng ký.
- `(tabs)`: **Lộ trình** (`index`), **Ranking**, **Học video** (`talk`), **Dịch** (`translate`),
  **Cài đặt** (`settings`).
- Màn riêng: `battle` (đấu trường qua socket), `lesson/[id]` (làm bài học).

Mobile gọi cùng API như web. Trạng thái đăng nhập nằm trong `contexts/auth-context.tsx`; token
lưu trong SecureStore, trên web là bộ nhớ tạm.

---

## 15. Cấu hình đăng nhập mạng xã hội

```env
GOOGLE_CLIENT_ID=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
```

Thiếu cấu hình thì endpoint đăng nhập tương ứng trả `503`.
