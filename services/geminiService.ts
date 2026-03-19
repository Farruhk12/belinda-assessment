import { GoogleGenAI, Type } from "@google/genai";

// API key must be used directly in initialization as per guidelines

interface GeneratedQuestionRaw {
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'OPEN_ENDED';
  options: string[];
  correctIndices: number[];
}

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export const generateQuizFromPDF = async (
  pdfBase64: string,
  testCount: number,
  openCount: number,
  topicInfo: { group: string; product: string }
): Promise<GeneratedQuestionRaw[]> => {
  // Fix: Initializing GoogleGenAI with named parameter and direct process.env.API_KEY reference
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Ты — эксперт по обучению персонала. Проанализируй приложенную инструкцию и создай аттестационный тест.
    
    Контекст:
    Группа/Отдел: ${topicInfo.group}
    Продукт: ${topicInfo.product}
    
    КРИТИЧЕСКИ ВАЖНО — двуязычный формат:
    Каждый вопрос и каждый вариант ответа ОБЯЗАТЕЛЬНО в формате: "Русский текст / Текст на таджикском"
    Разделитель — " / " (пробел, слэш, пробел). Пример: "В течение 6 часов / Дар давоми 6 соат"
    
    Требования:
    1. Создай ровно ${testCount} тестовых заданий (SINGLE_CHOICE или MULTIPLE_CHOICE).
    2. Создай ровно ${openCount} открытых вопросов (OPEN_ENDED).
    3. Вопросы должны проверять знание документа.
    4. Для тестов — 4 варианта, correctIndices — индексы верных (с 0).
    5. Для OPEN_ENDED — options: [], correctIndices: []
  `;

  const pdfPart = {
    inlineData: {
      data: pdfBase64,
      mimeType: "application/pdf"
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Complex text tasks require gemini-3-pro-preview
      contents: [
        { parts: [pdfPart, { text: prompt }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'OPEN_ENDED'] },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4 варианта для тестов, пустой массив для OPEN_ENDED" },
              correctIndices: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "Индексы верных ответов для тестов, пустой массив для OPEN_ENDED" }
            },
            required: ["text", "type", "options", "correctIndices"]
          }
        }
      }
    });

    // Fix: Using .text property directly from response
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini PDF Error:", error);
    throw error;
  }
};

const difficultyLabels: Record<DifficultyLevel, string> = {
  easy: 'лёгкий (базовые факты, простые формулировки)',
  medium: 'средний (требует понимания материала)',
  hard: 'сложный (детали, нюансы, практическое применение)'
};

export const generateQuizFromText = async (
  sourceText: string,
  testCount: number,
  openCount: number,
  difficulty: DifficultyLevel,
  topicInfo: { group: string; product: string }
): Promise<GeneratedQuestionRaw[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });

  const prompt = `
Ты — эксперт по обучению персонала. На основе приведённого текста создай аттестационные вопросы.

Контекст:
Группа/Отдел: ${topicInfo.group}
Продукт: ${topicInfo.product}
Уровень сложности: ${difficultyLabels[difficulty]}

КРИТИЧЕСКИ ВАЖНО — двуязычный формат:
1. Каждый вопрос и каждый вариант ответа ОБЯЗАТЕЛЬНО пиши в формате: "Русский текст / Текст на таджикском"
2. Разделитель — " / " (пробел, слэш, пробел). Пример вопроса: "В течение какого времени после приема препарата? / Пас аз қабули доруи чанд вақт?"
3. Пример варианта ответа: "В течение 6 часов / Дар давоми 6 соат"
4. Таджикский перевод должен быть грамотным, на литературном таджикском.

Требования:
1. Создай ровно ${testCount} тестовых заданий (SINGLE_CHOICE или MULTIPLE_CHOICE).
2. Создай ровно ${openCount} открытых вопросов (OPEN_ENDED).
3. Вопросы должны соответствовать уровню сложности: ${difficultyLabels[difficulty]}
4. Вопросы должны проверять знание материала из текста.
5. Для тестов — 4 варианта ответа, укажи correctIndices (индексы верных, с 0).
6. Для OPEN_ENDED — options: [], correctIndices: []

Исходный текст:
---
${sourceText}
---
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "Вопрос в формате: Русский / Таджикский" },
              type: { type: Type.STRING, enum: ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'OPEN_ENDED'] },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4 варианта в формате Русский / Таджикский для тестов, [] для OPEN_ENDED" },
              correctIndices: { type: Type.ARRAY, items: { type: Type.NUMBER } }
            },
            required: ["text", "type", "options", "correctIndices"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Text Error:", error);
    throw error;
  }
};

