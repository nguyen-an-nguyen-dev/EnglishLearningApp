/** Bilingual copy for the review + analytics surfaces, kept out of the JSX. */

export interface ReviewCopy {
  eyebrow: string
  title: string
  desc: string
  tabReview: string
  tabAnalytics: string

  dueTitle: (count: number) => string
  dueBody: string
  dueEmptyTitle: string
  dueEmptyBody: string
  start: string
  startEmpty: string
  sync: string
  syncing: string
  syncDone: (added: number) => string

  statDue: string
  statWords: string
  statQuestions: string
  statTotal: string
  statStreak: string

  queueTitle: string
  queueHint: string
  upcomingTitle: string
  upcomingHint: string
  wordLabel: string
  questionLabel: string
  dueNow: string
  inDays: (days: number) => string
  inHours: (hours: number) => string
  inMinutes: (minutes: number) => string
  lapses: (count: number) => string

  sessionTitle: string
  sessionClose: string
  sessionRecallWord: string
  sessionRecallWordHint: string
  sessionRecallQuestion: string
  sessionRecallQuestionHint: string
  sessionCheck: string
  sessionChecking: string
  sessionNext: string
  sessionFinish: string
  sessionCorrect: string
  sessionWrong: string
  sessionAnswerWas: (answer: string) => string
  sessionTypedPlaceholder: string
  sessionSummary: (correct: number, total: number) => string
  sessionDone: string
  sessionDoneBody: string
  sessionAgain: string
  sessionEmpty: string
  noItemsTitle: string
  noItemsBody: string

  analyticsTitle: string
  analyticsAccuracy30: string
  analyticsAnswers30: string
  analyticsMinutes30: string
  analyticsActiveDays: string
  analyticsTrendUp: string
  analyticsTrendDown: string
  analyticsTrendFlat: string
  analyticsNoTrend: string
  analyticsActivity: string
  analyticsActivityHint: string
  analyticsInsights: string
  analyticsInsightsEmpty: string
  analyticsInsightsHint: string
  analyticsVocabulary: string
  analyticsVocabularyHint: string
  analyticsVocabularyEmpty: string
  analyticsQuestions: string
  analyticsQuestionsHint: string
  analyticsQuestionsEmpty: string
  analyticsExercises: string
  analyticsExercisesHint: string
  analyticsExercisesEmpty: string
  analyticsLessons: string
  analyticsLessonsHint: string
  analyticsLessonsEmpty: string
  analyticsContent: string
  analyticsContentHint: string
  analyticsCompetition: string
  analyticsCompetitionEmpty: string

  colWord: string
  colAttempts: string
  colAccuracy: string
  colTime: string
  colStatus: string
  colQuestion: string
  colLesson: string
  colDistractor: string
  colProgress: string
  colRetries: string
  colScore: string

  insightWeakTopic: (topic: string) => string
  insightWeakVocabulary: string
  insightForgottenVocabulary: string
  insightWeakExercise: string
  insightHardQuestion: string
  insightSlowQuestion: string
  insightAbandonedLesson: string
  insightRetryLesson: string
  insightRepeatedMistake: string
  insightAccuracyDrop: string
  insightAccuracyGain: string
  insightDuelAccuracy: string
  insightInactive: string
  insightContentError: string
  insightContentMissing: string

  contentNoCorrect: string
  contentMultipleCorrect: string
  contentTooHard: string

  statusNew: string
  statusLearning: string
  statusReview: string
  statusMastered: string

  unitAnswers: string
  unitMinutes: string
  unitDays: string

  loading: string
  error: string
  retry: string
}

