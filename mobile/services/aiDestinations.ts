import type { Href } from 'expo-router';
import type { AiChatAction, AiMessageTurn, StudyStep } from './ai';

export interface AiDestination {
  href: Href;
  label: string;
  push?: boolean;
}

export function routeId(value: unknown): number | null {
  const id = typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : value;
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function aiDestination(action: AiChatAction): AiDestination | null {
  const label = action.label?.trim();
  switch (action.kind) {
    case 'open_lesson': {
      const id = routeId(action.lessonId);
      if (id === null) return null;
      if (action.mode === 'reveal') {
        return {
          href: { pathname: '/(tabs)', params: { buddyLessonId: id } },
          label: action.lessonTitle ? `Xem vị trí bài “${action.lessonTitle}”` : label || 'Xem vị trí bài học',
        };
      }
      return {
        href: { pathname: '/lesson/[id]', params: { id } }, push: true,
        label: action.lessonTitle ? `Mở bài “${action.lessonTitle}”` : label || 'Mở bài học',
      };
    }
    case 'open_video': {
      const id = routeId(action.videoId);
      return id === null ? null : {
        href: { pathname: '/(tabs)/talk', params: { buddyVideoId: id, buddyVideoView: '' } },
        label: action.videoTitle ? `Mở video “${action.videoTitle}”` : label || 'Mở video',
      };
    }
    case 'open_notebook':
      return { href: { pathname: '/(tabs)/talk', params: { buddyVideoView: 'notebook', buddyVideoId: '' } }, label: label || 'Mở Sổ từ' };
    case 'open_review':
      return { href: '/review', label: label || 'Bắt đầu ôn tập', push: true };
    case 'open_tab':
    case 'spotlight':
      switch (action.tab) {
        case 'study': return { href: '/(tabs)', label: label || 'Mở lộ trình' };
        case 'videos': return {
          href: { pathname: '/(tabs)/talk', params: { buddyVideoView: action.highlight === 'control:owned-videos' ? 'owned' : 'library', buddyVideoId: '' } },
          label: label || 'Mở thư viện video',
        };
        case 'translate': return { href: '/(tabs)/translate', label: label || 'Mở Dịch tài liệu' };
        case 'compete': return { href: '/battle', label: label || 'Mở Thi đua' };
        case 'rankings': return { href: '/(tabs)/ranking', label: label || 'Mở bảng xếp hạng' };
        case 'profile': return { href: '/(tabs)/settings', label: label || 'Mở cài đặt' };
        default: return null;
      }
    default:
      return null;
  }
}

export function replyActions(turn: Pick<AiMessageTurn, 'action' | 'actions'>): AiChatAction[] {
  return turn.actions?.length ? turn.actions : turn.action ? [turn.action] : [];
}

export function planDestination(step: StudyStep): AiDestination | null {
  const kind = step.kind === 'review' ? 'open_review' : step.kind === 'vocab' ? 'open_notebook'
    : step.target.videoId ? 'open_video' : step.target.lessonId ? 'open_lesson' : 'open_tab';
  return aiDestination({ kind, label: step.title, ...step.target });
}
