import { api } from './api';

// Вызовы Gemini выполняются на сервере (/api/ai): ключ API в браузер не попадает

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface GeneratedQuestionRaw {
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'OPEN_ENDED';
  options: string[];
  correctIndices: number[];
}

export interface AnswerEvaluation {
  score: number;
  comment: string;
}

export interface EmployeeAnalyticsReport {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface QuestionPerformance {
  questionText: string;
  quizTitle: string;
  correct: boolean;
  score?: number;
  maxScore?: number;
}

const call = <T>(fn: string, ...args: unknown[]) => api.post<T>('/api/ai', { fn, args });

export const generateQuizFromPDF = (
  pdfBase64: string,
  testCount: number,
  openCount: number,
  topicInfo: { group: string; product: string }
) => call<GeneratedQuestionRaw[]>('generateQuizFromPDF', pdfBase64, testCount, openCount, topicInfo);

export const generateQuizFromText = (
  sourceText: string,
  testCount: number,
  openCount: number,
  difficulty: DifficultyLevel,
  topicInfo: { group: string; product: string }
) => call<GeneratedQuestionRaw[]>('generateQuizFromText', sourceText, testCount, openCount, difficulty, topicInfo);

/** Оценивает ответ сотрудника и предлагает балл (0–5) и комментарий на русском и таджикском */
export const evaluateAnswerWithAI = (questionText: string, userAnswer: string) =>
  call<AnswerEvaluation>('evaluateAnswerWithAI', questionText, userAnswer);

/** Генерирует краткую аналитику по результатам сотрудника: сильные стороны, слабые, рекомендации */
export const generateEmployeeAnalytics = (
  employeeName: string,
  avgScore: number,
  questionPerformances: QuestionPerformance[]
) => call<EmployeeAnalyticsReport>('generateEmployeeAnalytics', employeeName, avgScore, questionPerformances);
