
import React, { useState } from 'react';
import { questionCredit } from '../api/_lib/scoring';
import { useUi } from '../context/UiContext';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { QuestionType } from '../types';
import { evaluateAnswerWithAI } from '../services/geminiService';
import { Check, X, ArrowLeft, Save, User, Info, MessageSquare, ListFilter, AlertCircle, History, Sparkles, Loader2 } from 'lucide-react';

export const ReviewAttempt: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { results, sessions, updateResult, employees } = useStore();
  const { notify } = useUi();

  const result = results.find(r => r.id === id);
  const quiz = sessions.find(q => q.id === result?.quizId);
  const employee = result ? employees.find(e => e.id === result.userId) : null;
  
  const [manualScores, setManualScores] = useState<Record<string, number>>(result?.manualScores || {});
  const [manualComments, setManualComments] = useState<Record<string, string>>(result?.manualComments || {});
  const [aiLoadingQuestionId, setAiLoadingQuestionId] = useState<string | null>(null);

  if (!result || !quiz) return <div className="p-12 text-center text-gray-500 text-xs">Загрузка...</div>;

  const manualGradingQuestions = quiz.questions.filter(q => q.type === QuestionType.OPEN_ENDED || q.type === QuestionType.RANGE);
  const isReReview = result.status === 'completed';

  const handleSaveReview = () => {
    if (Object.keys(manualScores).length < manualGradingQuestions.length) { 
      notify("Пожалуйста, оцените все открытые вопросы перед сохранением."); 
      return; 
    }

    let earnedPoints = 0;
    let maxPoints = 0;

    quiz.questions.forEach(q => {
      if (q.type !== QuestionType.OPEN_ENDED && q.type !== QuestionType.RANGE) {
        maxPoints += 1;
        earnedPoints += questionCredit(q, (result.answers[q.id] as number[]) || []);
      } else {
        // Каждый ручной вопрос оценивается до 5 баллов
        maxPoints += 5;
        earnedPoints += manualScores[q.id] || 0;
      }
    });

    earnedPoints = Math.round(earnedPoints * 100) / 100;

    updateResult(result.id, { 
      status: 'completed', 
      score: earnedPoints, 
      maxPossibleScore: maxPoints, 
      percentage: Math.round((earnedPoints / maxPoints) * 100), 
      manualScores, 
      manualComments 
    });

    navigate('/review');
  };

  const handleAiEvaluate = async (questionId: string, questionText: string, isRange: boolean) => {
    const rawAnswer = result.answers[questionId];
    const userAnswerStr = isRange && rawAnswer && typeof rawAnswer === 'object'
      ? `От ${(rawAnswer as any).from ?? '—'} до ${(rawAnswer as any).to ?? '—'}`
      : String(rawAnswer || '').trim();
    
    setAiLoadingQuestionId(questionId);
    try {
      const { score, comment } = await evaluateAnswerWithAI(questionText, userAnswerStr);
      setManualScores(prev => ({ ...prev, [questionId]: score }));
      setManualComments(prev => ({ ...prev, [questionId]: comment }));
    } catch (err) {
      notify('Не удалось получить оценку от ИИ. Проверьте подключение и ключ API.');
    } finally {
      setAiLoadingQuestionId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-3 pb-12 animate-fade-in">
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border shadow-sm">
        <button onClick={() => navigate('/review')} className="text-gray-400 hover:text-brand-secondary font-bold text-[9px] uppercase flex items-center gap-1">
          <ArrowLeft size={12} /> Назад к списку
        </button>
        <div className="flex items-center gap-2">
          {isReReview && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[8px] font-black uppercase border border-blue-100">
              <History size={10} /> Исправление оценки
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
            Сотрудник: <span className="text-brand-secondary">{employee?.fullName}</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <h2 className="text-base font-black text-brand-secondary leading-tight">{quiz.title}</h2>
        <p className="text-[9px] text-brand-primary font-bold uppercase mt-0.5 tracking-widest">
          {isReReview ? 'Редактирование результатов проверки' : 'Первичная проверка ответов'}
        </p>
      </div>

      <div className="space-y-3">
        {manualGradingQuestions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-brand-primary opacity-20"></div>
            <div className="p-3 bg-gray-50/50 border-b flex justify-between items-start">
              <div>
                <span className="text-[7px] font-black text-brand-primary uppercase tracking-[0.2em]">Вопрос #{idx+1}</span>
                <h3 className="text-xs font-black text-brand-secondary mt-0.5 leading-snug">{q.text}</h3>
              </div>
              <div className="px-1.5 py-0.5 bg-white rounded border text-[7px] font-black text-gray-400 uppercase shrink-0">
                {q.type === QuestionType.RANGE ? 'Диапазон' : 'Текст'}
              </div>
            </div>
            <div className="p-3 space-y-3">
              <div className="bg-white px-3 py-2 rounded-lg text-[11px] font-medium text-brand-secondary leading-relaxed border shadow-inner">
                {q.type === QuestionType.RANGE ? (
                  <div className="flex items-center justify-center gap-4 py-0">
                    <div className="text-center">
                      <p className="text-[6px] text-gray-400 uppercase font-black">От</p>
                      <p className="text-lg font-black text-brand-primary">{(result.answers[q.id] as any)?.from || '—'}</p>
                    </div>
                    <span className="text-gray-200 font-black">—</span>
                    <div className="text-center">
                      <p className="text-[6px] text-gray-400 uppercase font-black">До</p>
                      <p className="text-lg font-black text-brand-primary">{(result.answers[q.id] as any)?.to || '—'}</p>
                    </div>
                  </div>
                ) : (
                  <span className="whitespace-pre-wrap">{(result.answers[q.id] as string) || <span className="text-gray-300 italic text-[10px]">Ответ пуст</span>}</span>
                )}
              </div>
              
              <div className="flex flex-col items-center gap-2 bg-gray-50/50 p-2.5 rounded-lg border border-dashed">
                <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                  <p className="text-[7px] font-black text-brand-secondary uppercase tracking-[0.1em]">Выберите балл (0 - плохо, 5 - отлично)</p>
                  <button
                    type="button"
                    onClick={() => handleAiEvaluate(q.id, q.text, q.type === QuestionType.RANGE)}
                    disabled={aiLoadingQuestionId === q.id}
                    className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[7px] font-black uppercase border border-indigo-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {aiLoadingQuestionId === q.id ? (
                      <Loader2 size={9} className="animate-spin" />
                    ) : (
                      <Sparkles size={9} />
                    )}
                    {aiLoadingQuestionId === q.id ? 'Оценка...' : 'Оценить с ИИ'}
                  </button>
                </div>
                <div className="flex gap-1">
                  {[0,1,2,3,4,5].map(s => (
                    <button 
                      key={s} 
                      onClick={() => setManualScores({...manualScores, [q.id]: s})} 
                      className={`w-8 h-8 rounded-md font-black text-xs transition-all border-2 ${manualScores[q.id] === s ? 'bg-brand-primary text-white border-brand-primary shadow scale-105' : 'bg-white text-gray-300 border-gray-100 hover:border-brand-primary/30'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[7px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                  <MessageSquare size={9} /> Комментарий к оценке (видят сотрудники)
                </label>
                <textarea 
                  value={manualComments[q.id] || ''} 
                  onChange={(e) => setManualComments({...manualComments, [q.id]: e.target.value})} 
                  placeholder="Напишите, почему выставлен такой балл..." 
                  className="w-full px-2.5 py-2 bg-gray-50 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-brand-primary transition-all resize-y min-h-[56px] max-h-32 border-none" 
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex gap-3 pt-3">
        <button 
          onClick={() => navigate('/review')} 
          className="flex-1 bg-white text-gray-400 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest border border-gray-100 hover:bg-gray-50 transition-all"
        >
          Отмена
        </button>
        <button 
          onClick={handleSaveReview} 
          className="flex-[2] bg-brand-secondary text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-brand-primary shadow-xl transition-all flex items-center justify-center gap-2 border-b-4 border-black active:translate-y-1 active:border-b-0"
        >
          <Save size={14} />
          {isReReview ? 'Сохранить изменения' : 'Завершить проверку'}
        </button>
      </div>
    </div>
  );
};
