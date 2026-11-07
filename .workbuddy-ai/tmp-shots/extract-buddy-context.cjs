/**
 * Pull `detectLivePageContext` and the ChatTab type out of the previous
 * StudyBuddy implementation so the new companion keeps exactly the same DOM
 * reading logic (it was tuned screen by screen and has its own QA).
 */
const fs = require('fs')

const SRC = '.workbuddy-ai/tmp-shots/StudyBuddy.head.tsx'
const lines = fs.readFileSync(SRC, 'utf8').split('\n')

// Helpers immediately above detectLivePageContext: clipped/textOf/dataOf/listOf.
const startHelpers = lines.findIndex((line) => line.startsWith('function clipped('))
const startDetect = lines.findIndex((line) => line.startsWith('export function detectLivePageContext'))
if (startHelpers === -1 || startDetect === -1) throw new Error('markers not found')

// The function ends at the first line that is exactly "}" after startDetect,
// followed by a blank line — find the closing brace at column 0.
let endDetect = -1
for (let index = startDetect; index < lines.length; index += 1) {
  if (lines[index] === '}') { endDetect = index; break }
}
if (endDetect === -1) throw new Error('end of detectLivePageContext not found')

const body = lines.slice(startHelpers, endDetect + 1).join('\n')

const out = `import type { ChatTab } from '../../services/aiChatService'

export interface BuddyContext {
  tab: ChatTab
  focus?: string
  detail?: string
}

${body.replace('export function detectLivePageContext(\n  activeTab: ChatTab,\n  fallbackFocus?: string\n): { focus?: string; detail?: string; badge?: string } {', 'export function detectLivePageContext(\n  activeTab: ChatTab,\n  fallbackFocus?: string,\n): { focus?: string; detail?: string; badge?: string } {')}
`
fs.writeFileSync('web/src/components/ai/buddyContext.ts', out)
console.log('wrote buddyContext.ts:', out.split('\n').length, 'lines')
console.log('has clipped:', out.includes('function clipped('))
console.log('has detect:', out.includes('export function detectLivePageContext('))
