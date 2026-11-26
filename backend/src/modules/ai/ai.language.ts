export type BuddyLanguage = 'vi' | 'en';

export function normalizeDestination(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
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
