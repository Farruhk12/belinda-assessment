
import React from 'react';
import { questionCredit } from '../api/_lib/scoring';
import { MAX_VIOLATIONS } from '../types';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { QuestionType, Question } from '../types';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  MessageSquare, 
  Star, 
  ChevronRight, 
  FileX2, 
  Calendar,
  ShieldAlert,
  Clock
} from 'lucide-react';

export const ResultDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { results, sessions, quizzes } = useStore();
  const getPassThreshold = () => {
    if (!result) return 60;
    const s = sessions?.find(s => String(s.id) === String(result.quizId));
    const q = quizzes?.find(q => String(q.id) === String(result.quizId));
    return (s || q)?.passThreshold ?? 60;
  };

  const result = results.find(r => String(r.id) === String(id));
  
  let questionsToDisplay: Question[] = result?.questions || [];
  let fallbackQuiz = sessions.find(q => String(q.id) === String(result?.quizId));
  
  if (questionsToDisplay.length === 0 && !fallbackQuiz && result?.quizTitle) {
    const searchTitle = String(result.quizTitle).toLowerCase().trim();
    fallbackQuiz = quizzes.find(q => String(q.title).toLowerCase().trim() === searchTitle);
  }

  if (questionsToDisplay.length === 0 && fallbackQuiz) {
    questionsToDisplay = fallbackQuiz.questions || [];
  }

  if (!result) {
    return (
      <div className="p-12 text-center animate-fade-in flex flex-col items-center justify-center min-h-[60vh]">
        <FileX2 size={48} className="text-gray-200 mb-6" />
        <h2 className="text-[10px] font-black text-brand-secondary uppercase tracking-widest">Результат не найден</h2>
        <button onClick={() => navigate(-1)} className="mt-8 px-8 py-3 bg-brand-secondary text-white rounded-xl font-black text-[9px] uppercase shadow-xl">Вернуться назад</button>
      </div>
    );
  }

  const displayTitle = String(result.quizTitle || fallbackQuiz?.title || "Аттестация");
  const violationCount = result.violations || 0;
  const isDisqualified = violationCount > MAX_VIOLATIONS;

  return (
    <div className="max-w-3xl mx-auto space-y-4 md:space-y-8 pb-24 animate-fade-in px-2 md:px-0">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-gray-400 hover:text-brand-secondary font-black text-[9px] uppercase tracking-widest group transition-all shrink-0">
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Назад к истории
        </button>
        <div className="flex bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm text-[9px] font-black text-brand-secondary uppercase tracking-widest items-center gap-2">
          <Calendar size={12} className="text-brand-primary" /> {new Date(result.date).toLocaleDateString()}
        </div>
      </div>

      {/* Summary Card - Compact */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-1 h-full ${isDisqualified ? 'bg-brand-primary' : 'bg-brand-primary opacity-20'}`}></div>
        
        <div className="flex flex-col justify-center space-y-2 text-center md:text-left w-full">
          <h2 className="text-lg md:text-2xl font-black text-brand-secondary leading-tight line-clamp-2">{displayTitle}</h2>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
             <div className="flex items-center gap-1 text-gray-400 font-bold text-[7px] md:text-[8px] uppercase tracking-widest">
                <ShieldAlert size={10} className="text-brand-primary" /> Аналитика Integrity
             </div>
             {isDisqualified && (
               <span className="px-2 py-0.5 bg-brand-primary text-white rounded-lg text-[7px] font-black uppercase tracking-widest shadow-lg shadow-red-200">
                 Дисквалификация
               </span>
             )}
          </div>
        </div>
        
        <div className={`relative ${isDisqualified ? 'bg-brand-primary' : 'bg-brand-secondary'} p-4 md:p-6 rounded-xl md:rounded-2xl shadow-xl w-full md:min-w-[180px] flex flex-col items-center justify-center text-white border-b-4 border-black/20`}>
          {isDisqualified ? (
            <div className="text-center space-y-1">
              <ShieldAlert size={24} className="mx-auto text-white/90" />
              <p className="text-[9px] font-black uppercase tracking-widest leading-tight">Аннулировано</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-[7px] text-gray-400 uppercase tracking-widest font-black mb-0.5 opacity-80">Итоговая оценка</p>
              <p className={`text-4xl md:text-5xl font-black ${result.percentage >= getPassThreshold() ? 'text-green-400' : 'text-brand-primary'}`}>
                {result.percentage}%
              </p>
              <div className="w-full h-px bg-white/10 my-2"></div>
              <p className="text-gray-400 text-[8px] md:text-[9px] font-black uppercase tracking-widest">
                {result.score} / {result.maxPossibleScore} баллов
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Answer Details */}
      <div className="space-y-2">
        <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Детализация ответов</h3>
        {questionsToDisplay.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center border border-dashed border-gray-200">
             <AlertCircle size={24} className="mx-auto text-gray-200 mb-2" />
             <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Структура вопросов недоступна</p>
          </div>
        ) : (
          questionsToDisplay.map((q, idx) => {
            const userAnswer = result.answers[q.id];
            let isCorrect = false;
            let credit = 0;

            if (q.type === QuestionType.OPEN_ENDED || q.type === QuestionType.RANGE) {
              isCorrect = (result.manualScores?.[q.id] || 0) >= 3;
            } else {
              credit = questionCredit(q, (userAnswer as number[]) || []);
              isCorrect = credit === 1;
            }
            const isPartial = credit > 0 && credit < 1;

            return (
              <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col relative">
                <div className={`w-1 h-full absolute top-0 left-0 ${isCorrect ? 'bg-green-500' : isPartial ? 'bg-amber-500' : 'bg-brand-primary'}`}></div>
                <div className="p-3.5 pl-4">
                  <div className="flex justify-between items-center mb-2 gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 bg-brand-secondary text-white rounded-md flex items-center justify-center font-black text-[9px] shrink-0">
                        {idx + 1}
                      </div>
                      <span className="bg-gray-50 text-gray-400 text-[7px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter border border-gray-100 shrink-0">
                        {q.type}
                      </span>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest shrink-0 ${isCorrect ? 'bg-green-50 text-green-600 border border-green-100' : isPartial ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-red-50 text-brand-primary border border-red-100'}`}>
                      {isCorrect ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                      {isCorrect ? 'Верно' : isPartial ? `Частично ${Math.round(credit * 100)}%` : 'Неверно'}
                    </div>
                  </div>
                  
                  <h4 className="text-sm font-black text-brand-secondary mb-3 leading-snug">{q.text}</h4>
                  
                  {q.type !== QuestionType.OPEN_ENDED && q.type !== QuestionType.RANGE && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      {(q.options || []).map((opt, oIdx) => {
                        const userArr = (userAnswer as number[]) || [];
                        const isChosen = userArr.includes(oIdx);
                        const isCorrectOpt = (q.correctAnswers || []).includes(oIdx);
                        
                        let style = "bg-white border-gray-100 text-gray-400 opacity-60";
                        if (isChosen && isCorrectOpt) style = "bg-green-50 border-green-500 text-green-700 font-bold opacity-100";
                        else if (isChosen && !isCorrectOpt) style = "bg-red-50 border-brand-primary text-brand-primary font-bold opacity-100";
                        else if (!isChosen && isCorrectOpt) style = "bg-gray-50 border-dashed border-gray-200 text-brand-secondary opacity-80";

                        return (
                          <div key={oIdx} className={`px-2.5 py-2 rounded-lg border text-[9px] flex justify-between items-center gap-2 transition-all ${style}`}>
                            <span className="flex-1 min-w-0">{opt}</span>
                            {isChosen && (isCorrectOpt ? <CheckCircle2 size={10} /> : <XCircle size={10} />)}
                            {!isChosen && isCorrectOpt && <CheckCircle2 size={10} className="opacity-30 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(q.type === QuestionType.OPEN_ENDED || q.type === QuestionType.RANGE) && (
                    <div className="space-y-2">
                      <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-200 relative">
                        <span className="absolute -top-2 left-3 bg-white px-1.5 py-0.5 rounded border text-[6px] font-black text-gray-400 uppercase">Ваш ответ</span>
                        {q.type === QuestionType.RANGE ? (
                          <div className="flex items-center gap-3 py-1 justify-center">
                             <div className="text-center">
                               <p className="text-[6px] text-gray-400 uppercase font-black mb-0.5">Мин</p>
                               <p className="text-lg font-black text-brand-secondary">{(userAnswer as any)?.from || '—'}</p>
                             </div>
                             <ChevronRight size={14} className="text-gray-200" />
                             <div className="text-center">
                               <p className="text-[6px] text-gray-400 uppercase font-black mb-0.5">Макс</p>
                               <p className="text-lg font-black text-brand-secondary">{(userAnswer as any)?.to || '—'}</p>
                             </div>
                          </div>
                        ) : (
                          <p className="text-[10px] font-medium text-brand-secondary leading-relaxed whitespace-pre-wrap">
                            {typeof userAnswer === 'string' ? userAnswer : <span className="italic text-gray-300 text-[9px]">Пусто</span>}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2">
                         <div className="bg-brand-secondary text-white px-2.5 py-1 rounded-full text-[8px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                           <Star size={10} className="text-brand-primary" fill="currentColor" />
                           {result.manualScores?.[q.id] ?? 0} / 5
                         </div>
                         {result.manualComments?.[q.id] && (
                            <div className="flex-1 min-w-0 bg-brand-primary/5 border border-brand-primary/10 p-2 rounded-lg flex items-start gap-1.5">
                               <MessageSquare size={10} className="text-brand-primary shrink-0 mt-0.5" />
                               <p className="text-[9px] font-bold text-brand-secondary italic line-clamp-2">"{result.manualComments[q.id]}"</p>
                            </div>
                         )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="text-center pt-4">
        <button onClick={() => navigate(-1)} className="w-full md:w-auto px-12 py-4 bg-brand-secondary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl border-b-4 border-black transition-all active:translate-y-1 active:border-b-0">
          Вернуться к списку
        </button>
      </div>
    </div>
  );
};
