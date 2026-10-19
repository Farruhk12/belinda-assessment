
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useUi } from '../context/UiContext';
import { api, ApiError } from '../services/api';
import { QuestionType, AttemptResult, Quiz, MAX_VIOLATIONS } from '../types';
import { CheckCircle, ArrowRight, ArrowLeft, Clock, AlertTriangle, ShieldAlert, ShieldCheck, CheckCircle2, XCircle, Trophy, Loader2 } from 'lucide-react';

type Answer = number[] | string | { from: string, to: string };
type CheckedInfo = { correct?: boolean; credit?: number; correctAnswers?: number[]; manual?: boolean };

interface AttemptView {
  attemptId: string;
  startedAt: number;
  serverNow: number;
  session: Quiz;
  answers: Record<string, Answer>;
  checked: Record<string, CheckedInfo>;
  violations: number;
}
type StartResponse = AttemptView | { finished: true; result: AttemptResult };

// Попытка живёт на сервере: ответы проверяются и баллы считаются там, а при обновлении страницы она продолжается
export const TakeQuiz: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { applyResult, currentUser } = useStore();
  const { notify } = useUi();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attemptId, setAttemptId] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [checked, setChecked] = useState<Record<string, CheckedInfo>>({});
  const [finalResult, setFinalResult] = useState<AttemptResult | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [violationCount, setViolationCount] = useState(0);
  const [lastViolationReason, setLastViolationReason] = useState<string>('');
  const [showWarningModal, setShowWarningModal] = useState(false);

  const clockOffset = useRef(0);
  const finishingRef = useRef(false);
  const isFinished = finalResult !== null;

  const complete = useCallback((result: AttemptResult) => {
    setFinalResult(result);
    applyResult(result);
  }, [applyResult]);

  useEffect(() => {
    let cancelled = false;
    api.post<StartResponse>('/api/attempt', { action: 'start', sessionId: id })
      .then(res => {
        if (cancelled) return;
        if ('finished' in res) { complete(res.result); return; }
        clockOffset.current = res.serverNow - Date.now();
        setQuiz(res.session);
        setAttemptId(res.attemptId);
        setAnswers(res.answers);
        setChecked(res.checked);
        setViolationCount(res.violations);
        const firstOpen = res.session.questions.findIndex(q => !res.checked[q.id]);
        setCurrentStep(firstOpen === -1 ? Math.max(0, res.session.questions.length - 1) : firstOpen);
        if (res.session.timeLimit) setDeadline(res.startedAt + res.session.timeLimit * 60000);
      })
      .catch(e => {
        if (cancelled) return;
        notify(e instanceof ApiError ? e.message : 'Не удалось начать аттестацию');
        navigate('/active');
      });
    return () => { cancelled = true; };
  }, [id]);

  const finishQuiz = useCallback(async (draft?: { questionId: string; answer: Answer }) => {
    if (finishingRef.current || !attemptId) return;
    finishingRef.current = true;
    try {
      const res = await api.post<{ result: AttemptResult }>('/api/attempt', { action: 'finish', attemptId, draft });
      complete(res.result);
    } catch (e) {
      finishingRef.current = false;
      notify(e instanceof ApiError ? e.message : 'Не удалось завершить аттестацию');
    }
  }, [attemptId, complete, notify]);

  // таймер считается от времени старта на сервере, поэтому обновление страницы его не сбрасывает
  useEffect(() => {
    if (deadline === null || isFinished) return;
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - (Date.now() + clockOffset.current)) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        const q = quiz?.questions[currentStep];
        const draft = q && !checked[q.id] && q.type === QuestionType.OPEN_ENDED && typeof answers[q.id] === 'string'
          ? { questionId: q.id, answer: answers[q.id] } : undefined;
        finishQuiz(draft);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline, isFinished, finishQuiz, quiz, currentStep, checked, answers]);

  useEffect(() => {
    if (!attemptId || isFinished) return;

    const handleViolation = async (reason: 'visibility' | 'paste') => {
      setLastViolationReason(reason === 'visibility' ? 'Вы свернули вкладку или переключили окно' : 'Вы вставили скопированный текст');
      try {
        const res = await api.post<{ violations: number; finished?: boolean; result?: AttemptResult }>('/api/attempt', { action: 'violation', attemptId, reason });
        setViolationCount(res.violations);
        if (res.finished && res.result) complete(res.result);
        else setShowWarningModal(true);
      } catch { /* нарушение фиксируется при следующей успешной связи */ }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleViolation('visibility');
    };
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      handleViolation('paste');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('paste', handlePaste);
    };
  }, [attemptId, isFinished, complete]);

  // сумма баллов за проверенные вопросы (за частично верный многовыборный ответ начисляется доля)
  const correctCount = Math.round((Object.values(checked) as CheckedInfo[]).reduce((sum, c) => sum + (c.credit ?? (c.correct ? 1 : 0)), 0) * 100) / 100;

  if (!currentUser) return null;

  if (!quiz && !finalResult) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-300">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSelectOption = (qId: string, optIndex: number, type: QuestionType) => {
    if (checked[qId]) return; // после проверки ответ менять нельзя

    setAnswers(prev => {
      const currentSelected = (prev[qId] as number[]) || [];
      if (type === QuestionType.SINGLE_CHOICE) return { ...prev, [qId]: [optIndex] };
      return { ...prev, [qId]: currentSelected.includes(optIndex) ? currentSelected.filter(i => i !== optIndex) : [...currentSelected, optIndex] };
    });
  };

  const checkCurrentAnswer = async () => {
    if (!quiz || isBusy) return;
    const q = quiz.questions[currentStep];
    if (!isAnswered(q.id, q.type)) {
      notify('Выберите вариант ответа', 'info');
      return;
    }
    setIsBusy(true);
    try {
      const res = await api.post<CheckedInfo & { finished?: boolean; result?: AttemptResult }>('/api/attempt', {
        action: 'check', attemptId, questionId: q.id, answer: answers[q.id]
      });
      if (res.finished && res.result) { complete(res.result); return; }
      setChecked(prev => ({ ...prev, [q.id]: res.manual ? { manual: true } : { correct: res.correct, credit: res.credit, correctAnswers: res.correctAnswers } }));
    } catch (e) {
      notify(e instanceof ApiError ? e.message : 'Не удалось проверить ответ');
    } finally {
      setIsBusy(false);
    }
  };

  const isAnswered = (qId: string, type: QuestionType) => {
    const a = answers[qId];
    if (type === QuestionType.OPEN_ENDED) return typeof a === 'string' && a.trim() !== '';
    if (type === QuestionType.RANGE) return !!a && typeof a === "object" && !Array.isArray(a) && (String(a.from ?? "").trim() !== "" || String(a.to ?? "").trim() !== "");
    return Array.isArray(a) && a.length > 0;
  };

  if (isFinished) {
    const isDisqualified = (finalResult.violations || 0) > MAX_VIOLATIONS;
    return (
      <div className="max-w-md mx-auto bg-white rounded-[40px] shadow-2xl p-12 text-center animate-fade-in border border-gray-100">
        {isDisqualified ? (
          <>
            <div className="w-24 h-24 bg-red-50 text-brand-primary rounded-[30px] flex items-center justify-center mx-auto mb-8 shadow-inner">
               <ShieldAlert size={56} />
            </div>
            <h2 className="text-2xl font-black text-brand-primary mb-3 uppercase tracking-tight">Не сдан</h2>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-10 leading-relaxed px-4">
              Причина: Нарушение правил аттестации (более {MAX_VIOLATIONS} инцидентов). Тест аннулирован.
            </p>
          </>
        ) : (
          <>
            <div className="w-24 h-24 bg-green-50 text-green-500 rounded-[30px] flex items-center justify-center mx-auto mb-8 shadow-inner">
               <CheckCircle size={56} />
            </div>
            <h2 className="text-2xl font-black text-brand-secondary mb-3 uppercase tracking-tight">Завершено</h2>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 shadow-sm">
                Результат: {finalResult.score} из {finalResult.maxPossibleScore}
            </p>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-10">Ваши ответы приняты системой Belinda.</p>
          </>
        )}
        <button onClick={() => navigate('/results')} className="w-full bg-brand-secondary text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl border-b-4 border-black active:translate-y-1 active:border-b-0 transition-all">К результатам</button>
      </div>
    );
  }

  if (!quiz || quiz.questions.length === 0) {
    return (
      <div className="max-w-md mx-auto p-12 text-center text-gray-400 font-black text-xs uppercase tracking-widest">В этой аттестации нет вопросов</div>
    );
  }

  const isCurrentQuestionChecked = !!checked[quiz.questions[currentStep].id];
  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, quiz.questions.length - 1));

  const currentQuestion = quiz.questions[currentStep];
  const hasSelected = isAnswered(currentQuestion.id, currentQuestion.type);

  return (
    <div className="max-w-2xl mx-auto pb-20 space-y-4 relative">
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
         <div className="flex items-center gap-6">
            <div className={`p-2.5 rounded-xl ${violationCount > 0 ? 'bg-red-50 text-brand-primary' : 'bg-green-50 text-green-600'}`}>
               <ShieldCheck size={20} />
            </div>
            <div className="hidden sm:block">
               <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Статус Integrity</p>
               <div className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`w-3.5 h-1.5 rounded-full transition-all ${i <= (MAX_VIOLATIONS - violationCount) ? 'bg-brand-primary' : 'bg-gray-100'}`} />
                  ))}
               </div>
            </div>
            <div className="flex flex-col border-l pl-6">
               <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Верно</p>
               <div className="flex items-center gap-1.5 font-black text-sm text-brand-secondary">
                  <Trophy size={14} className="text-brand-primary" />
                  <span>{correctCount} / {quiz.questions.length}</span>
               </div>
            </div>
         </div>
         <div className="text-right">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Время</p>
            <div className={`font-black text-sm tabular-nums flex items-center gap-2 ${timeLeft && timeLeft < 60 ? 'text-brand-primary animate-pulse' : 'text-brand-secondary'}`}>
               <Clock size={16} />
               {timeLeft !== null ? formatTime(timeLeft) : '∞'}
            </div>
         </div>
      </div>

      {violationCount > 0 && (
        <div className="bg-brand-primary text-white p-4 rounded-2xl flex items-center justify-center gap-3 animate-fade-in shadow-lg border-b-4 border-black/20">
          <AlertTriangle size={18} />
          <p className="text-[10px] font-black uppercase tracking-[0.1em]">
            {violationCount === MAX_VIOLATIONS 
              ? 'ПОСЛЕДНИЙ ШАНС: Следующее нарушение аннулирует тест!' 
              : `Нарушение правил: ${lastViolationReason} (${violationCount}/${MAX_VIOLATIONS})`}
          </p>
        </div>
      )}

      <div className="bg-white rounded-[40px] shadow-lg border border-gray-100 p-8 md:p-10 min-h-[400px] flex flex-col relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-brand-primary opacity-10"></div>
        <div className="flex justify-between items-center mb-8">
           <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Вопрос {currentStep + 1} / {quiz.questions.length}</span>
           {isCurrentQuestionChecked && currentQuestion.type !== QuestionType.OPEN_ENDED && currentQuestion.type !== QuestionType.RANGE && (
             <div className="animate-fade-in">
                {(() => {
                    const info = checked[currentQuestion.id];
                    const credit = info?.credit ?? (info?.correct ? 1 : 0);
                    const isCorrect = credit === 1;
                    const isPartial = credit > 0 && credit < 1;
                    return (
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isCorrect ? "bg-green-50 text-green-600 border border-green-100" : isPartial ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-red-50 text-brand-primary border border-red-100"}`}>
                            {isCorrect ? <CheckCircle2 size={14} /> : isPartial ? <AlertTriangle size={14} /> : <XCircle size={14} />}
                            {isCorrect ? "Верно" : isPartial ? `Частично (${Math.round(credit * 100)}%)` : "Ошибка"}
                        </span>
                    );
                })()}
             </div>
           )}
        </div>
        
        <h3 className="text-xl md:text-2xl font-black text-brand-secondary mb-10 leading-tight">{currentQuestion.text}</h3>
        
        <div className="space-y-3 flex-1">
          {currentQuestion.type === QuestionType.OPEN_ENDED ? (
            <textarea 
              value={(answers[currentQuestion.id] as string) || ''} 
              onChange={(e) => setAnswers({...answers, [currentQuestion.id]: e.target.value})} 
              disabled={isCurrentQuestionChecked}
              placeholder="Ваш ответ (копирование запрещено)..." 
              className={`w-full p-6 md:p-8 bg-gray-50 border-none rounded-3xl focus:ring-2 focus:ring-red-50 outline-none min-h-[200px] font-bold text-sm resize-none text-brand-secondary shadow-inner ${isCurrentQuestionChecked ? 'opacity-70' : ''}`} 
            />
          ) : currentQuestion.type === QuestionType.RANGE ? (
            <div className="flex items-center gap-6 py-10">
               {['from', 'to'].map(f => (
                 <div key={f} className="flex-1 space-y-3">
                   <label className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-widest">{f === 'from' ? 'Минимум' : 'Максимум'}</label>
                   <input 
                     type="number" 
                     disabled={isCurrentQuestionChecked}
                     value={(answers[currentQuestion.id] as any)?.[f] || ''} 
                     onChange={(e) => setAnswers({...answers, [currentQuestion.id]: {...(answers[currentQuestion.id] as any), [f]: e.target.value}})} 
                     className="w-full p-4 md:p-6 bg-gray-50 rounded-[30px] text-center font-black text-2xl md:text-3xl outline-none border-2 border-transparent focus:border-brand-primary/20 transition-all shadow-inner" 
                   />
                 </div>
               ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {currentQuestion.options.map((opt, idx) => {
                const userAns = (answers[currentQuestion.id] as number[] || []);
                const isSelected = userAns.includes(idx);
                const isCorrectOption = (checked[currentQuestion.id]?.correctAnswers || []).includes(idx);
                
                let btnStyle = "border-gray-50 bg-gray-50 hover:bg-white hover:border-gray-200 shadow-sm";
                let checkStyle = "bg-white border-gray-200";
                
                if (isCurrentQuestionChecked) {
                    if (isCorrectOption) {
                        btnStyle = "border-green-500 bg-green-50 shadow-md";
                        checkStyle = "bg-green-500 border-green-500 text-white";
                    } else if (isSelected && !isCorrectOption) {
                        btnStyle = "border-brand-primary bg-red-50 shadow-md";
                        checkStyle = "bg-brand-primary border-brand-primary text-white";
                    } else {
                        btnStyle = "border-gray-100 bg-white opacity-50";
                    }
                } else if (isSelected) {
                    btnStyle = "border-brand-primary bg-red-50 shadow-inner";
                    checkStyle = "bg-brand-primary border-brand-primary shadow-sm";
                }

                return (
                  <button 
                    key={idx} 
                    disabled={isCurrentQuestionChecked}
                    onClick={() => handleSelectOption(currentQuestion.id, idx, currentQuestion.type)} 
                    className={`w-full text-left p-4 md:p-5 rounded-2xl border-2 transition-all flex items-center gap-4 ${btnStyle}`}
                  >
                    <div className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all ${checkStyle}`}>
                       {isCurrentQuestionChecked ? (
                           isCorrectOption ? <CheckCircle2 size={16} /> : (isSelected ? <XCircle size={16} /> : null)
                       ) : (
                           isSelected && <div className="w-2.5 h-2.5 bg-white rounded-md" />
                       )}
                    </div>
                    <span className={`font-bold text-sm ${isSelected ? 'text-brand-secondary' : 'text-gray-500'}`}>{opt}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center px-4 pt-4">
        <button 
          onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))} 
          disabled={currentStep === 0} 
          className="flex items-center gap-2 px-6 py-4 text-gray-400 font-black text-[11px] uppercase tracking-widest disabled:opacity-0 hover:text-brand-secondary transition-colors"
        >
          <ArrowLeft size={18} /> Назад
        </button>

        {!isCurrentQuestionChecked ? (
           <button 
             onClick={checkCurrentAnswer} 
             disabled={!hasSelected || isBusy}
             className="bg-brand-secondary text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-brand-primary transition-all flex items-center gap-3 border-b-4 border-black disabled:opacity-50 disabled:translate-y-0 disabled:border-b-0 active:translate-y-1 active:border-b-0"
           >
             Проверить <CheckCircle2 size={20} />
           </button>
        ) : (
            currentStep === quiz.questions.length - 1 ? (
                <button onClick={() => finishQuiz()} className="bg-brand-primary text-white px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-brand-secondary transition-all flex items-center gap-3 border-b-4 border-red-800 active:translate-y-1 active:border-b-0">
                  Завершить <CheckCircle size={20} />
                </button>
              ) : (
                <button onClick={nextStep} className="bg-brand-secondary text-white px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-brand-primary transition-all flex items-center gap-3 border-b-4 border-black active:translate-y-1 active:border-b-0">
                  Следующий <ArrowRight size={20} />
                </button>
              )
        )}
      </div>

      {showWarningModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-secondary/90 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[50px] p-10 md:p-12 text-center shadow-2xl border-b-[12px] border-brand-primary">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-red-50 text-brand-primary rounded-[35px] flex items-center justify-center mx-auto mb-8 shadow-inner">
              <ShieldAlert size={48} />
            </div>
            <h3 className="text-2xl font-black text-brand-secondary mb-4 uppercase tracking-tight">Нарушение!</h3>
            <p className="text-[12px] font-bold text-brand-primary uppercase tracking-widest mb-2 leading-none">{lastViolationReason}</p>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-10 leading-relaxed">
              {violationCount === MAX_VIOLATIONS 
                ? 'ЭТО ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ. Еще одно нарушение и вы будете дисквалифицированы.' 
                : `Зафиксировано нарушение правил аттестации (${violationCount} из ${MAX_VIOLATIONS}).`}
            </p>
            <button 
              onClick={() => setShowWarningModal(false)}
              className="w-full bg-brand-primary text-white py-5 rounded-[20px] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-brand-secondary transition-all"
            >
              Я всё понял
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
