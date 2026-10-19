export const MAX_VIOLATIONS = 3;

export const isChoice = (q: any) => q?.type === 'SINGLE_CHOICE' || q?.type === 'MULTIPLE_CHOICE';
export const isManual = (q: any) => q?.type === 'OPEN_ENDED' || q?.type === 'RANGE';

// Приводит ответ клиента к списку уникальных допустимых индексов; null если ответ некорректен
export const normalizeChoice = (answer: unknown, optionsCount: number): number[] | null => {
  if (!Array.isArray(answer)) return null;
  const out = [...new Set(answer)];
  if (!out.every(i => Number.isInteger(i) && i >= 0 && i < optionsCount)) return null;
  return out as number[];
};

// Доля баллов за вопрос (0..1). Одиночный выбор — всё или ничего.
// Множественный: (верно выбранные − лишние) / число верных, не меньше 0,
// поэтому выбор всех вариантов подряд не даёт баллов.
export const questionCredit = (q: any, selected: number[]): number => {
  const correct: number[] = Array.isArray(q.correctAnswers) ? q.correctAnswers : [];
  if (q.type === 'SINGLE_CHOICE') return selected.length === 1 && selected[0] === correct[0] ? 1 : 0;
  if (correct.length === 0) return 0;
  const right = selected.filter(i => correct.includes(i)).length;
  const wrong = selected.length - right;
  return Math.max(0, (right - wrong) / correct.length);
};

export const isAnswerCorrect = (q: any, selected: number[]): boolean => questionCredit(q, selected) === 1;

const round2 = (n: number) => Math.round(n * 100) / 100;

export const percentage = (score: number, total: number) => (total > 0 ? Math.round((score / total) * 100) : 0);

export const isExpired = (attempt: any, session: any, now: number, graceMs = 5000) =>
  !!session.timeLimit && now > attempt.startedAt + Number(session.timeLimit) * 60000 + graceMs;

// Убирает правильные ответы из теста, который уходит клиенту
export const stripAnswers = (quiz: any) => ({
  ...quiz,
  questions: (Array.isArray(quiz.questions) ? quiz.questions : []).map(({ correctAnswers, ...q }: any) => q)
});

export const buildResult = (attempt: any, session: any, disqualified: boolean, now: number) => {
  const questions: any[] = Array.isArray(session.questions) ? session.questions : [];
  const creditOf = (c: any) => (typeof c?.credit === 'number' ? c.credit : c?.correct === true ? 1 : 0);
  const score = disqualified ? 0 : round2(questions.reduce((sum, q) => sum + creditOf(attempt.checked?.[q.id]), 0));
  const limitSec = session.timeLimit ? Number(session.timeLimit) * 60 : Infinity;
  return {
    id: `res-${now}-${Math.random().toString(36).slice(2, 7)}`,
    quizId: session.id,
    quizTitle: session.title,
    userId: attempt.userId,
    score,
    maxPossibleScore: questions.length,
    percentage: disqualified ? 0 : percentage(score, questions.length),
    date: now,
    status: questions.some(isManual) ? 'pending' : 'completed',
    answers: attempt.answers || {},
    manualScores: {},
    questions,
    violations: disqualified ? MAX_VIOLATIONS + 1 : attempt.violations || 0,
    violationDetails: attempt.logs || [],
    timeSpent: Math.min(Math.round((now - attempt.startedAt) / 1000), limitSec)
  };
};
