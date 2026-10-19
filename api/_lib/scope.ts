import { stripAnswers } from './scoring.js';
import { publicUser } from './auth.js';
import { assignmentApplies, teamOf } from './targeting.js';

export { assignmentApplies, teamOf };

export interface AllData {
  quizzes: any[]; sessions: any[]; results: any[]; employees: any[]; positions: any[]; assignments: any[];
}

// Что именно видит пользователь с данной ролью
export const buildPayload = (user: any, all: AllData): AllData => {
  const employees = all.employees.map(publicUser);
  if (user.role === 'admin') return { ...all, employees };

  const visibleIds = new Set([String(user.id)]);
  if (user.role === 'manager') teamOf(user, all.employees).forEach(e => visibleIds.add(String(e.id)));

  const assignments = all.assignments.filter(a => assignmentApplies(a, user));
  const results = all.results.filter(r => visibleIds.has(String(r.userId)));

  // сотруднику нужны только его аттестации (назначенные и уже пройденные), а не все сессии компании
  let sessions = all.sessions;
  if (user.role === 'employee') {
    const needed = new Set([...assignments.map(a => String(a.quizId)), ...results.map(r => String(r.quizId))]);
    sessions = sessions.filter(s => needed.has(String(s.id)));
  }

  return {
    employees: employees.filter(e => visibleIds.has(String(e.id))),
    results,
    sessions: sessions.map(stripAnswers),
    quizzes: user.role === 'manager' ? all.quizzes.map(stripAnswers) : [],
    positions: all.positions,
    assignments
  };
};
