# AI Software Engineering Framework — Hướng dẫn sử dụng chi tiết cho người mới

> Đây là框架 (framework) vận hành AI độc lập lĩnh vực (domain-agnostic) giúp bạn đi từ
> **Lên kế hoạch → Triển khai (TDD) → Tạo Pull Request → Review** một cách có kỷ luật,
> kèm theo 3 công cụ nâng cao: **Observability (Langfuse)**, **Memory Tree**, và
> **Kho kỹ năng tự học (Voyager)**.

Tài liệu này dẫn bạn từng bước, từ lúc tải framework về đến khi chạy xong một task
thực tế. Nếu đã quen thuộc, bạn có thể nhảy đến [Mục 8](#8-quy-trình-làm-việc-thực-tế-từng-bước).

![AI Software Engineering Framework — Quy trình vận hành](image/Khung_quy_trinh_phan_mem_AI.png)

---

## 1. Framework này là gì và chạy ở đâu?

Framework không phải là một ứng dụng đóng gói sẵn. Nó là một **bộ tài liệu markdown +
script** mà một **AI Coding Agent** (như opencode, Claude Code, Cursor…) đọc để biết
cách làm việc. Khi bạn gõ một lệnh như `/create-plan FIN-1` trong khung chat của agent,
agent sẽ mở file `workflow/create-plan.md` và làm theo hướng dẫn bên trong.

Nhờ vậy mọi thứ đều minh bạch, có thể đọc/sửa bằng tay, và không khóa bạn vào một công cụ.

### Nguyên tắc cốt lõi (hãy nhớ)

- **Vòng đời cố định:** Plan → Implement → Deploy (tạo PR) → Review.
- **Một task tại một thời điểm:** AI chỉ làm đúng một `TASK_KEY`.
- **Chuỗi kế thừa dữ liệu:** bước sau đọc kết quả bước trước (`plan/` → `implement/` → `deploy/` → `review/`), không bắt đầu lại từ đầu.
- **TDD Gate bắt buộc:** code chỉ được tạo PR khi Unit test pass, typecheck pass, lint pass, refactor xong, và **mutation score ≥ 50**.
- **Con người luôn kiểm soát:** AI **không** tự merge, **không** deploy staging/production.

---

## 2. Yêu cầu trước khi bắt đầu (Prerequisites)

| Công cụ | Phiên bản | Dùng để |
|---|---|---|
| Git | bất kỳ | quản lý source, đồng bộ nhánh |
| Node.js | ≥ 18 | chạy tooling (`tooling/`) |
| npm | đi kèm Node | cài thư viện cho tooling |
| AI Coding Agent | opencode / Claude Code / Cursor | thực thi các workflow |
| Langfuse (tùy chọn) | tài khoản cloud hoặc self-host | xem trace/observability |

> Nếu không có Langfuse, framework vẫn chạy bình thường — trace sẽ lưu cục bộ.

---

## 3. Bước 1 — Khởi tạo dự án (Setup)

Framework cung cấp script tự động. Script sẽ copy `workflow/`, `skill/`, `template/`,
`doc/`, `tooling/`, `config/` vào dự án của bạn và tạo các thư mục rỗng `plan/`,
`implement/`, `deploy/`, `review/`.

### Trên Windows (PowerShell)

```powershell
# Tại thư mục chứa framework:
.\setup.ps1
```

### Trên Linux / macOS (Bash)

```bash
chmod +x setup.sh
./setup.sh
```

### Script sẽ hỏi bạn 3 thông tin

1. **Tên dự án & thư mục lưu trữ** — ví dụ `my-ecommerce-app`.
2. **Lĩnh vực (Domain)** — chọn `1` Fintech, `2` Healthcare, `3` E-commerce, `4` EdTech, `5` Custom.
   Script sẽ copy file an toàn tương ứng vào `skill/10-domain-safety.md`.
3. **Tech Stack** — nhập các số cách nhau bằng dấu phẩy, ví dụ `1,3,5` cho
   NestJS + React + Prisma. Script cài skill tương ứng vào `skill/`.

Sau khi xong, script tự động chạy `npm install` trong `tooling/` (cần Node đã cài).

---

## 4. Bước 2 — Thêm tài liệu dự án (BA / SA)

Agent cần hiểu nghiệp vụ và kiến trúc để planning đúng. Hãy thêm:

- **BA (Business Analysis)** → `doc/ba/` (tính năng, thuật ngữ, quy tắc kinh doanh).
- **SA (Solution Architecture)** → `doc/sa/` (thiết kế API, DB, bảo mật).
- **Tài liệu riêng từng task** → `doc/dev/<TASK_KEY>/`.

Sau đó mở `DOC_MAP.md` và cập nhật các đường dẫn cho khớp với dự án thật của bạn
(file này là "bản đồ" giúp agent biết đọc tài liệu nào, khi nào).

> Mẹo: Đừng đổ mọi thứ vào BA/SA. Chỉ thêm những gì task cần. Agent tuân theo
> "Stop Rule" — đủ context là dừng, không đọc tạp nạp.

---

## 5. Bước 3 — Cấu hình quy tắc an toàn (Domain Safety)

Mở `skill/10-domain-safety.md` (đã được script tạo từ template hoặc ví dụ Fintech)
và điền các quy tắc đặc thù: hành vi cấm (ví dụ: double-charge, leak PII), yêu cầu
test bắt buộc, và ràng buộc tuân thủ (PCI-DSS, HIPAA, GDPR…). Agent sẽ đọc file này
trong mọi task liên quan đến bảo mật.

---

## 6. Bước 4 (TÙY CHỌN — không bắt buộc) — Bật Observability với Langfuse

> **Bước này hoàn toàn tùy chọn.** Bạn có thể bỏ qua và framework vẫn chạy bình
> thường. Nếu không cấu hình Langfuse, mọi trace sẽ tự động lưu cục bộ tại
> `tooling/.traces/traces.jsonl` và bạn vẫn xem được báo cáo bằng
> `node tooling/src/trace.js cost --task <KEY>`. Chỉ thực hiện bước này khi bạn
> muốn **nhìn thấy từng bước AI chạy** trên giao diện Langfuse (token, chi phí,
> bước nào chậm, truy vết lỗi). Bạn cần tài khoản Langfuse (cloud hoặc self-host).

1. Copy file mẫu:
   ```bash
   cp config/.env.example config/.env
   ```
2. Mở `config/.env` và điền:
   ```text
   LANGFUSE_ENABLED=true
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_SECRET_KEY=sk-lf-...
   LANGFUSE_BASEURL=https://cloud.langfuse.com   # hoặc https://jp.cloud.langfuse.com
   LANGFUSE_USER_ID=developer
   ```
3. Xong. Từ giờ mỗi workflow tự động gửi trace. Mở Langfuse UI để xem
   **Sessions** (nhóm theo `TASK_KEY`), **Traces**, và **Generations** (các bước LLM
   có model + token + cost).

Nếu chưa cấu hình, trace vẫn lưu cục bộ tại `tooling/.traces/traces.jsonl` và bạn
dùng `node tooling/src/trace.js cost --task <KEY>` để xem báo cáo.

---

## 7. Bước 5 (Khuyên dùng) — Xây dựng Memory Tree

Thay vì agent đọc lại toàn bộ BA/SA mỗi lần (cold start), Memory Tree nén dự án
thành các mảnh nhỏ (chunk ≤ 3000 token) trong SQLite và "nhớ" ngay khi cần.

```bash
node tooling/src/memory.js index     # quét doc/, plan/, deploy/, review/, skill/
node tooling/src/memory.js recall --query "auth login" --task FIN-1
node tooling/src/memory.js stats
```

Chạy `index` lại mỗi khi bạn thay đổi nhiều tài liệu hoặc sau mỗi lần `/deploy`,
`/review-code` (các workflow đã tự làm mới store cho bạn).

---

## 8. Quy trình làm việc thực tế từng bước

Giả sử bạn có một task Jira `FIN-1` ("Thêm endpoint đăng nhập". Bạn sẽ chạy theo
thứ tự sau. Mỗi lệnh gõ trong khung chat của agent (ví dụ opencode).

### 8.1. `/create-plan FIN-1` — Lên kế hoạch

Agent sẽ:
1. Đọc yêu cầu (Jira / tài liệu BA-SA / mô tả trực tiếp).
2. Gọi Memory Tree (`recall`) để lấy context nhanh, rồi mở rộng theo `DOC_MAP.md`.
3. Tạo `plan/FIN-1.md` (kế hoạch chi tiết, có các bước test-first).
4. Tạo `doc/dev/FIN-1/manual-test.md` (hướng dẫn test thủ công / demo).
5. Tạo `doc/dev/FIN-1/vibo.md` (tóm tắt task).
6. Chuyển Jira: `Backlog → To Do`.

✅ **Kết thúc:** bạn đọc `plan/FIN-1.md`, sửa nếu cần, rồi qua bước triển khai.

### 8.2. `/implement-plan FIN-1` — Triển khai (bắt buộc TDD)

Agent viết code theo chu trình **Red → Green → Refactor → Critic**:

| Phase | Agent làm gì | Bạn cần biết |
|---|---|---|
| **RED** | Viết test fail trước, chạy, xác nhận FAIL | Nếu test đã pass không cần code → test sai, agent sửa test |
| **GREEN** | Viết code tối thiểu để test pass, chạy, xác nhận PASS | Agent **không** sửa test để ép pass |
| **REFACTOR** | Gọn hóa code, test vẫn xanh | Bắt buộc, không bỏ qua |
| **CRITIC** | Tự review (mutation testing Stryker, review chất lượng test) | Nếu mutation score < 50 sẽ bị chặn |
| **OUTPUT** | In báo cáo test (số test, coverage) | Agent không được "đoán" kết quả |

Agent cũng tự động: bắt đầu trace Langfuse, ghi span từng phase, chuyển Jira
`To Do → In Progress → Dev Review`, cập nhật `manual-test.md`.

✅ **Thành công:** không tạo file lỗi, kết quả trả về chat. Có thể qua bước Deploy.
Nếu task sinh ra pattern hay, agent **đề xuất** skill vào `skill/pending/` (xem Mục 10).

### 8.3. Khi implement lỗi — `/implement-plan-fix-error FIN-1`

Nếu code bị block (test fail sau 3 lần + Attempt 4 Integration Reset vẫn fail),
agent tạo `implement/FIN-1-error.md` (có trường `Langfuse Trace:` để bạn bấm vào xem
trace lỗi). Chạy lệnh này để agent điều tra nguyên nhân và đề xuất kế hoạch sửa
`plan/FIN-1-new.md`.

Sau đó duyệt kế hoạch mới:

```text
/implement-plan-accept-fix FIN-1   # backup plan cũ, promote plan mới
/implement-plan FIN-1              # chạy lại
```

### 8.4. `/deploy FIN-1` — Tạo Pull Request

Agent sẽ:
1. Chạy **TDD Gate** (unit test, `tsc --noEmit`, lint, mutation ≥ 50).
2. Nếu pass: commit, push nhánh `feature/FIN-1`, tạo PR vào `devs`.
3. Chuyển Jira `Review Code`.
4. Làm mới Memory Tree.

🚫 **Bị chặn nếu:** test fail / typecheck lỗi / lint chưa pass / mutation < 50 →
ghi `deploy/FIN-1-error.md`, không tạo PR. Agent **không** merge, **không** deploy.
(Merge và deploy staging/prod do bạn làm thủ công.)

### 8.5. `/review-code FIN-1` — Đánh giá PR

Agent đọc PR diff + `deploy/FIN-1-history.md`, soi kỹ:
- Có khớp kế hoạch không?
- Có vi phạm `skill/10-domain-safety.md` không?
- Test có đủ không?

Nếu phát hiện lỗi **Critical / High** → chặn Approve, ghi `review/FIN-1-error.md`.
Nếu ổn → `READY TO PROD`.

### 8.6. Khi review bắt sửa — `/review-code-fix-plan FIN-1`

Tạo `plan/FIN-1-new.md`, rồi lại `/implement-plan-accept-fix` + `/implement-plan`.

### 8.7. `/task-status FIN-1` — Xem trạng thái & gợi ý lệnh

Agent đọc các artifact, báo bạn đang ở bước nào và **lệnh tiếp theo nên chạy gì**.
Rất hữu ích khi bạn quên tiến độ.

### 8.8. `/optimize-architecture <SCOPE>` — Tối ưu kiến trúc (chỉ đọc)

VD: `/optimize-architecture all` hoặc `/optimize-architecture module:payment`.
Agent phân tích (không sửa code) và trả báo cáo đề xuất.

---

## 9. Tổng hợp các lệnh

| Lệnh | Chức năng | Tiếp theo |
|---|---|---|
| `/create-plan <KEY>` | Tạo kế hoạch + manual-test + vibo | `/implement-plan` |
| `/implement-plan <KEY>` | Viết code theo TDD | `/deploy` hoặc `/implement-plan-fix-error` |
| `/implement-plan-fix-error <KEY>` | Đề xuất plan sửa lỗi | `/implement-plan-accept-fix` |
| `/implement-plan-accept-fix <KEY>` | Duyệt plan sửa | `/implement-plan` |
| `/deploy <KEY>` | TDD Gate → commit → push → tạo PR | `/review-code` |
| `/review-code <KEY>` | Review PR (không sửa code) | `/review-code-fix-plan` hoặc Done |
| `/review-code-fix-plan <KEY>` | Plan sửa từ review | `/implement-plan-accept-fix` |
| `/review-pr <PR_URL>` | Review trực tiếp 1 PR GitHub | — |
| `/task-status <KEY>` | Trạng thái & gợi ý lệnh | — |
| `/optimize-architecture <SCOPE>` | Phân tích kiến trúc | — |
| `/harvest-skill <KEY>` | Đề xuất kỹ năng vào `skill/pending/` | `/approve-skill` |
| `/approve-skill <file>` | Duyệt kỹ năng vào `skill/` | dùng lại ở task sau |

---

## 10. Kho kỹ năng tự học (Voyager, hybrid)

Khi một task xong và có pattern đáng tái sử dụng, agent định đề xuất kỹ năng.
Cơ chế **tự động chặn** nếu TDD Gate fail hoặc mutation < 50, nên chỉ code tốt mới
được đề xuất vào `skill/pending/`. Con người quyết định cuối cùng.

Quy trình:
1. Agent viết draft và chạy (bên trong `/implement-plan`):
   ```bash
   node tooling/src/skill-curator.js propose \
     --task FIN-1 --gate pass --mutation-score 78 \
     --file draft.md --name nestjs-idempotency-guard \
     --title "Idempotency guard" --tags "nestjs,idempotency" \
     --triggers "idempotency, retry"
   ```
2. Bạn xem xét file `skill/pending/16-nestjs-idempotency-guard.md`.
3. Duyệt (hoặc từ chối):
   ```bash
   node tooling/src/skill-curator.js list
   node tooling/src/skill-curator.js approve --name 16-nestjs-idempotency-guard.md
   # hoặc: node tooling/src/skill-curator.js reject --name 16-...md
   ```
4. Sau khi approve, kỹ năng nằm ở `skill/` và được agent tự động dùng lại cho task sau.

---

## 11. Công cụ CLI (tooling/) — tham khảo nhanh

| Việc | Lệnh |
|---|---|
| Bắt đầu trace | `node tooling/src/trace.js start --workflow implement-plan --task FIN-1` |
| Ghi span (LLM step) | `node tooling/src/trace.js span --trace <id> --phase red --status ok --model gpt-4o --tokens-in 1200 --tokens-out 300 --ms 8400` |
| Ghi span (tool step) | `node tooling/src/trace.js span --trace <id> --phase commit --status ok --ms 1200` |
| Kết thúc trace | `node tooling/src/trace.js end --trace <id> --status ok` |
| Báo cáo chi phí/bottleneck | `node tooling/src/trace.js cost --task FIN-1` |
| Xây dựng memory | `node tooling/src/memory.js index` |
| Truy xuất memory | `node tooling/src/memory.js recall --query "auth login" --task FIN-1` |
| Thống kê memory | `node tooling/src/memory.js stats` |
| Đề xuất kỹ năng | `node tooling/src/skill-curator.js propose ...` (xem Mục 10) |
| Duyệt/từ chối kỹ năng | `node tooling/src/skill-curator.js approve|reject --name <file>` |

> Các lệnh trace/memory/skill đã được agent **tự động gọi bên trong workflow**,
> bạn thường không cần gõ thủ công trừ khi debug.

---

## 12. Cấu trúc thư mục (sau khi setup)

```text
<project>/
├── doc/
│   ├── ba/            # Tài liệu nghiệp vụ
│   ├── sa/            # Kiến trúc hệ thống
│   └── dev/<TASK_KEY>/# Tài liệu riêng task (README, vibo, manual-test…)
├── skill/            # Chuẩn code + kỹ năng công nghệ + an toàn domain
│   ├── langfuse/      # Kỹ năng Langfuse (tracing/prompt/eval)
│   ├── pending/       # Kỹ năng chờ duyệt (Voyager queue)
│   └── HARVESTED.md   # Chỉ mục kỹ năng đã duyệt
├── workflow/         # Các file lệnh (create-plan.md, implement-plan.md…)
├── template/         # Mẫu output (error, history, plan…)
├── tooling/          # Node.js helpers (trace/memory/skill-curator)
├── config/           # .env (Langfuse) + memory.md
├── plan/             # Kế hoạch do AI tạo
├── implement/        # File lỗi khi code
├── deploy/           # Lịch sử PR / lỗi deploy
├── review/           # Báo cáo lỗi review
├── memory/           # SQLite Memory Tree (memory.db, gitignored)
├── DOC_MAP.md        # Bản đồ định tuyến tài liệu
├── GUIDE.md          # Hướng dẫn chi tiết
└── README.md         # (file này)
```

---

## 13. Giới hạn & nguyên tắc cần nhớ

1. **Tuân thủ TDD:** không sửa test để ép pass; test fail → sửa code.
2. **Fallback Limit:** test fail, agent sửa tối đa 3 lần; lần 4 thử Integration Reset;
   vẫn fail → dừng, báo `implement/<KEY>-error.md` (không lặp vô hạn).
3. **Giới hạn tự động hóa:** agent **không** deploy staging/prod, **không** merge.
4. **Luôn chạy test thực tế:** agent phải chạy `npm test`, `tsc --noEmit` và đọc log;
   nghiêm cấm "đoán" kết quả.
5. **Không leak secret:** trace tự động che giấu mọi trường chứa `key/secret/token/…`.

---

## 14. Xử lý sự cố (Troubleshooting)

| Triệu chứng | Nguyên nhân & cách sửa |
|---|---|
| `npm install` báo lỗi / `ai-trace` không chạy | Chưa cài Node ≥ 18 hoặc chưa `npm install` trong `tooling/`. Chạy lại. |
| Langfuse trống dù đã bật | Kiểm tra `config/.env`: `LANGFUSE_ENABLED=true`, key đúng, `LANGFUSE_BASEURL` trỏ đúng (ví dụ `https://jp.cloud.langfuse.com`). Agent cần **có mạng** tới host đó. |
| Trace không hiện trên Langfuse | Trace gửi bất đồng bộ; đợi vài giây. Nếu vẫn không, xem `tooling/.traces/traces.jsonl` (local fallback) và log mạng. |
| `mutation score < 50` block deploy | Test yếu. Xem "surviving mutants", thêm test cases, chạy lại. |
| Memory trả kết quả sai/sớm | Chạy `node tooling/src/memory.js index` để làm mới; kiểm tra `config/memory.md` (nguồn quét). |
| Agent đọc sai tài liệu | Cập nhật đường dẫn trong `DOC_MAP.md`; tuân thủ Stop Rule. |

---

## 15. Lộ trình mở rộng (tùy chọn)

- **Desktop (Tauri + Rust):** thiết kế giao diện quản lý task nhẹ, xem trace, duyệt
  Memory Tree và hàng đợi kỹ năng — xem `doc/sa/11-agent-desktop-architecture.md`
  (hiện chỉ là tài liệu thiết kế, chưa có code).
- **OTel:** có thể xuất trace qua OpenTelemetry collector thay vì Langfuse SDK.

---

> **Lưu ý:** Framework là domain-agnostic. Khi setup dự án mới, quan trọng nhất là
> cập nhật `DOC_MAP.md` với đường dẫn BA/SA thật và tùy chỉnh
> `skill/10-domain-safety.md` với quy tắc an toàn của bạn.
