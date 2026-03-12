
import React from 'react';
import { useStore } from '../context/StoreContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CheckCircle2, XCircle, Hourglass, ExternalLink, Award, Target, TrendingUp, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Results: React.FC = () => {
  const { results, currentUser, sessions, quizzes } = useStore();
  const getPassThreshold = (quizId: string) => {
    const s = sessions?.find(s => String(s.id) === String(quizId));
    const q = quizzes?.find(q => String(q.id) === String(quizId));
    return (s || q)?.passThreshold ?? 60;
  };

  const myResults = currentUser ? results.filter(r => r.userId === currentUser.id) : [];

  const chartData = myResults
    .filter(r => r.status === 'completed' && (r.violations || 0) <= 3)
    .slice(0, 10)
    .reverse()
    .map(r => ({
      name: r.quizTitle.length > 15 ? r.quizTitle.substring(0, 15) + '...' : r.quizTitle,
      score: r.percentage
    }));

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in pb-12 px-2 md:px-0">
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-lg md:text-xl font-black text-brand-secondary uppercase tracking-tight leading-none">Мои <span className="text-brand-primary">результаты</span></h2>
          <p className="text-[8px] md:text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Belinda Assessment Center</p>
        </div>
        <div className="bg-gray-50 px-3 py-1.5 rounded-xl border flex items-center gap-2">
           <Award className="text-brand-primary" size={14} />
           <span className="text-[9px] font-black uppercase text-brand-secondary">Топ-баллы: {myResults.filter(r=>r.percentage>=90 && (r.violations || 0) <= 3).length}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-red-50 text-brand-primary rounded-lg flex items-center justify-center shrink-0"><Target size={18}/></div>
          <div>
            <p className="text-gray-400 text-[8px] font-black uppercase tracking-widest leading-none mb-1">Всего</p>
            <p className="text-lg md:text-xl font-black text-brand-secondary">{myResults.length}</p>
          </div>
        </div>
        <div className="bg-brand-secondary p-4 rounded-2xl shadow-lg border-b-2 border-brand-primary flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-white/10 text-brand-primary rounded-lg flex items-center justify-center shrink-0"><TrendingUp size={18}/></div>
          <div>
            <p className="text-gray-400 text-[8px] font-black uppercase tracking-widest leading-none mb-1">Средний</p>
            <p className="text-lg md:text-xl font-black text-white">
              {myResults.filter(r => r.status === 'completed' && (r.violations || 0) <= 3).length > 0 
                ? Math.round(myResults.filter(r => r.status === 'completed' && (r.violations || 0) <= 3).reduce((acc, curr) => acc + curr.percentage, 0) / myResults.filter(r => r.status === 'completed' && (r.violations || 0) <= 3).length) 
                : 0}%
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 hidden md:flex">
          <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0"><CheckCircle2 size={20}/></div>
          <div>
            <p className="text-gray-400 text-[8px] font-black uppercase tracking-widest leading-none mb-1">Успешно</p>
            <p className="text-xl font-black text-green-600">
              {myResults.filter(r => r.status === 'completed' && r.percentage >= getPassThreshold(r.quizId) && (r.violations || 0) <= 3).length}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50/30">
          <h3 className="text-[10px] font-black text-brand-secondary uppercase tracking-widest">История аттестаций</h3>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-gray-50/50 text-gray-400 font-black text-[8px] uppercase border-b">
              <tr>
                <th className="px-4 py-3">Аттестация</th>
                <th className="px-4 py-3 text-center">Балл</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-bold">
              {myResults.map((result) => {
                const isDisqualified = (result.violations || 0) > 3;
                return (
                  <tr key={result.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-brand-secondary line-clamp-1">{result.quizTitle}</p>
                      <p className="text-[7px] text-gray-300 font-bold uppercase">{new Date(result.date).toLocaleDateString()}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isDisqualified ? (
                        <span className="text-brand-primary font-black uppercase text-[8px]">Отмена</span>
                      ) : result.status === 'completed' ? (
                        <span className={`text-[13px] font-black ${result.percentage >= getPassThreshold(result.quizId) ? 'text-green-600' : 'text-brand-primary'}`}>{result.percentage}%</span>
                      ) : (
                        <span className="text-amber-600 uppercase text-[8px]">...</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isDisqualified ? (
                         <ShieldAlert size={14} className="text-brand-primary" />
                      ) : result.status === 'pending' ? (
                        <Hourglass size={14} className="text-amber-600" />
                      ) : result.percentage >= getPassThreshold(result.quizId) ? (
                        <CheckCircle2 size={14} className="text-green-600" />
                      ) : (
                        <XCircle size={14} className="text-brand-primary" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(result.status === 'completed' || isDisqualified) && (
                        <Link to={`/results/${result.id}`} className="p-1.5 text-gray-300 hover:text-brand-primary transition-colors inline-block">
                          <ExternalLink size={16} />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {myResults.length === 0 && (
            <div className="p-12 text-center text-gray-300 text-[9px] font-black uppercase tracking-widest">Список пуст</div>
          )}
        </div>
      </div>
    </div>
  );
};
