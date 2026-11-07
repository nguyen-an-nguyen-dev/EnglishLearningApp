/**
 * Rebuild web/src/components/ai/buddyContext.ts from the committed StudyBuddy:
 * the per-screen DOM reader is large and screen-by-screen tuned, so it is lifted
 * verbatim instead of retyped, then two overlay checks are prepended (settings
 * and the auth dialog sit on top of any tab).
 */
const fs = require('fs')

const SRC = '.workbuddy-ai/tmp-shots/StudyBuddy.head.tsx'
const lines = fs.readFileSync(SRC, 'utf8').replace(/\r/g, '').split('\n')

const start = lines.findIndex((line) => line.startsWith('export function detectLivePageContext'))
if (start === -1) throw new Error('detectLivePageContext not found')

let end = -1
for (let index = start + 1; index < lines.length; index += 1) {
  if (lines[index] === '}') { end = index; break }
}
if (end === -1) throw new Error('function end not found')

const fn = lines.slice(start, end + 1).join('\n')

// The overlays win over whichever tab is underneath.
const overlay = `  try {
    if (document.querySelector('.settings-panel')) {
      return {
        focus: 'Cài đặt',
        badge: 'Cài đặt',
        detail: 'Người dùng đang mở bảng Cài đặt: đổi giao diện sáng/tối, ngôn ngữ, thông tin tài khoản và đăng xuất.',
      }
    }
    if (document.querySelector('.auth-dialog')) {
      const authTab = document.querySelector('.auth-tabs .is-active, .auth-tabs [aria-selected="true"]')?.textContent?.trim() || 'Đăng nhập'
      return {
        focus: \`Tài khoản · \${authTab}\`,
        badge: 'Đăng nhập / Đăng ký',
        detail: \`Người dùng đang mở hộp thoại xác thực tài khoản (\${authTab}); ứng dụng yêu cầu đăng nhập để lưu tiến độ học.\`,
      }
    }
`
const patched = fn.replace('  try {\n', overlay)

const out = `import type { ChatTab } from '../../services/aiChatService'

export interface BuddyContext {
  tab: ChatTab
  focus?: string
  detail?: string
}

/**
 * Reads the live DOM to work out what the learner is actually looking at.
 * Returned strings are treated as untrusted data by the backend prompt.
 */
${patched}
`
fs.writeFileSync('web/src/components/ai/buddyContext.ts', out)
console.log('wrote buddyContext.ts:', out.split('\n').length, 'lines')
console.log('has overlays:', out.includes('settings-panel'))
console.log('has 7 sections:', ['1. Video', '3. Study', '7. Profile'].every((s) => out.includes(s)))
