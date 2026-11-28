import { getSavedWord, getSavedWords } from '../video/video.repository';
import type { SavedWordRow } from '../video/video.types';
import { normalizeDestination, type BuddyLanguage } from './ai.language';
import type { AiReply } from './ai.types';

function formatWord(entry: SavedWordRow): string {
  return [`“${entry.word}”`, entry.ipa, entry.meaning_vi && `– “${entry.meaning_vi}”`].filter(Boolean).join(' ');
}

/** Standalone requests for the learner's own notebook, including their saved gloss. */
export function answerNotebookQuestion(userId: number, message: string, language: BuddyLanguage): Promise<AiReply> | null {
  const text = message.normalize('NFC').trim().replace(/[?!.…]+$/u, '').trim();
  const normalized = normalizeDestination(text);
  const word = (/^what does (.+?) mean in my (?:vocabulary notebook|notebook|saved words)$/iu.exec(text)
    ?? /^tra (?:ngh[iĩ]a )?(?:t[uừ] )?(.+?) trong s[oổ] t[uừ](?: v[uự]ng)?(?: c[uủ]a (?:m[iì]nh|t[oô]i))?$/iu.exec(text))
    ?.[1]?.trim().replace(/^["“`]|["”`]$/gu, '').toLowerCase();
  const recent = /^(?:what are |list |show me )?my (?:recently saved words|(?:latest|recent) saved words)$/.test(normalized)
    || /^(?:xem |liet ke |cho (?:minh|toi) xem )?(?:(?:cac|nhung) )?tu (?:vung )?(?:(?:minh|toi) )?moi luu(?: gan day)?$/.test(normalized);
  const en = language === 'en';
  const answer = (reply: string): AiReply => ({
    reply,
    followups: [en ? 'Open notebook' : 'Mở Sổ từ'],
    action: null,
    reminder: null,
    feedback: [],
  });
  if (recent) {
    return getSavedWords(userId, 5).then((entries) => answer(entries.length
      ? `${en ? 'Recently saved' : 'Từ vừa lưu'}: ${entries.map(formatWord).join('; ')}.`
      : en ? 'Your notebook is empty.' : 'Sổ từ của bạn chưa có từ nào.'));
  }
  if (!word || word.length > 80) return null;
  return getSavedWord(userId, word).then((entry) => {
    if (!entry) {
      return answer(en ? `I couldn’t find “${word}” in your notebook.` : `Mình chưa tìm thấy “${word}” trong Sổ từ của bạn.`);
    }
    const saved = formatWord(entry);
    if (entry.meaning_vi || entry.detail_vi) {
      const detail = entry.detail_vi ? ` “${entry.detail_vi.slice(0, 220)}”` : '';
      return answer(`${en ? 'From your notebook' : 'Theo Sổ từ của bạn'}: ${saved}.${detail}`);
    }
    return answer(en ? `Your notebook contains ${saved}. A meaning hasn’t been saved yet.`
      : `Sổ từ có ${saved}. Bạn chưa lưu nghĩa của từ này.`);
  });
}
