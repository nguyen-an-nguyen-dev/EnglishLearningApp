import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Lang = 'vi' | 'en'

export const LANG_STORAGE_KEY = 'engorace_lang'

const vi = {
  /* shell */
  navStudy: 'Học Tập',
  navCompete: 'Thi Đua',
  navRankings: 'Bảng Xếp Hạng',
  navRankingsShort: 'Xếp Hạng',
  navProfile: 'Profile',
  navAria: 'Điều hướng chính',
  mobileNavAria: 'Điều hướng trên điện thoại',
  brandHome: 'Engorace trang chủ',
  daysShort: 'ngày',
  signOut: 'Đăng xuất',
  signOutAria: 'Đăng xuất tài khoản',

  /* settings */
  settings: 'Cài đặt',
  close: 'Đóng',
  appearance: 'Giao diện',
  light: 'Sáng',
  dark: 'Tối',
  language: 'Ngôn ngữ',
  langVi: 'Tiếng Việt',
  langEn: 'English',
  toLight: 'Chuyển sang nền sáng',
  toDark: 'Chuyển sang nền tối',

  /* study */
  studyEyebrow: 'Lộ trình của bạn',
  studyHi: (name: string) => `Chào ${name},`,
  studyTail: 'mình đi tiếp nhé.',
  studyDoneCount: (done: number, total: number) => `${done}/${total}`,
  studyDoneLabel: 'bài đã xong',
  studyStreakCount: (days: number) => `${days} ngày`,
  studyStreakLabel: 'giữ nhịp',
  stage: (index: string) => `Chặng ${index}`,
  stopLocked: 'Cần mở khóa',
  stopReview: 'Học lại',
  stopContinue: 'Học tiếp',
  stopAria: (id: number, title: string) => `Chặng ${id}: ${title}`,
  stopAriaLocked: (id: number, title: string) => `Chặng ${id}: ${title}, đang khóa`,
  skillListen: 'Luyện nghe',
  skillSpeak: 'Luyện nói',
  skillRead: 'Luyện đọc',
  skillWrite: 'Luyện viết',
  skillMixed: 'Đa kỹ năng',
  mapAria: 'Bản đồ lộ trình học tiếng Anh',
  mapHint: 'Chạm vào một mốc trên bản đồ để xem bài học.',
  roadmapLoading: 'Đang tải lộ trình…',
  roadmapEmpty: 'Chưa có dữ liệu lộ trình.',
  retry: 'Thử lại',
  questionsLabel: 'câu hỏi',

  /* compete */
  competeEyebrow: 'ĐẤU TRƯỜNG THI ĐUA',
  competeTitle: 'So tài & thử thách phản xạ',
  competeDesc: 'Tranh tài cùng cộng đồng học viên để kiểm tra phản xạ và bứt phá điểm số.',
  seasonNote: (days: number) => `Mùa 04 · còn ${days} ngày`,
  featuredLabel: 'Thử thách nổi bật',
  featuredTitle: 'Giải đua tốc độ cuối tuần',
  featuredDesc: 'Ba vòng đấu từ vựng, mỗi vòng 10 giây. Giữ chuỗi trả lời đúng để nhân điểm thưởng.',
  featuredPlayers: '1.248 người đã tham gia',
  featuredStarts: (days: number) => `Khởi tranh sau ${days} ngày`,
  featuredJoin: 'Vào giải đấu',
  challengeSpeedTitle: 'Thử thách phản xạ 60 giây',
  challengeSpeedCategory: 'Tốc độ phản xạ',
  challengeSpeedPlayers: '840 người đang chơi',
  challengeDuelTitle: 'Đấu trường 1v1 trực tuyến',
  challengeDuelCategory: 'Đối kháng trực tiếp',
  challengeDuelPlayers: '312 người đang chờ',
  startAria: (title: string) => `Bắt đầu ${title}`,
  seasonCardTitle: 'Mùa giải tuần này',
  seasonProgressAria: (percent: number) => `Tiến độ mùa giải ${percent} phần trăm`,
  seasonCardBody: 'Còn 2 ngày để tích thêm XP. Top 10 sẽ thăng hạng vào Chủ Nhật.',

  /* rankings */
  rankEyebrow: 'BẢNG XẾP HẠNG TUẦN',
  rankTitle: 'Giải Đấu Bạc · Bảng 12',
  rankDesc: 'Top 10 học viên có điểm XP cao nhất sẽ thăng hạng vào Chủ Nhật tuần này.',
  rankUpdated: 'Cập nhật 5 phút trước',
  topThree: 'TOP 3 TUẦN NÀY',
  leaders: 'Những người dẫn đầu.',
  podiumCaption: 'Giải Bạc · Bảng 12',
  podiumAria: 'Ba học viên dẫn đầu',
  seasonKicker: 'MÙA GIẢI',
  seasonLeft: 'Còn 2 ngày.',
  seasonBody: 'Bạn đang đứng thứ 4. Thêm 600 XP để vào top 3 và nhận huy hiệu tuần.',
  yourPosition: 'Vị trí của bạn',
  gapTop3: 'Khoảng cách top 3',
  promotion: 'Thăng hạng',
  tableRank: 'Thứ hạng',
  tableUser: 'Học viên',
  tableStreak: 'Chuỗi ngày',
  tableXp: 'Điểm XP',
  you: 'Bạn',
  days: (days: number) => `${days} ngày`,

  /* profile */
  profileEyebrow: 'HỒ SƠ CÁ NHÂN',
  profileTitle: 'Quản lý tài khoản & tiến độ',
  profileDesc: 'Xem tổng quan hành trình học tập và cài đặt cá nhân của bạn.',
  activeLearner: 'Học viên tích cực',
  rankTag: 'Hạng 4 · Giải Bạc',
  statStreakLabel: 'Chuỗi ngày bền bỉ',
  statXpLabel: 'Tổng điểm kinh nghiệm',
  statStagesLabel: 'Lộ trình đã hoàn thành',
  statLessonsLabel: 'bài đã xong',
  statStagesValue: (done: number, total: number) => `${done}/${total} chặng`,
  pathKicker: 'LỘ TRÌNH CỦA BẠN',
  pathTitle: (stage: number) => `Đi tiếp từ chặng ${String(stage).padStart(2, '0')}.`,
  pathAria: (percent: number) => `Đã hoàn thành ${percent} phần trăm lộ trình`,
  statusDone: 'Đã xong',
  statusCurrent: 'Đang mở',
  statusLocked: 'Đang khóa',
  badgeStart: 'Khởi hành',
  badgeStreak: 'Giữ nhịp',
  badgeSprint: 'Bứt tốc',
  accountOptions: 'Tùy chọn tài khoản',
  changePassword: 'Đổi mật khẩu',
  editName: 'Đổi tên hiển thị',
  currentPassword: 'Mật khẩu hiện tại',
  newPassword: 'Mật khẩu mới',
  repeatNewPassword: 'Nhập lại mật khẩu mới',
  displayName: 'Tên hiển thị',
  emailLabel: 'Email',
  emailLocked: 'Email không đổi được.',
  save: 'Lưu',
  saving: 'Đang lưu…',
  cancel: 'Hủy',
  passwordUpdated: 'Đã đổi mật khẩu.',
  profileUpdated: 'Đã lưu thông tin.',
  passwordMismatch: 'Mật khẩu nhập lại không khớp.',
  wrongPassword: 'Mật khẩu hiện tại không đúng.',
  passwordTooShort: 'Mật khẩu phải có ít nhất 6 ký tự.',
  saveFailed: 'Không lưu được. Thử lại nhé.',
  tipTitle: 'Gợi ý cho bạn',
  tipBody: (days: number) =>
    `Bạn đang giữ chuỗi ${days} ngày. Thêm một bài ngắn hôm nay để mở huy hiệu Bứt tốc.`,
  logoutLong: 'Đăng xuất khỏi tài khoản',

  /* footer */
  footerLeft: 'Engorace · Học một chút, xa thêm một đoạn.',
  footerRight: 'Chúc bạn học vui mỗi ngày!',
}