export interface AnswerEvaluation {
  score: number;
  comment: string;
}

/** Оценивает ответ сотрудника и предлагает балл (0–5) и комментарий на русском и таджикском */
export const evaluateAnswerWithAI = async (
  questionText: string,
  userAnswer: string
): Promise<AnswerEvaluation> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });

  const prompt = `
Ты — эксперт по оценке ответов сотрудников на аттестационных тестах. Оцени ответ сотрудника на открытый вопрос.

Вопрос (может быть на русском и таджикском):
---
${questionText}
---

Ответ сотрудника:
---
${userAnswer || '(пусто)'}
---

Задача:
1. Оцени ответ по шкале от 0 до 5: 0 — плохо/не по теме, 5 — отлично/полный правильный ответ.
2. Напиши краткий комментарий к оценке в формате: "Русский текст / Текст на таджикском"
   Разделитель — " / " (пробел, слэш, пробел). Объясни, почему выставлен такой балл. Комментарий видят сотрудники — пиши конструктивно.
3. Таджикский перевод должен быть грамотным, на литературном таджикском.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "Балл от 0 до 5" },
            comment: { type: Type.STRING, description: "Комментарий в формате: Русский текст / Текст на таджикском" }
          },
          required: ["score", "comment"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    const score = Math.max(0, Math.min(5, Math.round(Number(parsed.score) || 0)));
    return { score, comment: String(parsed.comment || "").trim() };
  } catch (error) {
    console.error("Gemini Evaluate Error:", error);
    throw error;
  }
};

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

/** Генерирует краткую аналитику по результатам сотрудника: сильные стороны, слабые, рекомендации */
export const generateEmployeeAnalytics = async (
  employeeName: string,
  avgScore: number,
  questionPerformances: QuestionPerformance[]
): Promise<EmployeeAnalyticsReport> => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY не настроен");
  }

  const ai = new GoogleGenAI({ apiKey });

  const performanceSummary = questionPerformances.map((p, i) => {
    const status = p.correct ? "верно" : (p.score !== undefined ? `балл ${p.score}/${p.maxScore ?? 5}` : "неверно");
    const qText = p.questionText.length > 120 ? p.questionText.substring(0, 120) + "..." : p.questionText;
    return `${i + 1}. [${p.quizTitle}] ${qText} — ${status}`;
  }).join("\n");

  const prompt = `
Ты — эксперт по обучению персонала. Проанализируй результаты аттестаций сотрудника и составь краткий отчёт.

Сотрудник: ${employeeName}
Средний балл: ${avgScore}%

Детализация по вопросам:
---
${performanceSummary || "(нет данных по отдельным вопросам)"}
---

Задача: составь КРАТКИЙ отчёт на русском языке (2–4 пункта в каждом блоке).

1. strengths — в каких темах/вопросах сотрудник силён (где отвечал верно).
2. weaknesses — в каких темах/вопросах слаб (ошибки, низкие баллы).
3. recommendations — конкретные рекомендации: на что сделать акцент, что повторить, что изучить.

Будь конкретным: ссылайся на темы из вопросов. Пиши кратко, по делу.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Сильные стороны, 2-4 пункта" },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Слабые стороны, 2-4 пункта" },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Рекомендации, 2-4 пункта" }
          },
          required: ["strengths", "weaknesses", "recommendations"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return {
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter(Boolean) : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter(Boolean) : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.filter(Boolean) : []
    };
  } catch (error) {
    console.error("Gemini Analytics Error:", error);
    throw error;
  }
};