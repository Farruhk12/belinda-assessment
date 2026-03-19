
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Quiz, AttemptResult, Employee, Position, Assignment } from '../types';

export type UserRole = 'admin' | 'employee' | 'manager';

const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwcXuKSw1jhJTieYEFZ9LsAtiLh_icGlOWbkpY6waTH8GgJPrLeFP4kspthoM7olQFu/exec';

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
  sheetsUrl: string;
  loginUser: (login: string, pass: string) => Promise<boolean>;
  logoutUser: () => void;
  addQuiz: (quiz: Quiz) => void;
  updateQuiz: (id: string, quiz: Quiz) => void;
  deleteQuiz: (id: string) => void;
  addSession: (session: Quiz) => void;
  updateSession: (id: string, session: Quiz) => void;
  deleteSession: (id: string) => void;
  saveResult: (result: AttemptResult) => void;
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

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sheetsUrl] = useState(() => (import.meta as any).env?.VITE_SHEETS_URL || DEFAULT_SHEETS_URL);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [sessions, setSessions] = useState<Quiz[]>([]);
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);

  useEffect(() => {
    if (!sheetsUrl) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const response = await fetch(sheetsUrl);
        const data = await response.json();
        
        // Маппинг и нормализация данных
        const normalizeQuiz = (q: any) => ({
          ...q,
          title: String(q.title || ''),
          group: String(q.group || ''),
          questions: Array.isArray(q.questions) ? q.questions : []
        });

        if (data.quizzes) setQuizzes(data.quizzes.map(normalizeQuiz));
        if (data.sessions) setSessions(data.sessions.map(normalizeQuiz));
        if (data.results) setResults(data.results);
        if (data.employees) {
          const normalizeEmployee = (e: any): Employee => ({
            ...e,
            managedAreas: Array.isArray(e.managedAreas) ? e.managedAreas : (typeof e.managedAreas === 'string' ? (() => { try { const p = JSON.parse(e.managedAreas); return Array.isArray(p) ? p : []; } catch { return []; } })() : (e.managedArea ? [e.managedArea] : [])),
            managedGroups: Array.isArray(e.managedGroups) ? e.managedGroups : (typeof e.managedGroups === 'string' ? (() => { try { const p = JSON.parse(e.managedGroups); return Array.isArray(p) ? p : []; } catch { return []; } })() : [])
          });
          let employeesList = data.employees.map(normalizeEmployee);
          try {
            const cached = JSON.parse(localStorage.getItem('belinda_employees_cache') || '{}');
            const cacheKeys = Object.keys(cached);
            if (cacheKeys.length > 0) {
              employeesList = employeesList.map((emp: Employee) => {
                const c = cached[emp.id];
                if (c && c._updated) {
                  return { ...emp, managedAreas: c.managedAreas ?? emp.managedAreas, managedGroups: c.managedGroups ?? emp.managedGroups };
                }
                return emp;
              });
            }
          } catch (_) {}
          setEmployees(employeesList);
          const savedId = localStorage.getItem('skillcheck_user_id');
          if (savedId) {
            const user = data.employees.find((e: Employee) => String(e.id) === String(savedId));
            if (user) {
              setCurrentUser(user);
            } else if (savedId === 'admin-init') {
              setCurrentUser({
                id: 'admin-init',
                fullName: 'Administrator',
                login: 'admin',
                group: 'Система',
                area: 'Центр',
                positionId: 'admin',
                role: 'admin',
                createdAt: Date.now()
              });
            }
          }
        }
        if (data.positions) setPositions(data.positions);
        if (data.assignments) setAssignments(data.assignments);
      } catch (e) {
        console.error("Fetch Error:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [sheetsUrl]);

  const syncToSheets = async (action: 'save' | 'delete', sheet: string, data: any, id?: string) => {
    if (!sheetsUrl) return;
    try {
      const body = JSON.stringify({ action, sheet, data, id });
      await fetch(sheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body
      });
      if (sheet === 'Employees' && data?.id) {
        try {
          const cached = JSON.parse(localStorage.getItem('belinda_employees_cache') || '{}');
          cached[data.id] = { ...data, _updated: Date.now() };
          localStorage.setItem('belinda_employees_cache', JSON.stringify(cached));
        } catch (_) {}
      }
    } catch (e) {
      console.error("Sync Error:", e);
    }
  };

  const loginUser = async (login: string, pass: string): Promise<boolean> => {
    const cleanLogin = login.trim();
    const cleanPass = pass.trim();

    const user = employees.find(e => 
      (String(e.login).trim() === cleanLogin || String(e.fullName).trim() === cleanLogin) && 
      String(e.password).trim() === cleanPass
    );

    if (user) {
      setCurrentUser(user);
      localStorage.setItem('skillcheck_user_id', user.id);
      return true;
    }

    if (employees.length === 0 && cleanLogin === 'admin' && cleanPass === 'admin') {
      const initAdmin: Employee = {
        id: 'admin-init',
        fullName: 'Administrator',
        login: 'admin',
        password: 'admin',
        group: 'Система',
        area: 'Центр',
        positionId: 'admin',
        role: 'admin',
        createdAt: Date.now()
      };
      setCurrentUser(initAdmin);
      localStorage.setItem('skillcheck_user_id', 'admin-init');
      return true;
    }

    return false;
  };

  const logoutUser = () => {
    setCurrentUser(null);
    localStorage.removeItem('skillcheck_user_id');
  };

  const currentRole: UserRole = currentUser?.role || 'employee';

  const addQuiz = (quiz: Quiz) => {
    setQuizzes(prev => [quiz, ...prev]);
    syncToSheets('save', 'Quizzes', quiz);
  };

  const updateQuiz = (id: string, updatedQuiz: Quiz) => {
    setQuizzes(prev => prev.map(q => q.id === id ? updatedQuiz : q));
    syncToSheets('save', 'Quizzes', updatedQuiz);
  };

  const deleteQuiz = (id: string) => {
    setQuizzes(prev => prev.filter(q => q.id !== id));
    syncToSheets('delete', 'Quizzes', null, id);
  };

  const addSession = (session: Quiz) => {
    setSessions(prev => [session, ...prev]);
    syncToSheets('save', 'Sessions', session);
  };

  const updateSession = (id: string, updatedSession: Quiz) => {
    setSessions(prev => prev.map(s => s.id === id ? updatedSession : s));
    syncToSheets('save', 'Sessions', updatedSession);
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    syncToSheets('delete', 'Sessions', null, id);
  };

  const saveResult = (result: AttemptResult) => {
    setResults(prev => [result, ...prev]);
    syncToSheets('save', 'Results', result);
    setAssignments(prev => {
      const toDelete = prev.filter(a => a.isRetake && String(a.quizId) === String(result.quizId) && String(a.targetEmployeeId) === String(result.userId));
      toDelete.forEach(a => syncToSheets('delete', 'Assignments', null, a.id));
      return prev.filter(a => !(a.isRetake && String(a.quizId) === String(result.quizId) && String(a.targetEmployeeId) === String(result.userId)));
    });
  };

  const updateResult = (id: string, updates: Partial<AttemptResult>) => {
    setResults(prev => {
      const updated = prev.map(res => res.id === id ? { ...res, ...updates } : res);
      const target = updated.find(r => r.id === id);
      if (target) syncToSheets('save', 'Results', target);
      return updated;
    });
  };
  
  const addEmployee = (emp: Employee) => {
    setEmployees(prev => [emp, ...prev]);
    syncToSheets('save', 'Employees', emp);
  };

  const updateEmployee = (id: string, emp: Employee) => {
    setEmployees(prev => prev.map(e => e.id === id ? emp : e));
    syncToSheets('save', 'Employees', emp);
  };

  const deleteEmployee = (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    syncToSheets('delete', 'Employees', null, id);
  };
  
  const addPosition = (name: string) => {
    const newPos = { id: `pos-${Date.now()}`, name };
    setPositions(prev => [...prev, newPos]);
    syncToSheets('save', 'Positions', newPos);
  };

  const deletePosition = (id: string) => {
    setPositions(prev => prev.filter(p => p.id !== id));
    syncToSheets('delete', 'Positions', null, id);
  };

  const addAssignment = (asgn: Assignment) => {
    setAssignments(prev => [asgn, ...prev]);
    syncToSheets('save', 'Assignments', asgn);
  };

  const deleteAssignment = (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
    syncToSheets('delete', 'Assignments', null, id);
  };

  return (
    <StoreContext.Provider value={{ 
      quizzes, sessions, results, employees, positions, assignments,
      currentUser, currentRole, isLoading, sheetsUrl,
      loginUser, logoutUser, addQuiz, updateQuiz, deleteQuiz, 
      addSession, updateSession, deleteSession,
      saveResult, updateResult,
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
