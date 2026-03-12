
import React from 'react';
import { useStore } from '../context/StoreContext';
import { Link } from 'react-router-dom';
import { Play, BrainCircuit, Clock, Calendar } from 'lucide-react';

export const ActiveQuizzes: React.FC = () => {
  const { assignments, sessions, results, currentUser } = useStore();
  if (!currentUser) return null;
  const now = Date.now();

  const myAssignments = assignments.filter(asgn => {
    const isCompleted = results.some(r => r.quizId === asgn.quizId && r.userId === currentUser.id);
    if (isCompleted && !asgn.isRetake) return false;
    const quiz = sessions.find(q => q.id === asgn.quizId);
    if (!quiz || (quiz.availableUntil && now > quiz.availableUntil) || (quiz.availableFrom && now < quiz.availableFrom)) return false;
    
    const userArea = (currentUser.area || "").toLowerCase().trim();
    const userGroup = (currentUser.group || "").toLowerCase().trim();
    const targetArea = (asgn.targetArea || "").toLowerCase().trim();
    const targetGroup = (asgn.targetGroup || "").toLowerCase().trim();
    
    if (asgn.targetType === 'ALL') return true;
    if (asgn.targetType === 'INDIVIDUAL' && asgn.targetEmployeeId === currentUser.id) return true;
    if (asgn.targetType === 'AREA' && targetArea === userArea && userArea !== "") return true;
    if (asgn.targetType === 'GROUP' && targetGroup === userGroup && userGroup !== "") return true;
    if (asgn.targetType === 'AREA_GROUP' && targetArea === userArea && targetGroup === userGroup) return true;
    return false;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-brand-secondary tracking-tight">Ваши <span className="text-brand-primary">аттестации</span></h2>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Доступно к прохождению</p>
        </div>
        <div className="px-4 py-2 bg-green-50 text-green-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-green-100 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          {myAssignments.length} доступно
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {myAssignments.length === 0 ? (
          <div className="col-span-full py-16 bg-white rounded-3xl text-center border border-dashed border-gray-200">
             <BrainCircuit className="mx-auto mb-3 text-gray-100" size={48} />
             <p className="text-xs font-black text-gray-300 uppercase tracking-widest">Заданий пока нет</p>
          </div>
        ) : (
          myAssignments.map((asgn) => {
            const quiz = sessions.find(q => q.id === asgn.quizId);
            if (!quiz) return null;
            return (
              <div key={asgn.id} className="bg-white group rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-all flex flex-col cursor-pointer relative overflow-hidden h-[160px]">
                <div className="flex justify-between items-start mb-1.5">
                  <h5 className="text-[13px] font-black text-brand-secondary leading-tight group-hover:text-brand-primary transition-colors line-clamp-2 flex-1 pr-2">
                    {quiz.title}
                  </h5>
                  <div className="w-8 h-8 bg-brand-primary/10 text-brand-primary rounded-lg flex items-center justify-center shrink-0">
                    <BrainCircuit size={16} />
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[9px] font-bold text-gray-400 uppercase mb-4">
                  <span className="flex items-center gap-1"><Clock size={10} className="text-brand-primary/50" /> {quiz.timeLimit}м</span>
                  <span className="flex items-center gap-1"><Calendar size={10} className="text-brand-primary/50" /> {new Date(quiz.availableFrom || quiz.createdAt).toLocaleDateString()}</span>
                </div>
                
                <div className="mt-auto pt-3 border-t border-gray-50">
                  <Link 
                    to={`/take/${quiz.id}`} 
                    className="w-full bg-brand-secondary text-white py-2.5 rounded-xl font-black text-[9px] uppercase tracking-[0.1em] flex items-center justify-center gap-2 shadow-sm hover:bg-brand-primary transition-all"
                  >
                    Начать <Play size={10} fill="currentColor" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
