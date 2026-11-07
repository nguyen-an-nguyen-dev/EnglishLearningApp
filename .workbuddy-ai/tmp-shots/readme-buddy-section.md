### En Buddy — bạn học đồng hành (làm lại 07/11)

Trước đây En Buddy là **một drawer chat** (tab Chat / Kế hoạch / Lịch sử, cuộn thread, composer).
Mô hình đó bị thay hẳn vì nó hành xử như chatbot SaaS: phải gõ mới nói, mở đầu bằng câu chào, và
gợi ý thì chung chung ("cố lên nhé", "học mỗi ngày nhé"). Giao diện mới coi chú xe là **người ngồi
cạnh cùng học**, và ưu tiên *nói đúng việc* hơn là *nói nhiều*.

**Ba lớp, không có thread.**

1. **`GET /api/buddy/nudges` — nudge tính từ dữ liệu thật, không do model viết.**
   `buildNudges()` trong `buddy.service.ts` xếp hạng theo mức khẩn cấp và luôn kèm số liệu của chính
   người học:
   | kind | khi nào | ví dụ thật |
   | --- | --- | --- |
   | `reminder` | có nhắc đã tới giờ | "Ôn Sổ từ" (đứng đầu bảng) |
   | `streak` | có chuỗi nhưng hôm nay chưa học | "Chuỗi 7 ngày đang chờ hôm nay" |
   | `comeback` | ≥ 3 ngày không mở bài | "Đã 5 ngày không mở bài" |
   | `next-lesson` | còn bài chưa mở | "Còn 1 bài trong lộ trình. Bài này thuộc chủ đề Literature." + `highlight: lesson:36` |
   | `weak-topic` | ≥ 3 câu sai cùng chủ đề | "7 câu sai gần đây ở chủ đề này, nhiều hơn các chủ đề còn lại." |
   | `saved-words` | ≥ 5 từ đã lưu | "12 từ trong Sổ từ" |
   | `next-video` | còn video chưa nghe | "Đã xong 0/4 video trong thư viện." |
   | `arena` | chưa đấu trận nào và đã xong ≥ 3 bài | "Bạn đã xong 3 bài. Một vòng đấu 1v1 kiểm tra phản xạ từ nhanh hơn đọc lại." |
   Cùng endpoint trả `greeting` — **một câu duy nhất** chú xe nói: "Còn một bài nữa là giữ chuỗi 7
   ngày." / "3 ngày rồi chưa mở bài. Quay lại bằng một bài ngắn thôi." Không có câu chào nào.

2. **`POST /api/buddy/ask` — một câu hỏi, một câu trả lời.** Không thread, không bong bóng chat:
   web hiện **một thẻ trả lời** (`.buddy-answer`) kèm tối đa 3 chip hỏi tiếp. Lượt hỏi vẫn được lưu
   vào **một** chat `STUDY_COACH` duy nhất của người học (`ensureCoachChat()`), nên `GET /api/ai/chats`
   vẫn hoạt động và buddy còn nhớ đã hỏi gì.

3. **Nhắc học (`study_reminders`).** Bảng mới: `title`, `body`, `due_at`, `target_json`,
   `delivered_at`, `dismissed_at`. `due_at` do **server** quyết định từ `in_minutes` hoặc `at_time`
   ("HH:MM", giờ đã qua thì hiểu là ngày mai), nên model đọc sai đồng hồ cũng không hẹn được điều gì
   xa lạ. Người học vẫn phải bấm "Đặt nhắc" trên gợi ý (`POST /api/buddy/reminder-suggestion`) —
   model không tự đặt gì sau lưng họ. Web huỷ nhắc bằng `DELETE /api/reminders/:id`, và gọi
   `POST /api/reminders/:id/acknowledge` sau khi đã hiện, để một nhắc không bắn hai lần.

**Giọng điệu do prompt quyết định, không phải do may mắn.** `VOICE_GUIDE` trong
`ai.service.ts` cấm rõ: không chào hỏi, không "cố lên nhé / bạn làm tốt lắm / kiên trì sẽ thành
công", không khen chung chung, tối đa 3 câu, và **mỗi câu trả lời phải có ít nhất một chi tiết chỉ
đúng người này** (tên bài, con số, từ cụ thể, câu họ vừa viết) — không có dữ liệu thì phải hỏi một
câu ngắn thay vì nói chung chung. `buddy.unit.test.ts` và `buddy.test.ts` canh đúng điều đó: nudge
phải chứa số thật và không khớp regex câu động viên sáo rỗng.

**Trả lời offline cũng không sáo rỗng.** Khi cả hai provider lỗi, `buildOfflineCoachReply()` trả
đúng dữ liệu ("Việc tiếp theo: Học bài … (12 phút)…", "Chủ đề yếu nhất: Masterclass: 7 câu sai gần
đây."), không còn câu xin lỗi hay "hỏi lại mình tí nữa nhé" — `ai.test.ts` canh việc này.

**Nhắc học khi tab đóng thì không bắn được**, nên có hai lớp: `Notification` của trình duyệt (chỉ
khi người học bấm "Bật thông báo máy"; chỉ bắn lúc tab đang mở nhưng bị che) và thẻ nhắc trong app
(luôn đúng). Web poll `GET /api/buddy/nudges` mỗi 60s + mỗi lần tab quay lại foreground.

**Chỉ tay vào đúng chỗ (`highlight`).** Model trả một token khai báo trước, không trả CSS selector:
`lesson:<id>`, `video:<id>`, `word:<từ>`, `control:notebook`, `control:arena-start`. Các phần tử
thật gắn `data-buddy-target="..."` (`RouteMapCard`, `video-card`, nút Sổ từ, nút vào trận);
`useBuddySpotlight()` cuộn tới, khoanh sáng 4.2s rồi tự tắt. `parseBuddyTarget()` **vứt** mọi token
không khớp whitelist, nên model không thể bịa đích. Một nudge có `highlight` nghĩa là "để mình chỉ
chỗ" — web chỉ đổi tab và khoanh sáng, **không** ném người học vào bài ngay (chỉ mở LessonPlayer khi
target không có highlight).

**Nút chuyển hướng giờ là `target`, không còn `action.kind`.** `App.handleBuddyNavigate(target)` xử
lý một hình dạng duy nhất `{ tab, lessonId?, videoId?, highlight? }` cho cả nudge và câu trả lời AI.

Đã bỏ: tab Chat/Kế hoạch/Lịch sử, thread bong bóng, composer bar, `.buddy-launcher` cũ và ~700 dòng
CSS đi kèm. `buddy.css` viết lại theo đúng ngôn ngữ sổ tay + chú xe, một viền mỗi khối, cyan chỉ cho
hành động. QA: `.workbuddy-ai/tmp-shots/qa-buddy-companion.cjs` (1440 + 390: bubble cụ thể, panel
không tràn, CTA đổi tab **và** `spotlights: 1`, spotlight tự tắt, `answerCard: 1` mà
`answerThreadBubbles: 0`, đặt được nhắc). Các script `buddy-qa.cjs` / `buddy-flow-qa.cjs` /
`buddy-motion-qa.cjs` / `buddy-check.cjs` của drawer cũ **đã lỗi thời** — đừng dùng nữa.
