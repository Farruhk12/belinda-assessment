
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { QuestionType, AttemptResult } from '../types';
import { CheckCircle, ArrowRight, ArrowLeft, Clock, AlertTriangle, ShieldAlert, ShieldCheck, CheckCircle2, XCircle, Trophy } from 'lucide-react';

export const TakeQuiz: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sessions, saveResult, currentUser } = useStore();
  const [quiz, setQuiz] = useState(sessions.find(q => String(q.id) === String(id)));
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number[] | string | { from: string, to: string }>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [startTime] = useState(Date.now());
  
  // Состояния для мгновенной проверки
  const [correctCount, setCorrectCount] = useState(0);
  const [isCurrentQuestionChecked, setIsCurrentQuestionChecked] = useState(false);
  
  const [violationCount, setViolationCount] = useState(0);
  const [violationLogs, setViolationLogs] = useState<string[]>([]);
  const [lastViolationReason, setLastViolationReason] = useState<string>('');
  const [showWarningModal, setShowWarningModal] = useState(false);
  const MAX_VIOLATIONS = 3; 
  
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!quiz) {
      const found = sessions.find(q => String(q.id) === String(id));
      if (found) setQuiz(found);
      else navigate('/active');
    }
  }, [id, sessions, quiz, navigate]);

  useEffect(() => {
    if (quiz && quiz.timeLimit && timeLeft === null) {
      setTimeLeft(quiz.timeLimit * 60);
    }
  }, [quiz, timeLeft]);

  const finishQuiz = useCallback((isForcedViolation = false) => {
    if (isFinished || !currentUser || !quiz) return;
    
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const hasManual = quiz.questions.some(q => q.type === QuestionType.OPEN_ENDED || q.type === QuestionType.RANGE);
    
    // В итоговый результат передаем накопленный score
    const result: AttemptResult = {
      id: `res-${Date.now()}`, 
      quizId: quiz.id, 
      quizTitle: quiz.title, 
      userId: currentUser.id, 
      score: isForcedViolation ? 0 : correctCount, 
      maxPossibleScore: quiz.questions.length,
      percentage: isForcedViolation ? 0 : Math.round((correctCount / quiz.questions.length) * 100), 
      date: Date.now(), 
      status: hasManual ? 'pending' : 'completed',
      answers, 
      manualScores: {},
      questions: quiz.questions,
      violations: isForcedViolation ? (MAX_VIOLATIONS + 1) : violationCount,
      violationDetails: violationLogs,
      timeSpent: timeSpent
    };
    
    saveResult(result);
    setIsFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [isFinished, currentUser, quiz, answers, violationCount, violationLogs, saveResult, startTime, correctCount]);

  useEffect(() => {
    const handleViolation = (reason: string) => {
      if (isFinished) return;
      
      const userMessage = reason === "visibility" ? "Вы свернули вкладку или переключили окно" : "Вы вставили скопированный текст";
      setViolationLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${userMessage}`]);
      setLastViolationReason(userMessage);
      
      setViolationCount(prev => {
        const next = prev + 1;
        if (next > MAX_VIOLATIONS) {
          finishQuiz(true); 
        } else {
          setShowWarningModal(true);
        }
        return next;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleViolation("visibility");
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      handleViolation("paste");
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('paste', handlePaste);
    };
  }, [isFinished, finishQuiz]);

  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0 && !isFinished) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timeLeft === 0 && !isFinished) {
      finishQuiz();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, isFinished, finishQuiz]);

  if (!quiz || !currentUser) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSelectOption = (qId: string, optIndex: number, type: QuestionType) => {
    if (isCurrentQuestionChecked) return; // Запрещаем менять ответ после проверки

    setAnswers(prev => {
      const currentSelected = (prev[qId] as number[]) || [];
      if (type === QuestionType.SINGLE_CHOICE) return { ...prev, [qId]: [optIndex] };
      return { ...prev, [qId]: currentSelected.includes(optIndex) ? currentSelected.filter(i => i !== optIndex) : [...currentSelected, optIndex] };
    });
  };

  const checkCurrentAnswer = () => {
    const q = quiz.questions[currentStep];
    if (q.type === QuestionType.OPEN_ENDED || q.type === QuestionType.RANGE) {
        setIsCurrentQuestionChecked(true);
        return;
    }

    const userAns = (answers[q.id] as number[]) || [];
    if (userAns.length === 0) {
        alert("Выберите вариант ответа");
        return;
    }

    const correct = q.correctAnswers;
    const isCorrect = q.type === QuestionType.SINGLE_CHOICE 
        ? (userAns[0] === correct[0]) 
        : (userAns.length === correct.length && userAns.every(v => correct.includes(v)));

    if (isCorrect) {
        setCorrectCount(prev => prev + 1);
    }
    setIsCurrentQuestionChecked(true);
  };

  const nextStep = () => {
    if (currentStep < quiz.questions.length - 1) {
        setCurrentStep(prev => prev + 1);
        setIsCurrentQuestionChecked(false);
    } else {
        finishQuiz();
    }
  };

  if (isFinished) {
    const isDisqualified = violationCount > MAX_VIOLATIONS;
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
                Результат: {correctCount} из {quiz.questions.length}
            </p>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-10">Ваши ответы приняты системой Belinda.</p>
          </>
        )}
        <button onClick={() => navigate('/results')} className="w-full bg-brand-secondary text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl border-b-4 border-black active:translate-y-1 active:border-b-0 transition-all">К результатам</button>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentStep];
  const hasSelected = !!answers[currentQuestion.id];

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
                    const userAns = (answers[currentQuestion.id] as number[]) || [];
                    const correct = currentQuestion.correctAnswers;
                    const isCorrect = currentQuestion.type === QuestionType.SINGLE_CHOICE 
                        ? (userAns[0] === correct[0]) 
                        : (userAns.length === correct.length && userAns.every(v => correct.includes(v)));
                    return (
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isCorrect ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-brand-primary border border-red-100'}`}>
                            {isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                            {isCorrect ? 'Верно' : 'Ошибка'}
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
                const isCorrectOption = (currentQuestion.correctAnswers || []).includes(idx);
                
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
          onClick={() => {
              if (currentStep > 0) {
                  setCurrentStep(prev => prev - 1);
                  setIsCurrentQuestionChecked(true); // Предыдущие уже проверены
              }
          }} 
          disabled={currentStep === 0 || !isCurrentQuestionChecked} 
          className="flex items-center gap-2 px-6 py-4 text-gray-400 font-black text-[11px] uppercase tracking-widest disabled:opacity-0 hover:text-brand-secondary transition-colors"
        >
          <ArrowLeft size={18} /> Назад
        </button>

        {!isCurrentQuestionChecked ? (
           <button 
             onClick={checkCurrentAnswer} 
             disabled={!hasSelected}
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
