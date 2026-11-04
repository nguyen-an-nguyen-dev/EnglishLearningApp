export function speakEnglish(value: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(value.replace(/[^a-zA-Z' ]/g, ''))
  utterance.lang = 'en-US'
  utterance.rate = 0.92
  window.speechSynthesis.speak(utterance)
}
