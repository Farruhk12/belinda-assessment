
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronRight, ChevronDown, ChevronUp, List, Plus, X, Globe, Timer, Calendar, Pencil, ExternalLink, CheckCircle2, BarChart3, Search, Activity, User, Filter, LayoutGrid, Users, FileQuestion, MessageSquare, RotateCcw, Copy, Trash2 } from 'lucide-react';
import { Quiz, QuestionType, AssignmentTargetType } from '../types';

interface TemplateConfig {
  selectedTestIds: string[];
  selectedOpenIds: string[];
}

export const TakeQuizList: React.FC = () => {
  const { quizzes, sessions, addSession, updateSession, deleteSession, employees, assignments, addAssignment, deleteAssignment, results } = useStore();
  const navigate = useNavigate();
  
  const [isBuilderMode, setIsBuilderMode] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');

  const [sessionTitle, setSessionTitle] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<Record<string, TemplateConfig>>({});
  const [timeLimit, setTimeLimit] = useState<number>(30);
  const [passThreshold, setPassThreshold] = useState<number>(60);
  const [availableFrom, setAvailableFrom] = useState<string>('');
  const [availableUntil, setAvailableUntil] = useState<string>('');

  const [targetType, setTargetType] = useState<AssignmentTargetType>('ALL');
  const [targetArea, setTargetArea] = useState('');
  const [targetGroup, setTargetGroup] = useState('');
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);
  const [viewQuestionsSession, setViewQuestionsSession] = useState<Quiz | null>(null);
  const [retakeSession, setRetakeSession] = useState<Quiz | null>(null);
  const [retakeSelectedIds, setRetakeSelectedIds] = useState<Set<string>>(new Set());
  const [sessionToDelete, setSessionToDelete] = useState<Quiz | null>(null);

  const allAreas = useMemo(() => Array.from(new Set(employees.map(e => String(e.area || '').trim()))).filter(Boolean).sort(), [employees]);
  const allGroups = useMemo(() => Array.from(new Set(employees.map(e => String(e.group || '').trim()))).filter(Boolean).sort(), [employees]);
  
  const filteredSessions = useMemo(() => {
    return (sessions || []).filter(s => {
      const title = String(s.title || '').toLowerCase();
      const matchesSearch = title.includes(listSearch.toLowerCase());
      const matchesGroup = groupFilter === 'ALL' || String(s.group || '').trim() === groupFilter;
      return matchesSearch && matchesGroup;
    }).sort((a,b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  }, [sessions, listSearch, groupFilter]);

  const filteredQuizzes = useMemo(() => {
    return (quizzes || []).filter(q => {
      const title = String(q.title || '').toLowerCase();
      const group = String(q.group || '').toLowerCase();
      const tagsStr = (q.tags || []).join(' ').toLowerCase();
      const search = templateSearch.toLowerCase();
      return title.includes(search) || group.includes(search) || tagsStr.includes(search) || (q.tags || []).some(t => t.toLowerCase().includes(search));
    });
  }, [quizzes, templateSearch]);

  const resetForm = () => {
    setIsBuilderMode(false);
    setEditingSessionId(null);
    setSessionTitle('');
    setSelectedTemplates({});
    setExpandedQuizId(null);
    setTimeLimit(30);
    setPassThreshold(60);
    setAvailableFrom('');
    setAvailableUntil('');
    setTargetType('ALL');
    setTargetArea('');
    setTargetGroup('');
    setTargetEmployeeId('');
  };

  const toggleTemplate = (quizId: string) => {
    const qIdStr = String(quizId);
    if (selectedTemplates[qIdStr]) {
      const next = { ...selectedTemplates };
      delete next[qIdStr];
      setSelectedTemplates(next);
      if (expandedQuizId === qIdStr) setExpandedQuizId(null);
    } else {
      const quiz = quizzes.find(q => String(q.id) === qIdStr);
      if (quiz) {
        const testIds = quiz.questions.filter(q => q.type !== QuestionType.OPEN_ENDED && q.type !== QuestionType.RANGE).map(q => q.id);
        const openIds = quiz.questions.filter(q => q.type === QuestionType.OPEN_ENDED || q.type === QuestionType.RANGE).map(q => q.id);
        setSelectedTemplates({
          ...selectedTemplates,
          [qIdStr]: { selectedTestIds: testIds, selectedOpenIds: openIds }
        });
        setExpandedQuizId(qIdStr);
      }
    }
  };

  const toggleTestQuestion = (quizId: string, questionId: string) => {
    const cfg = selectedTemplates[quizId];
    if (!cfg) return;
    const set = new Set(cfg.selectedTestIds);
    if (set.has(questionId)) set.delete(questionId);
    else set.add(questionId);
    setSelectedTemplates({ ...selectedTemplates, [quizId]: { ...cfg, selectedTestIds: Array.from(set) } });
  };

  const toggleOpenQuestion = (quizId: string, questionId: string) => {
    const cfg = selectedTemplates[quizId];
    if (!cfg) return;
    const set = new Set(cfg.selectedOpenIds);
    if (set.has(questionId)) set.delete(questionId);
    else set.add(questionId);
    setSelectedTemplates({ ...selectedTemplates, [quizId]: { ...cfg, selectedOpenIds: Array.from(set) } });
  };

  const selectAllTests = (quizId: string, select: boolean) => {
    const quiz = quizzes.find(q => String(q.id) === quizId);
    const cfg = selectedTemplates[quizId];
    if (!quiz || !cfg) return;
    const ids = quiz.questions.filter(q => q.type !== QuestionType.OPEN_ENDED && q.type !== QuestionType.RANGE).map(q => q.id);
    setSelectedTemplates({ ...selectedTemplates, [quizId]: { ...cfg, selectedTestIds: select ? ids : [] } });
  };

  const selectAllOpens = (quizId: string, select: boolean) => {
    const quiz = quizzes.find(q => String(q.id) === quizId);
    const cfg = selectedTemplates[quizId];
    if (!quiz || !cfg) return;
    const ids = quiz.questions.filter(q => q.type === QuestionType.OPEN_ENDED || q.type === QuestionType.RANGE).map(q => q.id);
    setSelectedTemplates({ ...selectedTemplates, [quizId]: { ...cfg, selectedOpenIds: select ? ids : [] } });
  };

  const employeesWhoPassed = useMemo(() => {
    if (!retakeSession) return [];
    const passedUserIds = new Set(
      results.filter(r => String(r.quizId) === String(retakeSession.id)) .map(r => String(r.userId))
    );
    return employees.filter(e => passedUserIds.has(String(e.id)));
  }, [retakeSession, results, employees]);

  const handleRetakeOpen = (session: Quiz) => {
    setRetakeSession(session);
    const passedIds = new Set(
      results.filter(r => String(r.quizId) === String(session.id)).map(r => String(r.userId))
    );
    setRetakeSelectedIds(passedIds);
  };

  const handleRetakeAssign = () => {
    if (!retakeSession || retakeSelectedIds.size === 0) {
      alert('Выберите хотя бы одного сотрудника');
      return;
    }
    retakeSelectedIds.forEach(empId => {
      addAssignment({
        id: `asgn-retake-${Date.now()}-${empId}`,
        quizId: retakeSession.id,
        targetType: 'INDIVIDUAL',
        targetEmployeeId: empId,
        assignedAt: Date.now(),
        isRetake: true
      });
    });
    setRetakeSession(null);
    setRetakeSelectedIds(new Set());
  };

  const toggleRetakeEmployee = (empId: string) => {
    setRetakeSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  const startEditing = (session: Quiz) => {
    const asgn = assignments.find(a => String(a.quizId) === String(session.id));
    setEditingSessionId(session.id);
    setSessionTitle(session.title);
    setTimeLimit(session.timeLimit || 30);
    setPassThreshold(session.passThreshold ?? 60);
    if (session.availableFrom) setAvailableFrom(new Date(session.availableFrom).toISOString().slice(0, 16));
    if (session.availableUntil) setAvailableUntil(new Date(session.availableUntil).toISOString().slice(0, 16));
    if (asgn) {
      setTargetType(asgn.targetType);
      setTargetArea(asgn.targetArea || '');
      setTargetGroup(asgn.targetGroup || '');
      setTargetEmployeeId(asgn.targetEmployeeId || '');
    }
    // Восстанавливаем выбранные вопросы из session.questions — ищем, из каких шаблонов они пришли
    const rebuilt: Record<string, TemplateConfig> = {};
    (session.questions || []).forEach(q => {
      for (const quiz of quizzes) {
        const found = quiz.questions.find(tq => String(tq.id) === String(q.id));
        if (found) {
          const qId = String(quiz.id);
          if (!rebuilt[qId]) {
            const testIds = quiz.questions.filter(x => x.type !== QuestionType.OPEN_ENDED && x.type !== QuestionType.RANGE).map(x => x.id);
            const openIds = quiz.questions.filter(x => x.type === QuestionType.OPEN_ENDED || x.type === QuestionType.RANGE).map(x => x.id);
            rebuilt[qId] = { selectedTestIds: [], selectedOpenIds: [] };
          }
          const isOpen = found.type === QuestionType.OPEN_ENDED || found.type === QuestionType.RANGE;
          if (isOpen) {
            if (!rebuilt[qId].selectedOpenIds.includes(found.id)) rebuilt[qId].selectedOpenIds.push(found.id);
          } else {
            if (!rebuilt[qId].selectedTestIds.includes(found.id)) rebuilt[qId].selectedTestIds.push(found.id);
          }
          break;
        }
      }
    });
    setSelectedTemplates(rebuilt);
    setExpandedQuizId(Object.keys(rebuilt)[0] || null);
    setIsBuilderMode(true);
  };

  const handleLaunchOrUpdate = () => {
    if (!String(sessionTitle).trim()) { alert("Введите название аттестации"); return; }
    
    let sessionQuestions: any[] = [];
    if (!editingSessionId) {
      // Fix: casting Object.entries to properly typed array to avoid 'unknown' type errors for config
      const templateEntries = Object.entries(selectedTemplates) as [string, TemplateConfig][];
      if (templateEntries.length === 0) { alert("Выберите хотя бы один шаблон"); return; }
      
      templateEntries.forEach(([id, config]) => {
        const template = quizzes.find(q => String(q.id) === String(id));
        if (template && (config.selectedTestIds.length > 0 || config.selectedOpenIds.length > 0)) {
          const idSet = new Set([...config.selectedTestIds, ...config.selectedOpenIds]);
          const selected = template.questions.filter(q => idSet.has(q.id));
          sessionQuestions.push(...selected);
        }
      });
      if (sessionQuestions.length === 0) {
        alert('Выберите хотя бы один тест или открытый вопрос в выбранных шаблонах');
        return;
      }
    } else {
      const existing = sessions.find(s => String(s.id) === String(editingSessionId));
      const existingQuestions = existing ? (existing.questions || []) : [];
      const allTemplateQuestionIds = new Set<string>();
      quizzes.forEach(q => q.questions.forEach(x => allTemplateQuestionIds.add(x.id)));

      const templateEntries = Object.entries(selectedTemplates) as [string, TemplateConfig][];
      templateEntries.forEach(([id, config]) => {
        const template = quizzes.find(q => String(q.id) === String(id));
        if (template && (config.selectedTestIds.length > 0 || config.selectedOpenIds.length > 0)) {
          const idSet = new Set([...config.selectedTestIds, ...config.selectedOpenIds]);
          const selected = template.questions.filter(q => idSet.has(q.id));
          sessionQuestions.push(...selected);
        }
      });
      existingQuestions.forEach(q => {
        if (!allTemplateQuestionIds.has(q.id)) sessionQuestions.push(q);
      });
      if (sessionQuestions.length === 0) {
        alert('Выберите хотя бы один тест или открытый вопрос в выбранных шаблонах');
        return;
      }
    }

    const quizData: Quiz = {
      id: editingSessionId || `session-${Date.now()}`,
      title: sessionTitle, 
      description: `Комплексная аттестация`, 
      category: 'Аттестация', 
      group: targetGroup || 'Все отделы', 
      product: 'Сборный тест',
      createdAt: editingSessionId ? (sessions.find(s => String(s.id) === String(editingSessionId))?.createdAt || Date.now()) : Date.now(),
      questions: sessionQuestions, 
      isSession: true, 
      isArchived: false,
      timeLimit,
      passThreshold,
      availableFrom: availableFrom ? new Date(availableFrom).getTime() : Date.now(),
      availableUntil: availableUntil ? new Date(availableUntil).getTime() : undefined
    };

    if (editingSessionId) updateSession(editingSessionId, quizData);
    else addSession(quizData);

    const oldAsgn = assignments.find(a => String(a.quizId) === String(quizData.id));
    if (oldAsgn) deleteAssignment(oldAsgn.id);

    addAssignment({ 
      id: `asgn-${Date.now()}`, 
      quizId: quizData.id, 
      targetType, targetArea, targetGroup, targetEmployeeId, 
      assignedAt: Date.now() 
    });
    
    resetForm();
  };

  const handleDuplicateSession = (e: React.MouseEvent, session: Quiz) => {
    e.stopPropagation();
    const newId = `session-${Date.now()}`;
    const duplicated: Quiz = {
      ...session,
      id: newId,
      title: `${session.title} (копия)`,
      createdAt: Date.now(),
      questions: (session.questions || []).map((q, i) => ({
        ...q,
        id: `q-${newId}-${i}-${Date.now()}`
      }))
    };
    addSession(duplicated);
    const oldAsgn = assignments.find(a => String(a.quizId) === String(session.id));
    if (oldAsgn) {
      addAssignment({
        id: `asgn-${Date.now()}`,
        quizId: newId,
        targetType: oldAsgn.targetType,
        targetArea: oldAsgn.targetArea,
        targetGroup: oldAsgn.targetGroup,
        targetEmployeeId: oldAsgn.targetEmployeeId,
        assignedAt: Date.now()
      });
    }
  };

  const handleDeleteSession = (e: React.MouseEvent, session: Quiz) => {
    e.stopPropagation();
    setSessionToDelete(session);
  };

  const confirmDeleteSession = () => {
    if (!sessionToDelete) return;
    deleteSession(sessionToDelete.id);
    assignments.filter(a => String(a.quizId) === String(sessionToDelete.id)).forEach(a => deleteAssignment(a.id));
    setSessionToDelete(null);
  };

  if (isBuilderMode) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50/95 backdrop-blur-md overflow-y-auto p-3 md:p-10 flex justify-center">
        <div className="w-full max-w-6xl animate-fade-in flex flex-col md:flex-row gap-4 md:gap-6">
          <div className="flex-1 space-y-4">
            {/* Header Card */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xl flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-100">
                  <LayoutGrid size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-brand-secondary leading-none">Запуск аттестации</h2>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Конструктор Belinda</p>
                </div>
              </div>
              <button onClick={resetForm} className="p-2 text-gray-300 hover:text-brand-primary transition-colors"><X size={24} /></button>
            </div>

            {/* Template Selector Card */}
            <div className="bg-white p-5 md:p-6 rounded-3xl border border-gray-100 shadow-xl space-y-6">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                 <div className="flex items-center gap-2">
                   <List size={16} className="text-brand-primary" />
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-secondary">Выберите шаблоны</h3>
                 </div>
                 <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                    <input type="text" placeholder="Поиск в банке..." className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-xl text-[11px] font-bold outline-none focus:ring-1 focus:ring-brand-primary/20" value={templateSearch} onChange={(e)=>setTemplateSearch(e.target.value)} />
                 </div>
               </div>
               
               <div className="grid grid-cols-1 gap-2.5 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredQuizzes.map(quiz => {
                    const config = selectedTemplates[String(quiz.id)];
                    const isSelected = !!config;
                    const testQuestions = quiz.questions.filter(q => q.type !== QuestionType.OPEN_ENDED && q.type !== QuestionType.RANGE);
                    const openQuestions = quiz.questions.filter(q => q.type === QuestionType.OPEN_ENDED || q.type === QuestionType.RANGE);
                    const isExpanded = expandedQuizId === String(quiz.id);

                    return (
                      <div key={quiz.id} className={`rounded-2xl border-2 transition-all overflow-hidden ${isSelected ? 'border-brand-primary bg-red-50/30' : 'border-gray-50 bg-gray-50 hover:bg-white hover:border-gray-100'}`}>
                        <div className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isSelected ? '' : ''}`}>
                          <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => toggleTemplate(quiz.id)}>
                            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-brand-primary border-brand-primary text-white' : 'bg-white border-gray-200 shadow-inner'}`}>
                               {isSelected && <CheckCircle2 size={12} />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[12px] font-black text-brand-secondary leading-tight">{quiz.title}</p>
                              <p className="text-[9px] font-black text-gray-400 uppercase mt-0.5">{quiz.group} • {testQuestions.length + openQuestions.length} вопр.</p>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="flex items-center gap-2 bg-white/60 px-3 py-1.5 rounded-xl">
                                <FileQuestion size={12} className="text-brand-primary" />
                                <span className="text-[10px] font-black text-brand-secondary">{config.selectedTestIds.length}/{testQuestions.length}</span>
                                <span className="text-[8px] font-black text-gray-400 uppercase">тесты</span>
                              </div>
                              <div className="flex items-center gap-2 bg-white/60 px-3 py-1.5 rounded-xl">
                                <MessageSquare size={12} className="text-brand-primary" />
                                <span className="text-[10px] font-black text-brand-secondary">{config.selectedOpenIds.length}/{openQuestions.length}</span>
                                <span className="text-[8px] font-black text-gray-400 uppercase">открытые</span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setExpandedQuizId(isExpanded ? null : String(quiz.id)); }}
                                className="p-2 rounded-xl bg-white/60 hover:bg-white text-brand-primary transition-colors"
                                title={isExpanded ? 'Свернуть' : 'Выбрать вопросы'}
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </div>
                          )}
                        </div>

                        {isSelected && isExpanded && (
                          <div className="border-t border-brand-primary/20 bg-white/40 p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                            {testQuestions.length > 0 && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <FileQuestion size={12} /> Тесты ({config.selectedTestIds.length}/{testQuestions.length})
                                  </label>
                                  <div className="flex gap-1">
                                    <button type="button" onClick={() => selectAllTests(String(quiz.id), true)} className="text-[8px] font-black text-brand-primary hover:underline">Все</button>
                                    <span className="text-gray-300">|</span>
                                    <button type="button" onClick={() => selectAllTests(String(quiz.id), false)} className="text-[8px] font-black text-gray-400 hover:underline">Снять</button>
                                  </div>
                                </div>
                                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                                  {testQuestions.map(q => (
                                    <label key={q.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/60 cursor-pointer group">
                                      <input type="checkbox" checked={config.selectedTestIds.includes(q.id)} onChange={() => toggleTestQuestion(String(quiz.id), q.id)} className="mt-1 rounded border-gray-300 text-brand-primary focus:ring-brand-primary shrink-0" />
                                      <span className={`shrink-0 px-2 py-0.5 rounded text-[8px] font-black uppercase ${(q.difficulty || 'medium') === 'easy' ? 'bg-green-100 text-green-700' : (q.difficulty || 'medium') === 'hard' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`} title={(q.difficulty || 'medium') === 'easy' ? 'Легкий' : (q.difficulty || 'medium') === 'hard' ? 'Сложный' : 'Средний'}>
                                        {(q.difficulty || 'medium') === 'easy' ? 'Легкий' : (q.difficulty || 'medium') === 'hard' ? 'Сложный' : 'Средний'}
                                      </span>
                                      <span className="text-[11px] font-medium text-brand-secondary line-clamp-2 group-hover:text-brand-primary min-w-0">{q.text}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                            {openQuestions.length > 0 && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <MessageSquare size={12} /> Открытые вопросы ({config.selectedOpenIds.length}/{openQuestions.length})
                                  </label>
                                  <div className="flex gap-1">
                                    <button type="button" onClick={() => selectAllOpens(String(quiz.id), true)} className="text-[8px] font-black text-brand-primary hover:underline">Все</button>
                                    <span className="text-gray-300">|</span>
                                    <button type="button" onClick={() => selectAllOpens(String(quiz.id), false)} className="text-[8px] font-black text-gray-400 hover:underline">Снять</button>
                                  </div>
                                </div>
                                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                                  {openQuestions.map(q => (
                                    <label key={q.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/60 cursor-pointer group">
                                      <input type="checkbox" checked={config.selectedOpenIds.includes(q.id)} onChange={() => toggleOpenQuestion(String(quiz.id), q.id)} className="mt-1 rounded border-gray-300 text-brand-primary focus:ring-brand-primary shrink-0" />
                                      <span className={`shrink-0 px-2 py-0.5 rounded text-[8px] font-black uppercase ${(q.difficulty || 'medium') === 'easy' ? 'bg-green-100 text-green-700' : (q.difficulty || 'medium') === 'hard' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`} title={(q.difficulty || 'medium') === 'easy' ? 'Легкий' : (q.difficulty || 'medium') === 'hard' ? 'Сложный' : 'Средний'}>
                                        {(q.difficulty || 'medium') === 'easy' ? 'Легкий' : (q.difficulty || 'medium') === 'hard' ? 'Сложный' : 'Средний'}
                                      </span>
                                      <span className="text-[11px] font-medium text-brand-secondary line-clamp-2 group-hover:text-brand-primary min-w-0">{q.text}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
               </div>
            </div>

            {/* Targeted Assignment Card */}
            <div className="bg-white p-5 md:p-6 rounded-3xl border border-gray-100 shadow-xl space-y-6">
               <div className="flex items-center gap-2 border-b pb-4">
                 <Globe size={16} className="text-brand-primary" />
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-secondary">Кому назначить</h3>
               </div>
               
               <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                 {[
                   { id: 'ALL', label: 'Всем' },
                   { id: 'AREA', label: 'Область' },
                   { id: 'GROUP', label: 'Группа' },
                   { id: 'AREA_GROUP', label: 'Оба' },
                   { id: 'INDIVIDUAL', label: 'Лично' }
                 ].map(t => (
                    <button key={t.id} onClick={() => setTargetType(t.id as any)} className={`py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${targetType === t.id ? 'bg-brand-primary text-white border-brand-primary shadow-md shadow-red-100' : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'}`}>
                      {t.label}
                    </button>
                 ))}
               </div>

               {/* Conditional Inputs for Targeting */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                  {(targetType === 'AREA' || targetType === 'AREA_GROUP') && (
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Выбор области</label>
                       <select value={targetArea} onChange={(e)=>setTargetArea(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl font-bold text-xs outline-none focus:ring-1 focus:ring-brand-primary/20 appearance-none border-none">
                          <option value="">Выберите область...</option>
                          {allAreas.map(a => <option key={a} value={a}>{a}</option>)}
                       </select>
                    </div>
                  )}
                  {(targetType === 'GROUP' || targetType === 'AREA_GROUP') && (
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Выбор группы/отдела</label>
                       <select value={targetGroup} onChange={(e)=>setTargetGroup(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl font-bold text-xs outline-none focus:ring-1 focus:ring-brand-primary/20 appearance-none border-none">
                          <option value="">Выберите отдел...</option>
                          {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
                       </select>
                    </div>
                  )}
                  {targetType === 'INDIVIDUAL' && (
                    <div className="space-y-1 col-span-full">
                       <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Выберите сотрудника</label>
                       <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                          <select value={targetEmployeeId} onChange={(e)=>setTargetEmployeeId(e.target.value)} className="w-full bg-gray-50 pl-11 pr-4 py-3 rounded-xl font-bold text-xs outline-none focus:ring-1 focus:ring-brand-primary/20 appearance-none border-none">
                            <option value="">Выберите из списка...</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.group})</option>)}
                          </select>
                       </div>
                    </div>
                  )}
               </div>
            </div>
          </div>

          {/* Sidebar Parameters */}
          <div className="w-full md:w-80 bg-brand-secondary rounded-3xl p-6 text-white shadow-2xl h-fit sticky top-10 border-b-4 border-brand-primary">
            <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
              <Timer size={16} className="text-brand-primary" /> Параметры запуска
            </h3>
            <div className="space-y-5">
               <div className="space-y-1.5">
                 <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest ml-1">Название сессии</label>
                 <input type="text" value={sessionTitle} onChange={(e)=>setSessionTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 p-3.5 rounded-xl font-bold text-xs outline-none focus:ring-1 focus:ring-brand-primary" placeholder="Аттестация Q1..." />
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1.5">
                   <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest ml-1">Время (мин)</label>
                   <input type="number" value={timeLimit} onChange={(e)=>setTimeLimit(parseInt(e.target.value)||0)} className="w-full bg-white/5 border border-white/10 p-3.5 rounded-xl font-bold text-xs outline-none focus:ring-1 focus:ring-brand-primary" />
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest ml-1">Проходной балл (%)</label>
                   <input type="number" min={1} max={100} value={passThreshold} onChange={(e)=>setPassThreshold(Math.min(100, Math.max(1, parseInt(e.target.value)||60)))} className="w-full bg-white/5 border border-white/10 p-3.5 rounded-xl font-bold text-xs outline-none focus:ring-1 focus:ring-brand-primary" />
                 </div>
                 <div className="space-y-1.5 col-span-2">
                   <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest ml-1">Дата начала</label>
                   <input type="datetime-local" value={availableFrom} onChange={(e)=>setAvailableFrom(e.target.value)} className="w-full bg-white/5 border border-white/10 p-3.5 rounded-xl font-bold text-[10px] outline-none focus:ring-1 focus:ring-brand-primary" />
                 </div>
                 <div className="space-y-1.5 col-span-2">
                   <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest ml-1">Дата окончания</label>
                   <input type="datetime-local" value={availableUntil} onChange={(e)=>setAvailableUntil(e.target.value)} className="w-full bg-white/5 border border-white/10 p-3.5 rounded-xl font-bold text-[10px] outline-none focus:ring-1 focus:ring-brand-primary" />
                 </div>
               </div>

               <button onClick={handleLaunchOrUpdate} className="w-full py-4 bg-brand-primary text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-red-600 transition-all mt-4 border-none border-b-4 border-black/20 active:translate-y-1 active:border-b-0">
                 {editingSessionId ? 'Обновить данные' : 'Запустить аттестацию'}
               </button>
               
               <button onClick={resetForm} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors border-none">
                 Отмена
               </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* List Header */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-brand-secondary tracking-tight">Назначить тест <span className="text-brand-primary">Belinda</span></h2>
          <p className="text-gray-400 font-medium text-[11px] uppercase tracking-widest">Управление сессиями аттестации</p>
        </div>
        <button onClick={() => setIsBuilderMode(true)} className="bg-brand-primary text-white px-6 py-3 rounded-xl hover:shadow-md transition-all font-bold flex items-center gap-2 group text-xs uppercase tracking-widest">
          <Plus size={14} className="group-hover:rotate-90 transition-transform" />
          <span>Новый запуск</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
         <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
            <input type="text" placeholder="Поиск по названию сессии..." className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border-none rounded-xl font-bold text-xs outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary/20 transition-all" value={listSearch} onChange={(e)=>setListSearch(e.target.value)} />
         </div>
         <select value={groupFilter} onChange={(e)=>setGroupFilter(e.target.value)} className="bg-gray-50 px-6 py-2.5 rounded-xl border-none font-black text-[10px] uppercase tracking-widest text-brand-secondary outline-none w-full md:w-auto appearance-none shadow-sm">
            <option value="ALL">Все отделы</option>
            {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
         </select>
      </div>

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 gap-3">
        {filteredSessions.map(session => {
          const finishedCount = results.filter(r => String(r.quizId) === String(session.id)).length;
          const isActive = !session.availableUntil || Date.now() < session.availableUntil;
          
          return (
            <div key={session.id} className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5 flex flex-col md:flex-row items-center justify-between shadow-sm group hover:border-brand-primary/30 transition-all hover:shadow-md">
              <div className="flex-1 cursor-pointer w-full" onClick={() => setViewQuestionsSession(session)}>
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-[14px] font-black text-brand-secondary group-hover:text-brand-primary transition-colors">{session.title}</h4>
                  <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${isActive ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-50 text-gray-400'}`}>
                    {isActive ? 'Активна' : 'Завершена'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.1em]">
                  <span className="flex items-center gap-1.5"><List size={14} className="text-brand-primary/50" /> {(session.questions || []).length} вопросов</span>
                  <span className="flex items-center gap-1.5"><Globe size={14} className="text-brand-primary/50" /> {session.group}</span>
                  <span className="flex items-center gap-1.5"><Calendar size={14} className="text-brand-primary/50" /> {new Date(session.availableFrom || session.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-8 mt-4 md:mt-0 border-t md:border-t-0 md:border-l border-gray-50 pt-4 md:pt-0 md:pl-8 w-full md:w-auto">
                <div className="text-center">
                  <p className="text-[9px] font-black text-brand-primary uppercase mb-1 tracking-widest">Завершили</p>
                  <p className="text-2xl font-black text-brand-secondary">{finishedCount}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={(e)=>{e.stopPropagation(); handleDuplicateSession(e, session);}} className="p-2.5 text-gray-300 hover:text-brand-primary hover:bg-red-50 rounded-xl transition-all" title="Дублировать">
                    <Copy size={18}/>
                  </button>
                  <button onClick={(e)=>{e.stopPropagation(); handleRetakeOpen(session);}} className="p-2.5 text-gray-300 hover:text-brand-primary hover:bg-red-50 rounded-xl transition-all" title="Повторно запустить">
                    <RotateCcw size={18}/>
                  </button>
                  <button onClick={(e)=>{e.stopPropagation(); startEditing(session);}} className="p-2.5 text-gray-300 hover:text-brand-primary hover:bg-red-50 rounded-xl transition-all" title="Редактировать">
                    <Pencil size={18}/>
                  </button>
                  <button onClick={(e)=>{e.stopPropagation(); navigate(`/analytics?quizId=${session.id}`);}} className="p-2.5 text-gray-300 hover:text-brand-primary hover:bg-red-50 rounded-xl transition-all" title="Результаты: кто сдавал">
                    <BarChart3 size={18}/>
                  </button>
                  <button onClick={(e)=>{e.stopPropagation(); handleDeleteSession(e, session);}} className="p-2.5 text-gray-300 hover:text-brand-primary hover:bg-red-50 rounded-xl transition-all" title="Удалить">
                    <Trash2 size={18}/>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filteredSessions.length === 0 && (
          <div className="py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-center flex flex-col items-center">
             <LayoutGrid className="text-gray-100 mb-4" size={48} />
             <p className="text-xs font-black text-gray-300 uppercase tracking-widest">Активные сессии не найдены</p>
          </div>
        )}
      </div>

      {/* Модальное окно: подтверждение удаления */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSessionToDelete(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 size={24} className="text-brand-primary" />
              </div>
              <div>
                <h3 className="text-lg font-black text-brand-secondary">Удалить сессию?</h3>
                <p className="text-sm font-bold text-gray-500 mt-1">{sessionToDelete.title}</p>
                <p className="text-[11px] text-gray-400 mt-2">Результаты прохождений сохранятся. Назначения будут удалены.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setSessionToDelete(null)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-colors">
                Отмена
              </button>
              <button onClick={confirmDeleteSession} className="flex-1 py-3 bg-brand-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 transition-colors">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно: повторно запустить */}
      {retakeSession && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRetakeSession(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-brand-secondary">Повторно запустить</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{retakeSession.title}</p>
              </div>
              <button onClick={() => setRetakeSession(null)} className="p-2 text-gray-300 hover:text-brand-primary rounded-xl transition-colors"><X size={20} /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-[11px] font-bold text-gray-500 mb-3">Выберите сотрудников, которым назначить тест повторно (уже проходили):</p>
              {employeesWhoPassed.length === 0 ? (
                <p className="text-[11px] text-gray-400 py-4">Никто ещё не проходил этот тест</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {employeesWhoPassed.map(emp => (
                    <label key={emp.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer border border-gray-100">
                      <input type="checkbox" checked={retakeSelectedIds.has(String(emp.id))} onChange={() => toggleRetakeEmployee(String(emp.id))} className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                      <div>
                        <p className="text-[12px] font-black text-brand-secondary">{emp.fullName}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">{emp.group}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button onClick={() => setRetakeSession(null)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-colors">
                Отмена
              </button>
              <button onClick={handleRetakeAssign} disabled={employeesWhoPassed.length === 0 || retakeSelectedIds.size === 0} className="flex-1 py-3 bg-brand-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Назначить повторно
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно: вопросы теста */}
      {viewQuestionsSession && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewQuestionsSession(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-brand-secondary">{viewQuestionsSession.title}</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{(viewQuestionsSession.questions || []).length} вопросов</p>
              </div>
              <button onClick={() => setViewQuestionsSession(null)} className="p-2 text-gray-300 hover:text-brand-primary rounded-xl transition-colors"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3 custom-scrollbar">
              {(viewQuestionsSession.questions || []).map((q, idx) => (
                <div key={q.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[10px] font-black text-brand-primary uppercase mb-1.5">Вопрос {idx + 1}</p>
                  <p className="text-[12px] font-medium text-brand-secondary">{q.text}</p>
                  {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && q.options?.length > 0 && (
                    <ul className="mt-2 space-y-1 text-[11px] text-gray-500">
                      {q.options.map((opt, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-white border border-gray-200 flex items-center justify-center text-[9px] font-black">{String.fromCharCode(65 + i)}</span>
                          {opt}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
