
import React, { useState } from 'react';
import { MAX_VIOLATIONS } from '../types';
import { useStore } from '../context/StoreContext';
import { Link } from 'react-router-dom';
import { ClipboardCheck, User, Calendar, ArrowRight, AlertCircle, CheckCircle2, History, Search, Pencil, ShieldAlert } from 'lucide-react';
import { QuestionType } from '../types';

export const ReviewList: React.FC = () => {
  const { results, employees, sessions, quizzes } = useStore();
  const getPassThreshold = (quizId: string) => {
    const s = sessions?.find(s => String(s.id) === String(quizId));
    const q = quizzes?.find(q => String(q.id) === String(quizId));
    return (s || q)?.passThreshold ?? 60;
  };
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending');

  const pendingResults = results.filter(r => r.status === 'pending');
  
  const reviewedResults = results
    .filter(r => r.status === 'completed')
    .sort((a, b) => b.date - a.date);

  const currentList = activeTab === 'pending' ? pendingResults : reviewedResults;

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-brand-secondary">Проверка <span className="text-brand-primary">Belinda</span></h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Контроль качества ответов</p>
        </div>
        <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
          <button 
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'pending' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-400 hover:text-brand-secondary'}`}
          >
            Требуют проверки
            <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${activeTab === 'pending' ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
              {pendingResults.length}
            </span>
          </button>
          <button 
            onClick={() => setActiveTab('reviewed')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'reviewed' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-400 hover:text-brand-secondary'}`}
          >
            Проверенные
            <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${activeTab === 'reviewed' ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
              {reviewedResults.length}
            </span>
          </button>
        </div>
      </div>

      {currentList.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-20 text-center flex flex-col items-center">
          {activeTab === 'pending' ? (
            <>
              <div className="w-16 h-16 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-sm font-black text-brand-secondary uppercase tracking-widest">Очередь пуста</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Все открытые вопросы проверены</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-2xl flex items-center justify-center mb-4">
                <History size={32} />
              </div>
              <h3 className="text-sm font-black text-brand-secondary uppercase tracking-widest">Архив пуст</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Здесь появится история проверок</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {currentList.map((result) => {
            const employee = employees.find(e => String(e.id) === String(result.userId));
            const isReviewed = result.status === 'completed';
            const violationCount = result.violations || 0;
            const isDisqualified = violationCount > MAX_VIOLATIONS;
            
            return (
              <div key={result.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between shadow-sm hover:shadow-md hover:border-brand-primary/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isDisqualified ? 'bg-red-500 text-white shadow-lg' :
                    violationCount > 0 ? 'bg-red-50 text-brand-primary border border-red-100' :
                    isReviewed ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600 shadow-inner'
                  }`}>
                    {isDisqualified ? <ShieldAlert size={20} className="animate-pulse" /> : 
                     violationCount > 0 ? <AlertCircle size={20} /> :
                     isReviewed ? <CheckCircle2 size={20} /> : <AlertCircle size={20} className="animate-pulse" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm text-brand-secondary group-hover:text-brand-primary transition-colors">{result.quizTitle}</h3>
                      {violationCount > 0 && (
                        <div className="flex gap-1">
                          <span className={`${isDisqualified ? 'bg-red-600' : 'bg-brand-primary'} text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm`}>
                            {isDisqualified ? 'Крит. Нарушение' : `Нарушений: ${violationCount}`}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-4 text-[9px] font-black text-gray-400 uppercase tracking-tight mt-0.5">
                      <span className="flex items-center gap-1"><User size={12} className="text-brand-primary/40" /> {employee?.fullName || 'Сотрудник удален'}</span>
                      <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(result.date).toLocaleDateString()}</span>
                      {isReviewed && !isDisqualified && (
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${result.percentage >= getPassThreshold(result.quizId) ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-brand-primary border-red-100'}`}>
                          {result.percentage}%
                        </span>
                      )}
                      {isDisqualified && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black border bg-red-600 text-white border-red-600">
                          АННУЛИРОВАН
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isReviewed ? (
                    <>
                      {!isDisqualified && (
                        <Link 
                          to={`/review/${result.id}`} 
                          className="px-4 py-2 bg-gray-50 text-brand-secondary hover:bg-brand-primary hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2"
                          title="Исправить оценку"
                        >
                          <Pencil size={14} />
                          Исправить
                        </Link>
                      )}
                      <Link 
                        to={`/results/${result.id}`} 
                        className="px-4 py-2 bg-white border border-gray-100 text-brand-secondary hover:bg-gray-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                      >
                        Детали
                      </Link>
                    </>
                  ) : (
                    <Link 
                      to={`/review/${result.id}`} 
                      className="px-6 py-2 bg-brand-primary text-white hover:bg-brand-secondary rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2"
                    >
                      Проверить
                      <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
