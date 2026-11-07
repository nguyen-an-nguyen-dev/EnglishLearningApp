/**
 * One-off cleanup: remove the leftover mock video panel body plus the duplicate
 * duel-panel opening tag introduced while swapping in <DemoVideoPanel/>.
 * Verifies both boundaries before touching the file.
 */
const fs = require('fs')

const FILE = 'web/src/components/landing/LandingSections.tsx'
const lines = fs.readFileSync(FILE, 'utf8').split('\n')
const at = (n) => lines[n - 1] // 1-based access

// 615 must open the duplicate duel tabpanel, 728 must close the old video panel.
const startCheck = [at(615).trim(), at(616).trim(), at(617).trim(), at(618).trim()]
const endCheck = at(728).trim()

if (startCheck[0] !== '<div' || startCheck[2] !== 'id="mode-panel-duel"') {
  throw new Error(`unexpected start boundary: ${JSON.stringify(startCheck)}`)
}
if (endCheck !== '</div>') {
  throw new Error(`unexpected end boundary: ${JSON.stringify(endCheck)}`)
}
if (at(730).trim() !== '<div' || at(732).trim() !== 'id="mode-panel-duel"') {
  throw new Error('the original duel panel is not where it was expected')
}

const removed = lines.splice(615 - 1, 728 - 615 + 1)
fs.writeFileSync(FILE, lines.join('\n'))
console.log(`removed ${removed.length} lines (old mock video body + duplicate panel tag)`)
console.log(`first removed: ${removed[0].trim()}`)
console.log(`last removed:  ${removed[removed.length - 1].trim()}`)
