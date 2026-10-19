
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Quiz, AttemptResult, Employee, Position, Assignment } from '../types';
import { api, ApiError, getToken, setToken, onUnauthorized } from '../services/api';
import { useUi } from './UiContext';
import { employeeGroups } from '../api/_lib/groups';

export type UserRole = 'admin' | 'employee' | 'manager';

const REFRESH_INTERVAL_MS = 60_000;

interface StoreContextType {
  quizzes: Quiz[];
  sessions: Quiz[];
  results: AttemptResult[];
  employees: Employee[];
  positions: Position[];
  assignments: Assignment[];
  currentUser: Employee | null;
  currentRole: UserRole;
  isLoading: boolean;
  loadError: string | null;
  /** текущее время по часам сервера */
  now: () => number;
  refresh: () => Promise<void>;
  loginUser: (login: string, pass: string) => Promise<boolean>;
  logoutUser: () => void;
  addQuiz: (quiz: Quiz) => void;
  updateQuiz: (id: string, quiz: Quiz) => void;
  deleteQuiz: (id: string) => void;
  addSession: (session: Quiz) => void;
  updateSession: (id: string, session: Quiz) => void;
  deleteSession: (id: string) => void;
  /** добавляет в состояние результат, уже сохранённый сервером при завершении попытки */
  applyResult: (result: AttemptResult) => void;
  updateResult: (id: string, updates: Partial<AttemptResult>) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, employee: Employee) => void;
  deleteEmployee: (id: string) => void;
  addPosition: (name: string) => void;
  deletePosition: (id: string) => void;
  addAssignment: (assignment: Assignment) => void;
  deleteAssignment: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const parseList = (v: any): string[] | null => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return null;
};

// Пустые поля в базе могут отсутствовать совсем, поэтому все текстовые поля, с которыми работает интерфейс, приводятся к строкам
const text = (v: unknown) => String(v ?? '');

const normalizeQuiz = (q: any): Quiz => ({
  ...q,
  title: text(q.title),
  group: text(q.group),
  product: text(q.product),
  category: text(q.category),
  description: text(q.description),
  questions: Array.isArray(q.questions) ? q.questions : []
});

const normalizeResult = (r: any): AttemptResult => ({
  ...r,
  quizTitle: text(r.quizTitle),
  answers: r.answers && typeof r.answers === 'object' ? r.answers : {},
  percentage: Number(r.percentage) || 0,
  score: Number(r.score) || 0,
  maxPossibleScore: Number(r.maxPossibleScore) || 0
});

const normalizeEmployee = (e: any): Employee => ({
  ...e,
  fullName: text(e.fullName),
  login: text(e.login),
  group: text(e.group),
  area: text(e.area),
  positionId: text(e.positionId),
  managedAreas: parseList(e.managedAreas) ?? (e.managedArea ? [e.managedArea] : []),
  managedGroups: parseList(e.managedGroups) ?? [],
  groups: employeeGroups(e)
});