const vi: ReviewCopy = {
  eyebrow: 'ÔN TẬP CÁ NHÂN',
  title: 'Ôn đúng chỗ còn yếu',
  desc: 'Hàng đợi được xếp từ chính lỗi sai của bạn: từ vựng hay quên, câu hỏi khó và dạng bài chưa vững. Lộ trình học giữ nguyên, chỉ phần luyện tập thay đổi.',
  tabReview: 'Cần ôn',
  tabAnalytics: 'Phân tích',

  dueTitle: (count) => count > 0 ? `${count} mục đang chờ bạn` : 'Hôm nay bạn đã ôn xong',
  dueBody: 'Mỗi lần trả lời đúng, mục đó sẽ quay lại muộn hơn. Trả lời sai, nó quay lại sau 10 phút.',
  dueEmptyTitle: 'Chưa có gì để ôn',
  dueEmptyBody: 'Làm một bài học hoặc một trận đấu, những câu sai sẽ tự động vào hàng đợi này.',
  start: 'Bắt đầu ôn',
  startEmpty: 'Chưa có mục nào',
  sync: 'Quét lại lỗi cũ',
  syncing: 'Đang quét…',
  syncDone: (added) => added > 0 ? `Đã thêm ${added} mục từ lịch sử.` : 'Không có lỗi cũ nào cần thêm.',

  statDue: 'Đến hạn',
  statWords: 'Từ vựng',
  statQuestions: 'Câu hỏi',
  statTotal: 'Tổng cộng',
  statStreak: 'Chuỗi ngày',

  queueTitle: 'Đến hạn ôn',
  queueHint: 'Xếp theo mức độ khó và số lần quên.',
  upcomingTitle: 'Sắp tới',
  upcomingHint: 'Đã lên lịch, chưa đến hạn.',
  wordLabel: 'Từ vựng',
  questionLabel: 'Câu hỏi',
  dueNow: 'Đến hạn',
  inDays: (days) => `${days} ngày nữa`,
  inHours: (hours) => `${hours} giờ nữa`,
  inMinutes: (minutes) => `${minutes} phút nữa`,
  lapses: (count) => `quên ${count} lần`,

  sessionTitle: 'Phiên ôn tập',
  sessionClose: 'Đóng',
  sessionRecallWord: 'Viết lại từ tiếng Anh',
  sessionRecallWordHint: 'Nghĩa tiếng Việt ở trên. Gõ từ tiếng Anh tương ứng.',
  sessionRecallQuestion: 'Chọn đáp án đúng',
  sessionRecallQuestionHint: 'Câu hỏi này bạn từng làm sai.',
  sessionCheck: 'Kiểm tra',
  sessionChecking: 'Đang kiểm tra…',
  sessionNext: 'Tiếp tục',
  sessionFinish: 'Xem kết quả',
  sessionCorrect: 'Chính xác',
  sessionWrong: 'Chưa đúng',
  sessionAnswerWas: (answer) => `Đáp án đúng: ${answer}`,
  sessionTypedPlaceholder: 'Nhập câu trả lời…',
  sessionSummary: (correct, total) => `Bạn trả lời đúng ${correct}/${total} mục.`,
  sessionDone: 'Xong phiên ôn',
  sessionDoneBody: 'Những mục đúng đã được lên lịch xa hơn. Mục sai sẽ quay lại sau 10 phút.',
  sessionAgain: 'Ôn tiếp',
  sessionEmpty: 'Không còn mục nào đến hạn.',
  noItemsTitle: 'Chưa có bài tập nào cần ôn lại',
  noItemsBody: 'Làm sai một câu hỏi hoặc một từ vựng, chúng sẽ tự động vào đây để bạn ôn lại.',

  analyticsTitle: 'Dữ liệu học tập',
  analyticsAccuracy30: 'Độ chính xác 30 ngày',
  analyticsAnswers30: 'Câu trả lời',
  analyticsMinutes30: 'Phút học',
  analyticsActiveDays: 'Ngày hoạt động',
  analyticsTrendUp: 'tăng',
  analyticsTrendDown: 'giảm',
  analyticsTrendFlat: 'không đổi',
  analyticsNoTrend: 'chưa đủ dữ liệu',
  analyticsActivity: 'Nhịp học 30 ngày',
  analyticsActivityHint: 'Số câu trả lời mỗi ngày. Cột càng cao, ngày đó càng nhiều bài.',
  analyticsInsights: 'Điều đáng chú ý',
  analyticsInsightsEmpty: 'Chưa đủ dữ liệu để rút ra nhận xét.',
  analyticsInsightsHint: 'Xếp theo mức độ ưu tiên: lỗi kiến thức trước, thói quen sau.',
  analyticsVocabulary: 'Từ vựng',
  analyticsVocabularyHint: 'Từ hay sai và từ đã lâu chưa gặp.',
  analyticsVocabularyEmpty: 'Chưa có dữ liệu từ vựng. Chơi Word Battle để bắt đầu.',
  analyticsQuestions: 'Câu hỏi khó',
  analyticsQuestionsHint: 'Những câu bạn sai nhiều nhất và đáp án gây nhầm lẫn.',
  analyticsQuestionsEmpty: 'Chưa có câu hỏi nào cần chú ý.',
  analyticsExercises: 'Dạng bài tập',
  analyticsExercisesHint: 'Tỷ lệ đúng theo từng loại câu hỏi.',
  analyticsExercisesEmpty: 'Chưa có dữ liệu dạng bài.',
  analyticsLessons: 'Bài học',
  analyticsLessonsHint: 'Bài đã mở, kể cả bài bỏ dở.',
  analyticsLessonsEmpty: 'Chưa có bài học nào được mở.',
  analyticsContent: 'Cảnh báo nội dung',
  analyticsContentHint: 'Câu hỏi có vẻ lỗi nội dung, không phải lỗi của bạn.',
  analyticsCompetition: 'Thi đấu',
  analyticsCompetitionEmpty: 'Chưa có trận đấu nào.',

  colWord: 'Từ',
  colAttempts: 'Số lần',
  colAccuracy: 'Đúng',
  colTime: 'Thời gian',
  colStatus: 'Trạng thái',
  colQuestion: 'Câu hỏi',
  colLesson: 'Bài',
  colDistractor: 'Hay chọn sai',
  colProgress: 'Tiến độ',
  colRetries: 'Lượt thử',
  colScore: 'Điểm',

  insightWeakTopic: (topic) => `Chủ đề "${topic}" còn yếu`,
  insightWeakVocabulary: 'Từ vựng hay sai',
  insightForgottenVocabulary: 'Từ vựng dễ quên',
  insightWeakExercise: 'Dạng bài chưa vững',
  insightHardQuestion: 'Câu hỏi khó',
  insightSlowQuestion: 'Câu hỏi mất thời gian',
  insightAbandonedLesson: 'Bài học bỏ dở',
  insightRetryLesson: 'Bài học phải làm lại',
  insightRepeatedMistake: 'Lỗi sai lặp lại',
  insightAccuracyDrop: 'Độ chính xác giảm',
  insightAccuracyGain: 'Độ chính xác tăng',
  insightDuelAccuracy: 'Thi đấu còn yếu',
  insightInactive: 'Ít hoạt động',
  insightContentError: 'Câu hỏi có thể sai nội dung',
  insightContentMissing: 'Câu hỏi thiếu đáp án đúng',

  contentNoCorrect: 'Không có đáp án đúng',
  contentMultipleCorrect: 'Nhiều đáp án đúng',
  contentTooHard: 'Gần như ai cũng sai',

  statusNew: 'Mới',
  statusLearning: 'Đang học',
  statusReview: 'Cần ôn',
  statusMastered: 'Đã nhớ',

  unitAnswers: 'câu',
  unitMinutes: 'phút',
  unitDays: 'ngày',

  loading: 'Đang tải dữ liệu ôn tập…',
  error: 'Không tải được dữ liệu ôn tập.',
  retry: 'Thử lại',
}

