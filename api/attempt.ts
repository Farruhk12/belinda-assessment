import { TABLES, attempts, getDoc, listDocs, putDoc, deleteDoc } from './_lib/db.js';
import { authenticate } from './_lib/auth.js';
import { assignmentApplies } from './_lib/scope.js';
import { MAX_VIOLATIONS, buildResult, questionCredit, isChoice, isExpired, normalizeChoice, stripAnswers } from './_lib/scoring.js';
import { HttpError, handle, readBody, requireMethod } from './_lib/http.js';

const MAX_TEXT = 5000;

// Что известно клиенту о проверенных вопросах (правильные ответы раскрываются только после проверки)
const revealChecked = (attempt: any, session: any) => {
  const out: Record<string, any> = {};
  for (const q of session.questions || []) {
    const c = attempt.checked?.[q.id];
    if (!c) continue;
    out[q.id] = c.manual ? { manual: true } : { correct: c.correct, credit: c.credit ?? (c.correct ? 1 : 0), correctAnswers: q.correctAnswers || [] };
  }
  return out;
};

const view = (attempt: any, session: any) => ({
  attemptId: attempt.id,
  startedAt: attempt.startedAt,
  serverNow: Date.now(),
  session: stripAnswers(session),
  answers: attempt.answers || {},
  checked: revealChecked(attempt, session),
  violations: attempt.violations || 0
});

// Завершает попытку и сохраняет результат (повторный вызов вернёт тот же результат)
const finalize = async (attempt: any, session: any, disqualified = false) => {
  if (attempt.finished) return getDoc(TABLES.Results, attempt.resultId);
  const result = buildResult(attempt, session, disqualified, Date.now());
  attempt.finished = true;
  attempt.resultId = result.id;
  await putDoc(TABLES.Results, result);
  await attempts.put(attempt);

  // пересдача использована: убираем назначение
  const assignments = await listDocs(TABLES.Assignments);
  await Promise.all(assignments
    .filter(a => a.isRetake && String(a.quizId) === String(session.id) && String(a.targetEmployeeId) === String(attempt.userId))
    .map(a => deleteDoc(TABLES.Assignments, a.id)));
  return result;
};

const loadOwned = async (user: any, attemptId: unknown) => {
  const attempt = await attempts.get(String(attemptId));
  if (!attempt || String(attempt.userId) !== String(user.id)) throw new HttpError(404, 'Попытка не найдена');
  const session = await getDoc(TABLES.Sessions, attempt.sessionId);
  if (!session) throw new HttpError(404, 'Аттестация не найдена');
  return { attempt, session };
};

const start = async (user: any, sessionId: unknown) => {
  const session = await getDoc(TABLES.Sessions, sessionId);
  if (!session) throw new HttpError(404, 'Аттестация не найдена');
  const now = Date.now();

  const open = await attempts.findOpen(session.id, user.id);
  if (open) {
    if (isExpired(open, session, now)) return { finished: true, result: await finalize(open, session) };
    return view(open, session);
  }

  if (user.role !== 'admin') {
    if ((session.availableFrom && now < session.availableFrom) || (session.availableUntil && now > session.availableUntil)) {
      throw new HttpError(403, 'Аттестация сейчас недоступна');
    }
    const [assignments, results] = await Promise.all([listDocs(TABLES.Assignments), listDocs(TABLES.Results)]);
    const mine = assignments.filter(a => String(a.quizId) === String(session.id) && assignmentApplies(a, user));
    if (mine.length === 0) throw new HttpError(403, 'Эта аттестация вам не назначена');
    const done = results.some(r => String(r.quizId) === String(session.id) && String(r.userId) === String(user.id));
    if (done && !mine.some(a => a.isRetake)) throw new HttpError(403, 'Вы уже прошли эту аттестацию');
  }

  const attempt = {
    id: `att-${now}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: String(session.id), userId: String(user.id), startedAt: now,
    answers: {}, checked: {}, violations: 0, logs: [], finished: false
  };
  await attempts.put(attempt);
  return view(attempt, session);
};

const check = async (user: any, body: any) => {
  const { attempt, session } = await loadOwned(user, body.attemptId);
  if (attempt.finished) return { finished: true, result: await getDoc(TABLES.Results, attempt.resultId) };
  if (isExpired(attempt, session, Date.now())) return { finished: true, result: await finalize(attempt, session) };

  const q = (session.questions || []).find((x: any) => String(x.id) === String(body.questionId));
  if (!q) throw new HttpError(400, 'Вопрос не найден');

  // ответ на проверенный вопрос изменить нельзя
  const prev = attempt.checked[q.id];
  if (prev) return prev.manual ? { manual: true } : { correct: prev.correct, credit: prev.credit ?? (prev.correct ? 1 : 0), correctAnswers: q.correctAnswers || [] };

  if (isChoice(q)) {
    const selected = normalizeChoice(body.answer, (q.options || []).length);
    if (!selected || selected.length === 0) throw new HttpError(400, 'Выберите вариант ответа');
    const credit = Math.round(questionCredit(q, selected) * 100) / 100;
    const correct = credit === 1;
    attempt.answers[q.id] = selected;
    attempt.checked[q.id] = { correct, credit };
    await attempts.put(attempt);
    return { correct, credit, correctAnswers: q.correctAnswers || [] };
  }

  if (q.type === 'RANGE') {
    const a = body.answer || {};
    attempt.answers[q.id] = { from: String(a.from ?? '').slice(0, 50), to: String(a.to ?? '').slice(0, 50) };
  } else {
    attempt.answers[q.id] = String(body.answer ?? '').slice(0, MAX_TEXT);
  }
  attempt.checked[q.id] = { manual: true };
  await attempts.put(attempt);
  return { manual: true };
};

const violation = async (user: any, body: any) => {
  const { attempt, session } = await loadOwned(user, body.attemptId);
  if (attempt.finished) return { finished: true, result: await getDoc(TABLES.Results, attempt.resultId) };

  const message = body.reason === 'paste' ? 'Вы вставили скопированный текст' : 'Вы свернули вкладку или переключили окно';
  attempt.violations = (attempt.violations || 0) + 1;
  attempt.logs = [...(attempt.logs || []), `${new Date().toLocaleTimeString('ru-RU', { timeZone: 'Asia/Dushanbe' })}: ${message}`];

  if (attempt.violations > MAX_VIOLATIONS) {
    return { violations: attempt.violations, finished: true, result: await finalize(attempt, session, true) };
  }
  await attempts.put(attempt);
  return { violations: attempt.violations };
};

const finish = async (user: any, body: any) => {
  const { attempt, session } = await loadOwned(user, body.attemptId);
  if (attempt.finished) return { finished: true, result: await getDoc(TABLES.Results, attempt.resultId) };

  // черновик открытого ответа, который не успели проверить (например, закончилось время)
  const draft = body.draft;
  if (draft && !attempt.checked[draft.questionId]) {
    const q = (session.questions || []).find((x: any) => String(x.id) === String(draft.questionId));
    if (q?.type === 'OPEN_ENDED') attempt.answers[q.id] = String(draft.answer ?? '').slice(0, MAX_TEXT);
  }
  return { finished: true, result: await finalize(attempt, session) };
};

export default handle(async req => {
  requireMethod(req, 'POST');
  const user = await authenticate(req);
  const body = await readBody(req);
  switch (body.action) {
    case 'start': return start(user, body.sessionId);
    case 'check': return check(user, body);
    case 'violation': return violation(user, body);
    case 'finish': return finish(user, body);
    default: throw new HttpError(400, 'Unknown action');
  }
});
