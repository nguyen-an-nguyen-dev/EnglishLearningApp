export type BuddyLanguage = 'vi' | 'en';

export function normalizeDestination(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeOperationRequest(message: string): string {
  return normalizeDestination(message)
    .replace(/^(?:xin chao|chao)(?: (?:ban|bac|buddy))? +/, '')
    .replace(/^(?:(?:en buddy|buddy|bac turbo|lam on|vui long|ban|bac) +)*(?:co the |can you |could you |would you |please )?/, '')
    .replace(/^(?:(?:minh|toi|em) muon |i (?:want|would like) to )/, '')
    .replace(/^giup (?:minh|toi|em) /, '')
    .replace(/(?: duoc khong| please)(?: roi (?:anh ay|a|roi))?$/, '')
    .replace(/^(?:mo(?: ra)?|xem) (?:va )?gioi thieu(?= )/, 'mo')
    .replace(/^(mo|xem|tim|open|show) (?:(?:cho|giup) (?:minh|toi|em)|me) /, '$1 ')
    .replace(/^(?:vo|vao) may xep hang\b/, 'vao bang xep hang')
    .replace(/^(?:vo|di toi|di den|den) /, 'vao ');
}

export function isOperationRequest(message: string): boolean {
  const text = normalizeOperationRequest(message);
  return /^(?:mo|vao|chuyen|xem|tim|mua|bat dau|open|show|switch|go to|take me|find|start|play|buy)\b/.test(text)
    && !/\b(?:dung (?:mo|chuyen|vao|xem|tim|mua)|do not|don t|la gi|tai sao|the nao|how to|how do i|what is)\b/.test(text);
}

export function buddyLanguage(message: string): BuddyLanguage {
  const text = normalizeDestination(message);
  const vietnamese = /\b(minh|toi|cua toi|ban|bao nhieu|cap may|bai|chang|mo|mua|tim|xem|luyen|ho so|huy hieu|xep hang|chuoi|ngau nhien|giai thich|tien do|giup|la gi|tai sao|trang bi)\b/;
  if (/[àáảãạăâèéẻẽẹêìíỉĩịòóỏõọôơùúủũụưỳýỷỹỵđ]/iu.test(message.normalize('NFC')) || vietnamese.test(text)) {
    return 'vi';
  }
  return /\b(i|my|me|you|what|how|why|when|where|is|are|do|can|should|open|start|take|show|learn|study|watch|play|find|buy|random|lesson|stage|level|badges|wallet|rank|help|explain|equipment|progress|review|hello|thanks|the|one|this|that|it|them|something|like|want|red|blue|green|yellow|black|white|cheap|expensive|item|shop|and|for|with|please|yes|no|more|any)\b/.test(text)
    ? 'en'
    : 'vi';
}

export function buddyReplyLanguage(reply: string, fallback: BuddyLanguage): BuddyLanguage {
  // Quoted examples and code can be in a different language from the explanation.
  const prose = reply.replace(/`[^`]*`|“[^”]*”|«[^»]*»|"[^"]*"/g, ' ');
  for (const sample of [prose, reply]) {
    const accents = sample.normalize('NFD');
    const vietnameseAccents = accents.match(/[đ\u0306\u0309\u031b\u0323]|[aeo]\u0302[\u0300\u0301\u0303]/giu)?.length ?? 0;
    const words = normalizeDestination(sample).split(' ');
    const vietnamese = words.filter((word) =>
      /^(?:minh|ban|cua|nhung|chua|duoc|trong|nhu|nay|mot|cac|cho|nhac|hoc|tieng|nguoi|khong|muon|dang|nhieu|xin|chao)$/.test(word)).length;
    const english = words.filter((word) =>
      /^(?:the|is|are|you|your|we|can|could|here|this|that|these|with|from|and|for|have|has|please|hello|thanks|opened|would|will|what|when)$/.test(word)).length;
    const score = vietnameseAccents * 2 + vietnamese - english;
    if (score > 0) return 'vi';
    if (score < 0) return 'en';
  }
  return fallback;
}
