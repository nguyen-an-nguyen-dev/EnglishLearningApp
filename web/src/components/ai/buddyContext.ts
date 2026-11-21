import type { ChatTab } from '../../types/buddy'

export interface BuddyContext {
  tab: ChatTab
  focus?: string
  detail?: string
}

/**
 * Reads the live DOM to see what the learner is looking at. The backend treats
 * the returned strings as untrusted data.
 */
export function detectLivePageContext(
  activeTab: ChatTab,
  fallbackFocus?: string
): { focus?: string; detail?: string } {
  if (typeof document === 'undefined') {
    return { focus: fallbackFocus || undefined }
  }

  try {
    if (document.querySelector('.settings-panel')) {
      return {
        focus: 'Cài đặt',
        detail: 'Người dùng đang mở bảng Cài đặt: đổi giao diện sáng/tối, ngôn ngữ, thông tin tài khoản và đăng xuất.',
      }
    }
    if (document.querySelector('.auth-dialog')) {
      const authTab = document.querySelector('.auth-tabs .is-active, .auth-tabs [aria-selected="true"]')?.textContent?.trim() || 'Đăng nhập'
      return {
        focus: `Tài khoản · ${authTab}`,
        detail: `Người dùng đang mở hộp thoại xác thực tài khoản (${authTab}); ứng dụng yêu cầu đăng nhập để lưu tiến độ học.`,
      }
    }
    if (activeTab === 'videos') {
      const videoDetailEl = document.querySelector('.video-detail') as HTMLElement | null
      if (videoDetailEl) {
        const title =
          videoDetailEl.dataset.videoTitle ||
          document.querySelector('.practice-hero h1')?.textContent?.trim() ||
          ''
        const topic = videoDetailEl.dataset.videoTopic || ''
        const level = videoDetailEl.dataset.videoLevel || ''
        const desc =
          videoDetailEl.dataset.videoDesc ||
          document.querySelector('.practice-hero p')?.textContent?.trim() ||
          ''
        const segments = videoDetailEl.dataset.videoSegments || ''
        const currentSegment =
          document.querySelector('.practice-target-phrase')?.textContent?.trim() || ''

        const details = [
          `Đang xem video học tiếng Anh.`,
          title ? `Tên video / bài hát: "${title}"` : '',
          topic ? `Chủ đề: ${topic}` : '',
          level ? `Trình độ: ${level}` : '',
          desc ? `Mô tả: ${desc}` : '',
          currentSegment ? `Câu đang luyện nghe/gõ: "${currentSegment}"` : '',
          segments ? `Lời thoại / phân đoạn trong video: ${segments}` : '',
        ]
          .filter(Boolean)
          .join(' | ')

        return {
          focus: title ? `Video: ${title}` : 'Học qua video',
          detail: details,
        }
      }

      const isNotebook = Boolean(document.querySelector('.video-notebook'))
      if (isNotebook) {
        return {
          focus: 'Sổ từ vựng video',
          detail: 'Người dùng đang xem và ôn tập các từ vựng đã lưu trong lúc luyện nghe video.',
        }
      }

      return {
        focus: 'Thư viện video',
        detail: 'Người dùng đang duyệt danh sách thư viện video học tiếng Anh trên YouTube.',
      }
    }

    const lessonPlayerEl = document.querySelector('.lesson-player') as HTMLElement | null
    if (lessonPlayerEl || document.querySelector('.lesson-header')) {
      const lessonTitle =
        lessonPlayerEl?.dataset.lessonTitle ||
        document.querySelector('.lesson-header')?.textContent?.trim() ||
        fallbackFocus ||
        ''
      const questionPrompt =
        lessonPlayerEl?.dataset.questionPrompt ||
        document.querySelector('.lesson-question-text')?.textContent?.trim() ||
        ''
      const questionIndex = lessonPlayerEl?.dataset.questionIndex || ''
      const questionType = lessonPlayerEl?.dataset.questionType || ''
      const questionExplanation = lessonPlayerEl?.dataset.questionExplanation || ''

      const details = [
        `Người dùng đang làm bài học tương tác.`,
        lessonTitle ? `Tên bài học: "${lessonTitle}"` : '',
        questionIndex ? `Tiến độ câu hỏi: ${questionIndex}` : '',
        questionType ? `Dạng bài tập: ${questionType}` : '',
        questionPrompt ? `Nội dung câu hỏi đang làm: "${questionPrompt}"` : '',
        questionExplanation ? `Giải thích thêm: "${questionExplanation}"` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      return {
        focus: lessonTitle ? `Bài học: ${lessonTitle}` : 'Bài học',
        detail: details,
      }
    }

    if (activeTab === 'study') {
      const mainEl = document.querySelector('.learning-page') as HTMLElement | null
      const currentLesson = mainEl?.dataset.currentLesson || fallbackFocus || ''
      const currentStage = mainEl?.dataset.currentStage || ''
      const doneLessons = mainEl?.dataset.completedLessons || ''
      const totalLessons = mainEl?.dataset.totalLessons || ''

      const details = [
        `Người dùng đang ở Lộ trình học tiếng Anh (Roadmap).`,
        currentStage ? `Chặng hiện tại: ${currentStage}` : '',
        currentLesson ? `Bài học tiếp theo cần hoàn thành: "${currentLesson}"` : '',
        totalLessons ? `Tiến độ: Đã xong ${doneLessons}/${totalLessons} bài học.` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      return {
        focus: currentLesson ? `Lộ trình: ${currentLesson}` : 'Lộ trình học',
        detail: details,
      }
    }

    if (activeTab === 'translate') {
      const pageEl = document.querySelector('.translate-page') as HTMLElement | null
      const sourceLang = pageEl?.dataset.sourceLang || 'en'
      const targetLang = pageEl?.dataset.targetLang || 'vi'
      const sourceText =
        pageEl?.dataset.sourceText ||
        document.querySelector<HTMLTextAreaElement>('.translate-textarea')?.value?.trim() ||
        ''
      const resultText =
        pageEl?.dataset.resultText ||
        document.querySelector('.translate-result-text')?.textContent?.trim() ||
        ''
      const pos = pageEl?.dataset.detectedPos || ''
      const meanings = pageEl?.dataset.detectedMeanings || ''

      const langDirection = `${sourceLang === 'en' ? 'Anh' : 'Việt'} → ${targetLang === 'vi' ? 'Việt' : 'Anh'}`
      const details = [
        `Người dùng đang ở công cụ Dịch tài liệu song ngữ (${langDirection}).`,
        sourceText ? `Đoạn văn bản gốc cần dịch: "${sourceText.slice(0, 400)}"` : 'Chưa nhập văn bản',
        resultText ? `Bản dịch hệ thống đã cho: "${resultText.slice(0, 400)}"` : '',
        pos ? `Từ loại: ${pos}` : '',
        meanings ? `Nghĩa gợi ý: ${meanings}` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      return {
        focus: sourceText ? `Dịch (${langDirection})` : 'Dịch tài liệu',
        detail: details,
      }
    }

    if (activeTab === 'compete') {
      const matchEl = document.querySelector('.arena-match') as HTMLElement | null
      if (matchEl) {
        const round = matchEl.dataset.round || '1'
        const totalRounds = matchEl.dataset.totalRounds || '5'
        const myScore = matchEl.dataset.myScore || '0'
        const opponentName = matchEl.dataset.opponentName || 'Đối thủ'
        const opponentScore = matchEl.dataset.opponentScore || '0'
        const translation = matchEl.dataset.questionTranslation || ''
        const example = matchEl.dataset.questionExample || ''
        const level = matchEl.dataset.questionLevel || ''

        const details = [
          `Đang trong trận đấu Đấu trường từ vựng 1v1 theo thời gian thực.`,
          `Đối thủ: ${opponentName}.`,
          `Vòng đấu: ${round}/${totalRounds}.`,
          `Tỉ số hiện tại: Bạn ${myScore} - ${opponentScore} ${opponentName}.`,
          translation ? `Câu hỏi vòng này: nghĩa tiếng Việt là "${translation}"` : '',
          example ? `Câu ví dụ/gợi ý: "${example}"` : '',
          level ? `Trình độ từ: ${level}` : '',
        ]
          .filter(Boolean)
          .join(' | ')

        return {
          focus: `Đấu trường · vs ${opponentName}`,
          detail: details,
        }
      }

      const isQueue = Boolean(document.querySelector('.arena-queue, .arena-lobby-card.is-searching'))
      if (isQueue) {
        return {
          focus: 'Đấu trường từ vựng',
          detail: 'Người dùng đang trong hàng chờ ghép trận Đấu trường từ vựng 1v1.',
        }
      }

      const arenaEl = document.querySelector('.arena-view') as HTMLElement | null
      const played = arenaEl?.dataset.played || '0'
      const wins = arenaEl?.dataset.wins || '0'
      const winRate = arenaEl?.dataset.winRate || '0'
      const winStreak = arenaEl?.dataset.winStreak || '0'

      return {
        focus: 'Đấu trường từ vựng',
        detail: `Đang ở sảnh Đấu trường từ vựng 1v1. Thành tích: đã chơi ${played} trận, thắng ${wins} trận (tỉ lệ thắng ${winRate}%), chuỗi thắng ${winStreak} trận.`,
      }
    }

    if (activeTab === 'rankings') {
      const rankEl = document.querySelector('.rank-view') as HTMLElement | null
      const myRank = rankEl?.dataset.myRank
      const totalUsers = rankEl?.dataset.totalUsers || ''
      const myRp = rankEl?.dataset.myScore || ''
      const leaderName = rankEl?.dataset.leaderName || ''
      const leaderScore = rankEl?.dataset.leaderScore || ''
      const tier = rankEl?.dataset.leagueTier || ''
      if (rankEl?.dataset.boardReady !== 'true') {
        return { focus: 'League tuần', detail: 'Chưa có dữ liệu bảng xếp hạng tuần này trên màn hình.' }
      }
      const zoneNames = { promote: 'thăng hạng', stay: 'giữ hạng', demote: 'xuống hạng' }
      const zones = (rankEl.dataset.zones ?? '').split(',').flatMap((band) => {
        const [zone, range] = band.split(':')
        if (zone !== 'promote' && zone !== 'stay' && zone !== 'demote') return []
        return [`${zoneNames[zone]}: hạng ${range}`]
      })

      const details = [
        'Người dùng đang xem bảng xếp hạng league tuần này. Chỉ có một bảng theo tuần, không có bảng tổng.',
        tier ? `Hạng hiện tại: ${tier}.` : '',
        myRank ? `Thứ hạng tuần này: #${myRank} trên ${totalUsers} học viên cùng hạng.` : 'Chưa có thứ hạng tuần này.',
        myRp ? `RP tuần này: ${myRp}.` : '',
        leaderName ? `Người dẫn đầu: ${leaderName} (${leaderScore} RP).` : '',
        zones.length ? `Vùng xếp hạng: ${zones.join('; ')}.` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      return {
        focus: myRank ? `League tuần · Hạng #${myRank}` : 'League tuần',
        detail: details,
      }
    }

    if (activeTab === 'shop') {
      return {
        focus: 'Gara Engorace',
        detail: 'Người dùng đang ở Gara: mua và lắp xe, khung tên, phụ tùng bằng Race Coin.',
      }
    }

    if (activeTab === 'profile') {
      const profileEl = document.querySelector('.profile-view') as HTMLElement | null
      const userName = profileEl?.dataset.userName || ''
      const userXp = profileEl?.dataset.userXp || ''
      const userStreak = profileEl?.dataset.userStreak || ''
      const lessonsDone = profileEl?.dataset.lessonsDone || ''
      const lessonsTotal = profileEl?.dataset.lessonsTotal || ''
      const progressPercent = profileEl?.dataset.progressPercent || ''
      const currentStage = profileEl?.dataset.currentStage || ''
      const badgesCount = profileEl?.dataset.badgesCount || ''

      const details = [
        `Người dùng đang xem trang Hồ sơ cá nhân của mình.`,
        userName ? `Tên học viên: ${userName}` : '',
        userXp ? `Tổng điểm XP: ${userXp}` : '',
        userStreak ? `Chuỗi học tập liên tục (Streak): ${userStreak} ngày` : '',
        lessonsTotal ? `Tiến độ hoàn thành: ${lessonsDone}/${lessonsTotal} bài (${progressPercent}%)` : '',
        currentStage ? `Chặng học hiện tại: ${currentStage}` : '',
        badgesCount ? `Số lượng huy hiệu đã đạt: ${badgesCount}` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      return {
        focus: userName ? `Hồ sơ · ${userName}` : 'Hồ sơ cá nhân',
        detail: details,
      }
    }
  } catch {
    /* ignore DOM errors */
  }

  return {
    focus: fallbackFocus || undefined,
    detail: undefined,
  }
}
