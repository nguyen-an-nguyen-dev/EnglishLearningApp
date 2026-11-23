export const LESSON_MAX_HEARTS = 3

export interface QueueEntry<Q> {
  question: Q
  attempt: number
}

/**
 * A lesson run as Duolingo-style practice: a queue of questions, three hearts,
 * and a run that ends either cleared or out of hearts. A miss costs a heart at
 * the moment the learner sees the verdict, and sends the question to the back
 * of the queue, so a mistake never restarts the lesson.
 */
export interface LessonRun<Q> {
  queue: QueueEntry<Q>[]
  hearts: number
  total: number
  status: 'active' | 'cleared' | 'failed'
}

export function startLessonRun<Q>(questions: Q[]): LessonRun<Q> {
  return {
    queue: questions.map((question) => ({ question, attempt: 1 })),
    hearts: LESSON_MAX_HEARTS,
    total: questions.length,
    status: questions.length > 0 ? 'active' : 'cleared',
  }
}

/**
 * Spend one heart. The run stays active on the last miss so the feedback that
 * explains the right answer is still on screen; the failure lands on advance.
 */
export function loseHeart<Q>(run: LessonRun<Q>): LessonRun<Q> {
  if (run.status !== 'active' || run.hearts <= 0) return run
  return { ...run, hearts: run.hearts - 1 }
}

/** How many questions a missed one waits before it comes back. */
export const LESSON_REQUEUE_GAP = 3

/**
 * Move past the question on screen: a correct answer clears it, a wrong one
 * requeues it a few slots later — far enough to be a fresh recall, near enough
 * that a three-heart run actually gets to see the repeat. With no hearts left,
 * a miss ends the run.
 */
export function advanceLessonRun<Q>(
  run: LessonRun<Q>,
  isCorrect: boolean,
): LessonRun<Q> {
  const [current, ...rest] = run.queue
  if (!current || run.status !== 'active') return run

  if (!isCorrect) {
    if (run.hearts <= 0) return { ...run, status: 'failed' }
    const gap = Math.min(LESSON_REQUEUE_GAP, rest.length)
    return {
      ...run,
      queue: [
        ...rest.slice(0, gap),
        { question: current.question, attempt: current.attempt + 1 },
        ...rest.slice(gap),
      ],
    }
  }

  return { ...run, queue: rest, status: rest.length === 0 ? 'cleared' : 'active' }
}

/** Questions resolved for good. Repeats still in the queue do not count. */
export function clearedQuestionCount<Q extends { id: number }>(run: LessonRun<Q>): number {
  const pending = new Set(run.queue.map((entry) => entry.question.id)).size
  return Math.max(0, run.total - pending)
}