const en: typeof vi = {
  navStudy: 'Study',
  navCompete: 'Compete',
  navRankings: 'Leaderboard',
  navRankingsShort: 'Ranks',
  navProfile: 'Profile',
  navAria: 'Main navigation',
  mobileNavAria: 'Mobile navigation',
  brandHome: 'Engorace home',
  daysShort: 'days',
  signOut: 'Sign out',
  signOutAria: 'Sign out of your account',

  settings: 'Settings',
  close: 'Close',
  appearance: 'Appearance',
  light: 'Light',
  dark: 'Dark',
  language: 'Language',
  langVi: 'Vietnamese',
  langEn: 'English',
  toLight: 'Switch to light',
  toDark: 'Switch to dark',

  studyEyebrow: 'Your path',
  studyHi: (name: string) => `Hi ${name},`,
  studyTail: "let's keep going.",
  studyDoneCount: (done: number, total: number) => `${done}/${total}`,
  studyDoneLabel: 'lessons done',
  studyStreakCount: (days: number) => `${days}-day`,
  studyStreakLabel: 'streak',
  stage: (index: string) => `Stage ${index}`,
  stopLocked: 'Locked',
  stopReview: 'Review',
  stopContinue: 'Continue',
  stopAria: (id: number, title: string) => `Stage ${id}: ${title}`,
  stopAriaLocked: (id: number, title: string) => `Stage ${id}: ${title}, locked`,
  skillListen: 'Listening',
  skillSpeak: 'Speaking',
  skillRead: 'Reading',
  skillWrite: 'Writing',
  skillMixed: 'Mixed skills',
  mapAria: 'English learning roadmap',
  mapHint: 'Tap a stop on the map to preview the lesson.',
  roadmapLoading: 'Loading your roadmap…',
  roadmapEmpty: 'No roadmap data yet.',
  retry: 'Retry',
  questionsLabel: 'questions',

  competeEyebrow: 'COMPETITION ARENA',
  competeTitle: 'Head-to-head & reflex drills',
  competeDesc: 'Take on the learner community to test your reflexes and push your score higher.',
  seasonNote: (days: number) => `Season 04 · ${days} days left`,
  featuredLabel: 'Featured challenge',
  featuredTitle: 'Weekend speed race',
  featuredDesc: 'Three vocabulary rounds, 10 seconds each. Keep the streak alive to multiply your bonus.',
  featuredPlayers: '1,248 players joined',
  featuredStarts: (days: number) => `Starts in ${days} days`,
  featuredJoin: 'Join the race',
  challengeSpeedTitle: '60-second reflex challenge',
  challengeSpeedCategory: 'Reflex speed',
  challengeSpeedPlayers: '840 playing now',
  challengeDuelTitle: '1v1 online duel',
  challengeDuelCategory: 'Live head-to-head',
  challengeDuelPlayers: '312 waiting',
  startAria: (title: string) => `Start ${title}`,
  seasonCardTitle: 'This week’s season',
  seasonProgressAria: (percent: number) => `Season progress ${percent} percent`,
  seasonCardBody: 'Two days left to stack XP. The top 10 move up on Sunday.',

  rankEyebrow: 'WEEKLY LEADERBOARD',
  rankTitle: 'Silver League · Board 12',
  rankDesc: 'The 10 learners with the most XP move up this Sunday.',
  rankUpdated: 'Updated 5 minutes ago',
  topThree: 'TOP 3 THIS WEEK',
  leaders: 'Leading the pack.',
  podiumCaption: 'Silver League · Board 12',
  podiumAria: 'Top three learners',
  seasonKicker: 'SEASON',
  seasonLeft: 'Two days left.',
  seasonBody: 'You are 4th. Another 600 XP puts you in the top 3 and earns the weekly badge.',
  yourPosition: 'Your position',
  gapTop3: 'Gap to top 3',
  promotion: 'Promotion',
  tableRank: 'Rank',
  tableUser: 'Learner',
  tableStreak: 'Streak',
  tableXp: 'XP',
  you: 'You',
  days: (days: number) => `${days} days`,

  profileEyebrow: 'PROFILE',
  profileTitle: 'Account & progress',
  profileDesc: 'An overview of your learning journey and personal settings.',
  activeLearner: 'Active learner',
  rankTag: 'Rank 4 · Silver',
  statStreakLabel: 'Current streak',
  statXpLabel: 'Total experience',
  statStagesLabel: 'Path completed',
  statLessonsLabel: 'lessons done',
  statStagesValue: (done: number, total: number) => `${done}/${total} stages`,
  pathKicker: 'YOUR PATH',
  pathTitle: (stage: number) => `Pick up at stage ${String(stage).padStart(2, '0')}.`,
  pathAria: (percent: number) => `${percent} percent of the path completed`,
  statusDone: 'Done',
  statusCurrent: 'Open',
  statusLocked: 'Locked',
  badgeStart: 'Departure',
  badgeStreak: 'Keep the rhythm',
  badgeSprint: 'Sprint',
  accountOptions: 'Account settings',
  changePassword: 'Change password',
  editName: 'Display name',
  currentPassword: 'Current password',
  newPassword: 'New password',
  repeatNewPassword: 'Repeat new password',
  displayName: 'Display name',
  emailLabel: 'Email',
  emailLocked: 'Email cannot be changed.',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  passwordUpdated: 'Password updated.',
  profileUpdated: 'Profile saved.',
  passwordMismatch: 'The passwords do not match.',
  wrongPassword: 'Your current password is incorrect.',
  passwordTooShort: 'Password must be at least 6 characters.',
  saveFailed: 'Could not save. Please try again.',
  tipTitle: 'Suggested for you',
  tipBody: (days: number) =>
    `You are on a ${days}-day streak. One short lesson today unlocks the Sprint badge.`,
  logoutLong: 'Sign out of your account',

  footerLeft: 'Engorace · Learn a little, travel a lot further.',
  footerRight: 'Have a good study day!',
}

export type Dict = typeof vi

const DICTS: Record<Lang, Dict> = { vi, en }

interface LanguageContextValue {
  lang: Lang
  setLang: (next: Lang) => void
  t: Dict
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'vi',
  setLang: () => {},
  t: vi,
})

function readLang(): Lang {
  if (typeof window === 'undefined') return 'vi'
  try {
    return window.localStorage.getItem(LANG_STORAGE_KEY) === 'en' ? 'en' : 'vi'
  } catch {
    return 'vi'
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next)
    } catch {
      /* storage blocked — the switch still applies for this session */
    }
  }, [])

  const value = useMemo(() => ({ lang, setLang, t: DICTS[lang] }), [lang, setLang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useI18n() {
  return useContext(LanguageContext)
}