const en: ReviewCopy = {
  eyebrow: 'PERSONAL REVIEW',
  title: 'Practise exactly what is weak',
  desc: 'The queue is built from your own mistakes: words you forget, hard questions and shaky exercise types. The learning path stays fixed; only practice adapts.',
  tabReview: 'To review',
  tabAnalytics: 'Analytics',

  dueTitle: (count) => count > 0 ? `${count} items waiting` : 'You are all caught up',
  dueBody: 'Every correct answer pushes the item further out. A wrong answer brings it back in 10 minutes.',
  dueEmptyTitle: 'Nothing to review yet',
  dueEmptyBody: 'Finish a lesson or a duel and the questions you miss land here automatically.',
  start: 'Start review',
  startEmpty: 'Nothing queued',
  sync: 'Scan past mistakes',
  syncing: 'Scanning…',
  syncDone: (added) => added > 0 ? `Added ${added} items from your history.` : 'No past mistakes to add.',

  statDue: 'Due',
  statWords: 'Words',
  statQuestions: 'Questions',
  statTotal: 'Total',
  statStreak: 'Streak',

  queueTitle: 'Due now',
  queueHint: 'Ordered by difficulty and how often you forgot it.',
  upcomingTitle: 'Upcoming',
  upcomingHint: 'Scheduled, not due yet.',
  wordLabel: 'Vocabulary',
  questionLabel: 'Question',
  dueNow: 'Due now',
  inDays: (days) => `in ${days} days`,
  inHours: (hours) => `in ${hours} hours`,
  inMinutes: (minutes) => `in ${minutes} minutes`,
  lapses: (count) => `forgot ${count}×`,

  sessionTitle: 'Review session',
  sessionClose: 'Close',
  sessionRecallWord: 'Write the English word',
  sessionRecallWordHint: 'The Vietnamese meaning is above. Type the matching English word.',
  sessionRecallQuestion: 'Pick the correct answer',
  sessionRecallQuestionHint: 'You missed this question before.',
  sessionCheck: 'Check',
  sessionChecking: 'Checking…',
  sessionNext: 'Continue',
  sessionFinish: 'See results',
  sessionCorrect: 'Correct',
  sessionWrong: 'Not quite',
  sessionAnswerWas: (answer) => `Correct answer: ${answer}`,
  sessionTypedPlaceholder: 'Type your answer…',
  sessionSummary: (correct, total) => `You answered ${correct}/${total} correctly.`,
  sessionDone: 'Session complete',
  sessionDoneBody: 'Correct items moved further out. Missed items come back in 10 minutes.',
  sessionAgain: 'Keep reviewing',
  sessionEmpty: 'Nothing due right now.',
  noItemsTitle: 'Nothing to review yet',
  noItemsBody: 'Miss a question or a word and it will show up here for a redo.',

  analyticsTitle: 'Learning data',
  analyticsAccuracy30: 'Accuracy, 30 days',
  analyticsAnswers30: 'Answers',
  analyticsMinutes30: 'Minutes studied',
  analyticsActiveDays: 'Active days',
  analyticsTrendUp: 'up',
  analyticsTrendDown: 'down',
  analyticsTrendFlat: 'flat',
  analyticsNoTrend: 'not enough data',
  analyticsActivity: '30-day rhythm',
  analyticsActivityHint: 'Answers per day. A taller bar means a heavier day.',
  analyticsInsights: 'Worth noticing',
  analyticsInsightsEmpty: 'Not enough data for insights yet.',
  analyticsInsightsHint: 'Ordered by priority: knowledge gaps first, habits second.',
  analyticsVocabulary: 'Vocabulary',
  analyticsVocabularyHint: 'Words you miss and words you have not seen in a while.',
  analyticsVocabularyEmpty: 'No vocabulary data yet. Play a Word Battle to start.',
  analyticsQuestions: 'Hard questions',
  analyticsQuestionsHint: 'The questions you miss most, with the answers that trip you up.',
  analyticsQuestionsEmpty: 'No question needs attention.',
  analyticsExercises: 'Exercise types',
  analyticsExercisesHint: 'Accuracy per question type.',
  analyticsExercisesEmpty: 'No exercise data yet.',
  analyticsLessons: 'Lessons',
  analyticsLessonsHint: 'Lessons you opened, including ones left unfinished.',
  analyticsLessonsEmpty: 'No lesson opened yet.',
  analyticsContent: 'Content flags',
  analyticsContentHint: 'Questions that look broken rather than hard.',
  analyticsCompetition: 'Competition',
  analyticsCompetitionEmpty: 'No matches played yet.',

  colWord: 'Word',
  colAttempts: 'Tries',
  colAccuracy: 'Hit',
  colTime: 'Time',
  colStatus: 'Status',
  colQuestion: 'Question',
  colLesson: 'Lesson',
  colDistractor: 'Often picked',
  colProgress: 'Progress',
  colRetries: 'Tries',
  colScore: 'Score',

  insightWeakTopic: (topic) => `Topic "${topic}" is weak`,
  insightWeakVocabulary: 'Word often missed',
  insightForgottenVocabulary: 'Word easily forgotten',
  insightWeakExercise: 'Shaky exercise type',
  insightHardQuestion: 'Hard question',
  insightSlowQuestion: 'Slow question',
  insightAbandonedLesson: 'Lesson abandoned',
  insightRetryLesson: 'Lesson retried',
  insightRepeatedMistake: 'Repeated mistake',
  insightAccuracyDrop: 'Accuracy dropped',
  insightAccuracyGain: 'Accuracy improved',
  insightDuelAccuracy: 'Duels still weak',
  insightInactive: 'Low activity',
  insightContentError: 'Question may be broken',
  insightContentMissing: 'Question has no answer key',

  contentNoCorrect: 'No correct answer',
  contentMultipleCorrect: 'Multiple correct answers',
  contentTooHard: 'Almost everyone misses it',

  statusNew: 'New',
  statusLearning: 'Learning',
  statusReview: 'Needs review',
  statusMastered: 'Remembered',

  unitAnswers: 'answers',
  unitMinutes: 'min',
  unitDays: 'days',

  loading: 'Loading review data…',
  error: 'Could not load review data.',
  retry: 'Retry',
}

export const reviewCopy = { vi, en } as const

export function copyFor(lang: 'vi' | 'en'): ReviewCopy {
  return lang === 'en' ? en : vi
}
