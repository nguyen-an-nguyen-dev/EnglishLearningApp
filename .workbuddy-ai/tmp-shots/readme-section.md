Thư viện video mặc định chỉ có 4 bài YouTube do user chọn, đã nạp sẵn trong `final.sql` kèm
**114 segment** phụ đề **một câu một đoạn**, cắt lại từ **caption gốc**. Nạp lại `final.sql` sẽ tạo
lại DB từ đầu, nên mọi tiến độ học video cũ cũng mất.

| Video | ID | Thời lượng | Dòng | Từ/dòng |
| --- | --- | --- | --- | --- |
| Small Talk \\| Everyday English | `ry9SYnV3svc` | 2:13 | 27 | 8 |
| Talking about a Trip using the Past Simple | `mngiqrT44Pk` | 1:15 | 21 | 6 |
| Coldplay – Viva La Vida | `dvgZkm1xWPE` | 4:02 | 40 | 7 |
| Avicii – The Nights | `UtF6Jej8yb4` | 3:11 | 26 | 10 |

### Tách câu: một câu là một đoạn

`buildSegmentsFromEnds()` trước đây gộp các câu đã tách lại cho tới khi đầy `MAX_SEGMENT_MS = 12s` /
`MAX_GROUP_CHARS = 200` ký tự. Với đối thoại ~20 từ/câu đó là **4–6 câu trong một dòng** (video du
lịch từng là *"How was your trip it was really fun how was the weather the weather was"* — 15 từ), và
vì caption gốc không có dấu câu nên đường dự phòng còn **cắt giữa câu**
(`…the weather was` | `Beautiful it was warm…`). Luật mới: **mỗi câu một đoạn**, chỉ gộp khi là mảnh
cảm thán ngắn (`FRAGMENT_MS = 1.8s` hoặc `< 3` từ); trần 12s/200 ký tự vẫn là chốt chặn, câu dài hơn
trần đứng riêng chứ không bị cắt vụn. `video.unit.test.ts` canh cả 3 nhánh.

Song song đó, ba lỗi trong đường AI làm việc tách câu thất bại âm thầm và rơi về đường theo kích
thước:

1. **Request thiếu JSON mode.** `requestSentenceEnds()` không gửi `response_format`, nên với
   transcript dài (131–208 cue) model trả `{sentence_ends:[…]}` **thiếu dấu nháy** và bị vứt bỏ.
   Đã thêm `response_format: { type: 'json_object' }` cho provider OpenAI-compatible (Gemini;
   `jsonMode: true` trong `providerFor`).
2. **Parser quá nghiêm.** `parseJsonContent()` giờ có thêm nhánh đọc danh sách số sau khoá
   `sentence_ends` kể cả khi khoá không được quote — `parseAiSentenceEnds()` vẫn kiểm tra tăng dần và
   phải chạm fragment cuối, nên không thể nhận dữ liệu rác.
3. **Provider thiếu key trả về im lặng.** `refineSegmentsWithAi()` `return fallbackSegments` không
   log gì khi `apiKey` rỗng, nên triệu chứng là "AI không trả lời" mà không có manh mối. Khi viết
   script bảo trì phải nạp `backend/.env` **trước** khi import module backend (xem đầu
   `reimport-captions.ts`); nếu không, `config/env` gọi `dotenv.config()` không path và đọc `.env`
   từ CWD.

### `yt-dlp` trong môi trường bị sandbox (sửa 07/11)

`yt-dlp.exe` là bản PyInstaller one-file: mỗi lần chạy nó tự giải nén ra một thư mục tạm. Dưới token
bị hạn chế (shell dev trong sandbox, vài image CI) bước giải nén **thất bại** với
`[PYI-…] Could not create temporary directory!` dù tiến trình khác vẫn ghi được vào `%TEMP%`; sau đó
file caption cũng không ghi được vào thư mục `engorace-yt-*` nằm trong `%TEMP%`
(`unable to open for writing: [Errno 13]`). `fetchYouTubeImportSource()` giờ thử lần lượt các
"scratch root": `TMPDIR` hệ thống trước, rồi `YTDLP_TEMP_DIR` (mặc định `<cwd>/.yt-dlp-tmp`, đã
gitignore). Mỗi lần thử đặt `TEMP`/`TMP`/`TMPDIR` cho tiến trình con và **đọc caption ngay trong thư
mục đó trước khi xoá**. Lỗi thuộc nhóm quyền/temp được retry; lỗi khác (video private, hết hạn mức…)
vẫn đi thẳng ra `mapYtDlpError()`.

### Nhập lại caption cho video đã có

`.workbuddy-ai/tmp-shots/reimport-captions.ts` — lấy lại caption gốc và tạo lại segment cho **đúng
các hàng `video_lessons` đang có** (không tạo bài trùng):

```bash
npx tsx .workbuddy-ai/tmp-shots/reimport-captions.ts                    # xem trước
npx tsx .workbuddy-ai/tmp-shots/reimport-captions.ts --write            # áp dụng, cả 4 bài
npx tsx .workbuddy-ai/tmp-shots/reimport-captions.ts --only=10 --model=bolt
```

Script **chỉ ghi khi kết quả tốt hơn thực sự** (`isImprovement`: ít dòng > 9 từ hơn, hoà thì xét
từ/dòng trung bình), nên chạy lại nhiều lần chỉ có thể cải thiện chứ không thể làm hỏng — mỗi lượt
gọi AI là một lần "tung xúc xắc" khác nhau và đã có lần video 12 tệ đi thật. Nó cũng bỏ qua khi AI
không trả lời (nhận biết bằng identity: `refineSegmentsWithAi` trả về **đúng mảng đầu vào** khi mọi
provider lỗi). Khi so chuỗi từ phải dùng đúng `stripPunctuation()` của pipeline, nếu không thì
`don't` → `dont` bị coi là mất chữ và script chặn nhầm cả 4 bài.

`aiCues`: `fetchYouTubeImportSource()` trả thêm trường này — cue mức **từng từ** cho AI, kể cả với
video nhạc. `cues` (mức dòng) vẫn dành cho đường dự phòng `segmentCaptionCues()` để không chẻ lời
bài hát thành từng từ. Nhờ vậy Viva La Vida đi từ 13 từ/dòng xuống 7.

Kết quả: 53 → 114 dòng. `final.sql` được vá riêng khối `video_segments` bằng
`.workbuddy-ai/tmp-shots/patch-final-sql-segments.cjs` (regenerate cả file sẽ kéo theo dữ liệu QA mà
dump cố tình không mang). Script cũ `resegment-videos.ts` (tách lại từ text **đã bị cắt sai**, mốc
thời gian chia theo độ dài từ) chỉ còn là phương án dự phòng khi `yt-dlp` không chạy được.