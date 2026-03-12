
import React, { useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { QuestionType } from '../types';
import { ShieldAlert, Activity, Info, Search, ArrowUpRight, ArrowDownRight, Pencil, Database, Filter, ExternalLink, ChevronRight, Folder, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuestionStats {
  id: string; 
  text: string;
  templateId: string;
  templateTitle: string;
  group: string;
  type: QuestionType;
  totalAttempts: number;
  correctCount: number;
  successRate: number;
}

export const TestValidation: React.FC = () => {
  const { results, quizzes, sessions } = useStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');

  const availableGroups = useMemo(() => {
    const groups = new Set(quizzes.filter(q => !q.isSession).map(q => String(q.group || 'Без группы')));
    return Array.from(groups).sort();
  }, [quizzes]);

  const stats = useMemo(() => {
    const qStats: Record<string, QuestionStats> = {};

    results.forEach((res) => {
      const questionsSnapshot = res.questions || [];
      const sourceQuiz = quizzes.find((q) => q.id === res.quizId) || sessions.find((s) => s.id === res.quizId);
      
      const questionsToAnalyze = questionsSnapshot.length > 0 ? questionsSnapshot : (sourceQuiz?.questions || []);
      
      if (questionsToAnalyze.length === 0) return;

      questionsToAnalyze.forEach((q) => {
        if (q.type === QuestionType.OPEN_ENDED || q.type === QuestionType.RANGE) return;

        const key = `${String(q.text || '').trim().toLowerCase()}`;
        
        if (!qStats[key]) {
          // Пытаемся найти ID именно в БАНКЕ (quizzes), если результат пришел из сессии
          let bestTemplateId = sourceQuiz?.id || 'unknown';
          if (sourceQuiz?.isSession) {
            const sameInBank = quizzes.find(bankQ => bankQ.title === sourceQuiz.title);
            if (sameInBank) bestTemplateId = sameInBank.id;
          }

          qStats[key] = {
            id: key,
            text: String(q.text || ''),
            templateId: bestTemplateId,
            templateTitle: String(res.quizTitle || sourceQuiz?.title || 'Без названия'),
            group: String(sourceQuiz?.group || 'Общие'),
            type: q.type,
            totalAttempts: 0,
            correctCount: 0,
            successRate: 0
          };
        }

        qStats[key].totalAttempts += 1;
        
        const userAns = (res.answers[q.id] as number[]) || [];
        const correct = q.correctAnswers || [];
        const isCorrect = q.type === QuestionType.SINGLE_CHOICE 
          ? (userAns[0] === correct[0]) 
          : (userAns.length === correct.length && userAns.every((v) => correct.includes(v)));

        if (isCorrect) {
          qStats[key].correctCount += 1;
        }
      });
    });

    return Object.values(qStats).map((s) => ({
      ...s,
      successRate: s.totalAttempts > 0 ? Math.round((s.correctCount / s.totalAttempts) * 100) : 0
    })).sort((a, b) => a.successRate - b.successRate);
  }, [results, quizzes, sessions]);

  const filteredStats = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return stats.filter((s) => {
      const textMatch = String(s.text || '').toLowerCase().includes(searchLower);
      const titleMatch = String(s.templateTitle || '').toLowerCase().includes(searchLower);
      const matchesSearch = textMatch || titleMatch;
      const matchesGroup = groupFilter === 'ALL' || s.group === groupFilter;

      let matchesType = true;
      if (filterType === 'TOO_EASY') matchesType = s.successRate > 85;
      else if (filterType === 'TOO_HARD') matchesType = s.successRate < 20;
      else if (filterType === 'OPTIMAL') matchesType = s.successRate >= 40 && s.successRate <= 60;

      return matchesSearch && matchesType && matchesGroup;
    });
  }, [stats, searchTerm, filterType, groupFilter]);

  const getVerdict = (rate: number, attempts: number) => {
    if (attempts < 3) return { label: 'Мало данных', color: 'text-amber-500 bg-amber-50', icon: AlertTriangle };
    if (rate > 85) return { label: 'Слишком легкий', color: 'text-brand-secondary bg-gray-100', icon: ArrowUpRight };
    if (rate < 20) return { label: 'Слишком сложный', color: 'text-brand-primary bg-red-50', icon: ArrowDownRight };
    if (rate >= 40 && rate <= 60) return { label: 'Оптимальный', color: 'text-green-600 bg-green-50', icon: Activity };
    return { label: 'Средний', color: 'text-gray-400 bg-gray-50', icon: Info };
  };

  const filterOptions = [
    { id: 'ALL', l: 'Все' },
    { id: 'TOO_EASY', l: 'Легкие' },
    { id: 'OPTIMAL', l: 'Идеал (50%)' },
    { id: 'TOO_HARD', l: 'Сложные' }
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-xl font-black text-brand-secondary tracking-tight">Валидация <span className="text-brand-primary">тестов</span></h2>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Анализ качества и сложности вопросов из Банка</p>
        </div>
        <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100">
          {filterOptions.map((t) => (
            <button 
              key={t.id}
              onClick={() => setFilterType(t.id)}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${filterType === t.id ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-400 hover:text-brand-secondary'}`}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative">
          <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
          <input 
            type="text"
            placeholder="Поиск вопроса или шаблона..."
            className="w-full pl-12 pr-4 py-2.5 bg-gray-50/50 rounded-xl outline-none focus:ring-1 focus:ring-brand-primary transition-all font-bold text-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <Folder className="text-gray-300 ml-2" size={16} />
          <div className="flex-1">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Группа из Банка Тестов</p>
            <select 
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="w-full bg-gray-50 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-1 focus:ring-brand-primary appearance-none border-none"
            >
              <option value="ALL">Все группы в банке</option>
              {availableGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-gray-50/50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b">
              <tr>
                <th className="px-6 py-4">Вопрос / Расположение в Банке</th>
                <th className="px-6 py-4 text-center">Выборка</th>
                <th className="px-6 py-4 text-center">Успех %</th>
                <th className="px-6 py-4">Вердикт Belinda</th>
                <th className="px-6 py-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredStats.map((s) => {
                const verdict = getVerdict(s.successRate, s.totalAttempts);
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-5 max-w-md">
                      <div className="space-y-2">
                        <p className="font-bold text-brand-secondary leading-tight text-xs">{s.text}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                           <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-brand-primary rounded-md text-[8px] font-black uppercase border border-red-100">
                             <Folder size={10} />
                             {s.group}
                           </span>
                           <ChevronRight size={10} className="text-gray-300" />
                           <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400">
                             <Database size={10} className="text-gray-300" />
                             {s.templateTitle}
                           </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-black px-2 py-1 rounded-md border text-[10px] ${s.totalAttempts < 3 ? 'text-amber-500 bg-amber-50 border-amber-100' : 'text-gray-400 bg-white border-gray-100'}`}>
                        {s.totalAttempts} отв.
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-sm font-black ${s.successRate < 20 ? 'text-brand-primary' : s.successRate > 85 ? 'text-brand-secondary' : 'text-green-600'}`}>
                          {s.successRate}%
                        </span>
                        <div className="w-12 bg-gray-100 h-1 rounded-full mt-1 overflow-hidden">
                           <div className={`h-full ${s.successRate < 20 ? 'bg-brand-primary' : s.successRate > 85 ? 'bg-brand-secondary' : 'bg-green-600'}`} style={{ width: `${s.successRate}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[8px] uppercase tracking-widest ${verdict.color}`}>
                          <verdict.icon size={12} />
                          {verdict.label}
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-2">
                          {s.templateId !== 'unknown' && (
                            <button 
                              onClick={() => navigate(`/edit/${s.templateId}`)}
                              title="Редактировать в банке"
                              className="p-2 text-brand-secondary hover:text-white hover:bg-brand-primary bg-white rounded-lg border border-gray-100 shadow-sm transition-all flex items-center gap-1.5 font-black text-[9px] uppercase group/btn"
                            >
                              <Pencil size={12} className="group-hover/btn:scale-110 transition-transform" />
                              Исправить
                            </button>
                          )}
                       </div>
                    </td>
                  </tr>
                );
              })}
              {filteredStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <Search size={48} className="text-gray-200 mb-3" />
                      <p className="text-xs font-black text-brand-secondary uppercase tracking-widest">Нет данных для анализа</p>
                      <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase">Пройдите хотя бы один тест, чтобы здесь появилась статистика</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-brand-secondary text-white p-6 rounded-3xl shadow-xl border-b-4 border-brand-primary">
        <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
          <Info size={18} className="text-brand-primary" /> Памятка администратору
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[10px] leading-relaxed">
          <div className="space-y-2 opacity-90 p-4 bg-white/5 rounded-2xl">
            <p className="font-black text-brand-primary uppercase flex items-center gap-2"><Activity size={14}/> Идеальный вариант (50%)</p>
            <p>Такой вопрос разделяет тех, кто действительно знает материал, от тех, кто пытается угадать. Это "золотой стандарт" аттестации.</p>
          </div>
          <div className="space-y-2 opacity-90 p-4 bg-white/5 rounded-2xl">
            <p className="font-black text-gray-400 uppercase flex items-center gap-2"><ArrowUpRight size={14}/> Слишком легкие (&gt;85%)</p>
            <p>Если все отвечают правильно, вопрос бесполезен. Сотрудники не учатся, а вы не получаете данных о реальных знаниях.</p>
          </div>
          <div className="space-y-2 opacity-90 p-4 bg-white/5 rounded-2xl">
            <p className="font-black text-brand-primary uppercase flex items-center gap-2"><ArrowDownRight size={14}/> Слишком сложные (&lt;20%)</p>
            <p>Сигнал о проблеме: ошибка в ключе ответа в Банке или вопрос по неусвоенной теме. Требует вмешательства в шаблон.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
