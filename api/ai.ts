import { authenticate, requireAdmin } from './_lib/auth.js';
import { generateQuizFromPDF, generateQuizFromText, evaluateAnswerWithAI, generateEmployeeAnalytics } from './_lib/gemini.js';
import { HttpError, handle, readBody, requireMethod } from './_lib/http.js';

// Вызовы Gemini выполняются на сервере, чтобы ключ не попадал в браузер
const functions: Record<string, { adminOnly: boolean; run: (...args: any[]) => Promise<unknown> }> = {
  generateQuizFromPDF: { adminOnly: true, run: generateQuizFromPDF },
  generateQuizFromText: { adminOnly: true, run: generateQuizFromText },
  evaluateAnswerWithAI: { adminOnly: true, run: evaluateAnswerWithAI },
  generateEmployeeAnalytics: { adminOnly: false, run: generateEmployeeAnalytics }
};

export default handle(async req => {
  requireMethod(req, 'POST');
  const user = await authenticate(req);
  const { fn, args } = await readBody(req);
  const target = typeof fn === 'string' && Object.hasOwn(functions, fn) ? functions[fn] : null;
  if (!target) throw new HttpError(400, 'Unknown function');
  if (target.adminOnly) requireAdmin(user);
  return target.run(...(Array.isArray(args) ? args : []));
});