// пароль нужен только для отправки на сервер и не должен оставаться в состоянии
const withoutPassword = ({ password, ...rest }: Employee): Employee => rest;

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { notify } = useUi();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [sessions, setSessions] = useState<Quiz[]>([]);
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(() => !!getToken());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const clockOffset = useRef(0);
  const pendingWrites = useRef(0);
  const writeVersion = useRef(0);

  const resetState = () => {
    setQuizzes([]); setSessions([]); setResults([]); setEmployees([]);
    setPositions([]); setAssignments([]); setCurrentUser(null);
  };

  const logoutUser = useCallback(() => {
    setToken(null);
    resetState();
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    const versionAtStart = writeVersion.current;
    try {
      const data: any = await api.get('/api/data');
      // ответ мог быть снят до сохранения: он затёр бы только что добавленные данные
      if (pendingWrites.current > 0 || writeVersion.current !== versionAtStart) return;
      clockOffset.current = (data.serverNow || Date.now()) - Date.now();
      setQuizzes((data.quizzes || []).map(normalizeQuiz));
      setSessions((data.sessions || []).map(normalizeQuiz));
      setResults((data.results || []).map(normalizeResult));
      setEmployees((data.employees || []).map(normalizeEmployee));
      setPositions(data.positions || []);
      setAssignments(data.assignments || []);
      if (data.me) setCurrentUser(normalizeEmployee(data.me));
      setLoadError(null);
    } catch (e) {
      // при 401 сессия сбрасывается через onUnauthorized
      if (!(e instanceof ApiError && e.status === 401)) {
        setLoadError(e instanceof ApiError ? e.message : 'Не удалось загрузить данные');
      }
    }
  }, []);

  // первая загрузка, если уже есть сохранённая сессия
  useEffect(() => {
    if (!getToken()) return;
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  useEffect(() => onUnauthorized(logoutUser), [logoutUser]);

  // данные обновляются в фоне, чтобы несколько пользователей видели изменения друг друга
  useEffect(() => {
    if (!currentUser) return;
    const tick = () => {
      if (document.visibilityState === 'visible' && pendingWrites.current === 0) refresh();
    };
    const timer = window.setInterval(tick, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, [currentUser?.id, refresh]);

  // изменения применяются сразу; если сервер отказал, пользователь видит ошибку и данные перечитываются
  const persist = async (action: 'save' | 'delete', sheet: string, data: any, id?: string) => {
    pendingWrites.current++;
    writeVersion.current++;
    let failed = false;
    try {
      await api.post('/api/data', { action, sheet, data, id });
    } catch (e) {
      failed = true;
      notify(`Не удалось сохранить изменения: ${e instanceof Error ? e.message : 'ошибка'}`);
    } finally {
      pendingWrites.current--;
    }
    if (failed) await refresh();
  };

  const loginUser = async (login: string, pass: string): Promise<boolean> => {
    const { token } = await api.post<{ token: string }>('/api/auth', { login, password: pass });
    setToken(token);
    setIsLoading(true);
    await refresh();
    setIsLoading(false);
    return true;
  };

  const currentRole: UserRole = currentUser?.role || 'employee';

  const addQuiz = (quiz: Quiz) => {
    setQuizzes(prev => [quiz, ...prev]);
    persist('save', 'Quizzes', quiz);
  };

  const updateQuiz = (id: string, updatedQuiz: Quiz) => {
    setQuizzes(prev => prev.map(q => q.id === id ? updatedQuiz : q));
    persist('save', 'Quizzes', updatedQuiz);
  };

  const deleteQuiz = (id: string) => {
    setQuizzes(prev => prev.filter(q => q.id !== id));
    persist('delete', 'Quizzes', null, id);
  };

  const addSession = (session: Quiz) => {
    setSessions(prev => [session, ...prev]);
    persist('save', 'Sessions', session);
  };

  const updateSession = (id: string, updatedSession: Quiz) => {
    setSessions(prev => prev.map(s => s.id === id ? updatedSession : s));
    persist('save', 'Sessions', updatedSession);
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    persist('delete', 'Sessions', null, id);
  };

  const applyResult = (result: AttemptResult) => {
    setResults(prev => [result, ...prev.filter(r => r.id !== result.id)]);
    setAssignments(prev => prev.filter(a => !(a.isRetake && String(a.quizId) === String(result.quizId) && String(a.targetEmployeeId) === String(result.userId))));
  };

  const updateResult = (id: string, updates: Partial<AttemptResult>) => {
    const target = results.find(r => r.id === id);
    if (!target) return;
    const updated = { ...target, ...updates };
    setResults(prev => prev.map(r => r.id === id ? updated : r));
    persist('save', 'Results', updated);
  };

  const addEmployee = (emp: Employee) => {
    setEmployees(prev => [withoutPassword(emp), ...prev]);
    persist('save', 'Employees', emp);
  };

  const updateEmployee = (id: string, emp: Employee) => {
    setEmployees(prev => prev.map(e => e.id === id ? withoutPassword(emp) : e));
    persist('save', 'Employees', emp);
  };

  const deleteEmployee = (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    persist('delete', 'Employees', null, id);
  };

  const addPosition = (name: string) => {
    const newPos = { id: `pos-${Date.now()}`, name };
    setPositions(prev => [...prev, newPos]);
    persist('save', 'Positions', newPos);
  };

  const deletePosition = (id: string) => {
    setPositions(prev => prev.filter(p => p.id !== id));
    persist('delete', 'Positions', null, id);
  };

  const addAssignment = (asgn: Assignment) => {
    setAssignments(prev => [asgn, ...prev]);
    persist('save', 'Assignments', asgn);
  };

  const deleteAssignment = (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
    persist('delete', 'Assignments', null, id);
  };

  const now = useCallback(() => Date.now() + clockOffset.current, []);

  return (
    <StoreContext.Provider value={{
      quizzes, sessions, results, employees, positions, assignments,
      currentUser, currentRole, isLoading, loadError, now, refresh,
      loginUser, logoutUser, addQuiz, updateQuiz, deleteQuiz,
      addSession, updateSession, deleteSession,
      applyResult, updateResult,
      addEmployee, updateEmployee, deleteEmployee, addPosition, deletePosition,
      addAssignment, deleteAssignment
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
};
