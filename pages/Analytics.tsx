
import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { QuestionType, Question } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, Users, Target, ShieldAlert, MapPin, Briefcase, Award, AlertTriangle, ArrowUpRight, ArrowDownRight, ChevronRight, Medal, History, Zap, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const Analytics: React.FC = () => {
  const { results, employees, currentUser, currentRole, positions, sessions, quizzes } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quizIdFromUrl = searchParams.get('quizId');

  const [dateRange, setDateRange] = useState<'all' | 'month' | 'quarter'>('all');
  const [selectedArea, setSelectedArea] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedPosition, setSelectedPosition] = useState('all');
  const [selectedQuizId, setSelectedQuizId] = useState<string>(quizIdFromUrl || 'all');
  const [showViolationsModal, setShowViolationsModal] = useState(false);
  const [showRiskGroupModal, setShowRiskGroupModal] = useState(false);

  useEffect(() => {
    if (quizIdFromUrl) setSelectedQuizId(quizIdFromUrl);
  }, [quizIdFromUrl]);

  const accessibleData = useMemo(() => {
    let baseResults = results;
    let baseEmployees = employees;

    if (currentRole === 'manager' && currentUser) {
      const managedAreasNorm = (currentUser.managedAreas || (currentUser.managedArea ? [currentUser.managedArea] : [])).map(a => a.toLowerCase().trim());
      const mgrGroupNorm = (currentUser.group || "").toLowerCase().trim();
      const managedGroupsNorm = (currentUser.managedGroups || []).map(g => g.toLowerCase().trim());
      const hasDefinedGroups = managedGroupsNorm.length > 0;
      const hasDefinedAreas = managedAreasNorm.length > 0;

      baseEmployees = employees.filter(emp => {
        if (String(emp.id) === String(currentUser.id)) return false;
        const empAreaNorm = (emp.area || "").toLowerCase().trim();
        const empGroupNorm = (emp.group || "").toLowerCase().trim();
        const matchesArea = !hasDefinedAreas || managedAreasNorm.includes(empAreaNorm);
        let matchesGroup = hasDefinedGroups ? managedGroupsNorm.includes(empGroupNorm) : empGroupNorm === mgrGroupNorm;
        return matchesArea && matchesGroup;
      });

      const empIds = new Set(baseEmployees.map(e => String(e.id)));
      baseResults = results.filter(r => empIds.has(String(r.userId)));
    }
    return { results: baseResults, employees: baseEmployees };
  }, [results, employees, currentUser, currentRole]);

  const filteredResults = useMemo(() => {
    let list = accessibleData.results;
    const now = Date.now();
    if (dateRange === 'month') list = list.filter(r => (now - r.date) < 30 * 24 * 60 * 60 * 1000);
    else if (dateRange === 'quarter') list = list.filter(r => (now - r.date) < 90 * 24 * 60 * 60 * 1000);

    return list.filter(r => {
      const emp = accessibleData.employees.find(e => String(e.id) === String(r.userId));
      if (!emp) return false;
      return (selectedArea === 'all' || emp.area === selectedArea) &&
             (selectedGroup === 'all' || emp.group === selectedGroup) &&
             (selectedPosition === 'all' || emp.positionId === selectedPosition) &&
             (selectedQuizId === 'all' || r.quizId === selectedQuizId);
    });
  }, [accessibleData, dateRange, selectedArea, selectedGroup, selectedPosition, selectedQuizId]);

  const getPassThreshold = (quizId: string) => {
    const s = sessions?.find(s => String(s.id) === String(quizId));
    const q = quizzes?.find(q => String(q.id) === String(quizId));
    return (s || q)?.passThreshold ?? 60;
  };

  const kpis = useMemo(() => {
    if (filteredResults.length === 0) return { avg: 0, median: 0, passRate: 0, riskRate: 0, violations: 0, attempts: 0 };
    const scores = filteredResults.filter(r => r.status === 'completed').map(r => r.percentage);
    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const passed = filteredResults.filter(r => r.percentage >= getPassThreshold(r.quizId) && (r.violations || 0) <= 3).length;
    const risks = filteredResults.filter(r => r.percentage < 40 || (r.violations || 0) > 3).length;
    return { avg, passRate: Math.round((passed / filteredResults.length) * 100), riskRate: Math.round((risks / filteredResults.length) * 100), violations: filteredResults.reduce((a,c)=>a+(c.violations||0), 0), attempts: filteredResults.length };
  }, [filteredResults, sessions, quizzes]);

  const departmentChartData = useMemo(() => {
    const groups: Record<string, { name: string, avg: number, count: number, sum: number; quizIds: Set<string> }> = {};
    filteredResults.forEach(r => {
      const emp = accessibleData.employees.find(e => String(e.id) === String(r.userId));
      const gName = emp?.group || 'Прочие';
      if (!groups[gName]) groups[gName] = { name: gName, avg: 0, count: 0, sum: 0, quizIds: new Set() };
      groups[gName].count++;
      groups[gName].sum += r.percentage;
      groups[gName].quizIds.add(String(r.quizId));
    });
    return Object.values(groups).map(({ quizIds, ...g }) => ({ ...g, avg: Math.round(g.sum / g.count), topicsCount: quizIds.size })).sort((a,b) => b.avg - a.avg);
  }, [filteredResults, accessibleData]);

  const riskGroupData = useMemo(() => {
    const failures: { id: string; name: string; group: string; date: number; quizTitle: string; percentage: number; threshold: number }[] = [];
    let totalViolations = 0;
    filteredResults.forEach(r => {
      const threshold = getPassThreshold(r.quizId);
      const isFailed = r.percentage < threshold || (r.violations || 0) > 3;
      if (isFailed && r.status === 'completed') {
        const emp = accessibleData.employees.find(e => String(e.id) === String(r.userId));
        failures.push({
          id: r.id,
          name: emp?.fullName || 'Неизвестно',
          group: emp?.group || '—',
          date: r.date,
          quizTitle: r.quizTitle,
          percentage: r.percentage,
          threshold
        });
      }
      totalViolations += r.violations || 0;
    });
    return { failures: failures.sort((a, b) => a.date - b.date).reverse(), totalViolations };
  }, [filteredResults, accessibleData.employees, sessions, quizzes]);

  const violationRecords = useMemo(() => {
    return filteredResults
      .filter(r => (r.violations || 0) > 0)
      .map(r => {
        const emp = accessibleData.employees.find(e => String(e.id) === String(r.userId));
        return {
          id: r.id,
          name: emp?.fullName || 'Неизвестно',
          group: emp?.group || '—',
          date: r.date,
          quizTitle: r.quizTitle,
          violations: r.violations || 0,
          details: r.violationDetails || []
        };
      })
      .sort((a, b) => b.date - a.date);
  }, [filteredResults, accessibleData.employees]);

  const allAreas = useMemo(() => Array.from(new Set(accessibleData.employees.map(e => String(e.area || '').trim()))).filter(Boolean).sort(), [accessibleData.employees]);

  const filteredGroups = useMemo(() => {
    let emps = accessibleData.employees;
    if (selectedArea !== 'all') emps = emps.filter(e => String(e.area || '').trim() === selectedArea);
    return Array.from(new Set(emps.map(e => String(e.group || '').trim()))).filter(Boolean).sort();
  }, [accessibleData.employees, selectedArea]);

  const baseResultsForFilters = useMemo(() => {
    let list = accessibleData.results;
    const now = Date.now();
    if (dateRange === 'month') list = list.filter(r => (now - r.date) < 30 * 24 * 60 * 60 * 1000);
    else if (dateRange === 'quarter') list = list.filter(r => (now - r.date) < 90 * 24 * 60 * 60 * 1000);
    return list.filter(r => {
      const emp = accessibleData.employees.find(e => String(e.id) === String(r.userId));
      if (!emp) return false;
      return (selectedArea === 'all' || emp.area === selectedArea) &&
             (selectedGroup === 'all' || emp.group === selectedGroup);
    });
  }, [accessibleData, dateRange, selectedArea, selectedGroup]);

  const filteredSessions = useMemo(() => {
    const quizIds = new Set(baseResultsForFilters.map(r => r.quizId));
    return (sessions || []).filter(s => quizIds.has(s.id));
  }, [sessions, baseResultsForFilters]);

  useEffect(() => {
    if (selectedGroup !== 'all' && !filteredGroups.includes(selectedGroup)) setSelectedGroup('all');
  }, [selectedArea, filteredGroups, selectedGroup]);

  useEffect(() => {
    if (selectedQuizId !== 'all' && !filteredSessions.some(s => s.id === selectedQuizId)) setSelectedQuizId('all');
  }, [selectedArea, selectedGroup, filteredSessions, selectedQuizId]);

  const topEmployees = useMemo(() => {
    const userStats: Record<string, { id: string, name: string, avg: number, count: number, sum: number, group: string, area: string }> = {};
    filteredResults.forEach(r => {
      const uid = String(r.userId);
      if (!userStats[uid]) {
        const emp = accessibleData.employees.find(e => String(e.id) === uid);
        userStats[uid] = { id: uid, name: emp?.fullName || 'Удален', avg: 0, count: 0, sum: 0, group: emp?.group || '—', area: emp?.area || '—' };
      }
      userStats[uid].count++;
      userStats[uid].sum += r.percentage;
    });
    return Object.values(userStats).map(u => ({ ...u, avg: Math.round(u.sum / u.count) })).sort((a, b) => b.avg - a.avg).slice(0, 5);
  }, [filteredResults, accessibleData]);

  const allParticipants = useMemo(() => {
    const userStats: Record<string, { id: string, name: string, avg: number, count: number, sum: number, group: string, area: string; quizIds: Set<string> }> = {};
    filteredResults.forEach(r => {
      const uid = String(r.userId);
      if (!userStats[uid]) {
        const emp = accessibleData.employees.find(e => String(e.id) === uid);
        userStats[uid] = { id: uid, name: emp?.fullName || 'Удален', avg: 0, count: 0, sum: 0, group: emp?.group || '—', area: emp?.area || '—', quizIds: new Set() };
      }
      userStats[uid].count++;
      userStats[uid].sum += r.percentage;
      userStats[uid].quizIds.add(String(r.quizId));
    });
    return Object.values(userStats).map(({ quizIds, ...u }) => ({
      ...u,
      avg: Math.round(u.sum / u.count),
      topicsCount: quizIds.size,
      attemptsCount: 1
    })).sort((a, b) => b.avg - a.avg);
  }, [filteredResults, accessibleData]);

  const recommendationData = useMemo(() => {
    const threshold = 60;
    if (filteredResults.length === 0) {
      return { text: 'Нет данных для анализа. Пройдите аттестации для получения рекомендаций.', type: 'empty' as const, details: null };
    }
    const lowGroupsData = departmentChartData.filter(g => g.avg < threshold);
    const lowGroupNames = lowGroupsData.map(g => g.name);
    const lowEmployees = allParticipants.filter(u => u.avg < threshold && lowGroupNames.includes(u.group));
    if (kpis.avg >= threshold) {
      return { text: 'Уровень компетенций в норме. Рекомендуется обновить банк вопросов для предотвращения "привыкания".', type: 'ok' as const, details: null };
    }
    const parts: string[] = [];
    lowGroupsData.forEach(g => {
      parts.push(`${g.name}: средний балл ${g.avg}% (${g.topicsCount} тем)`);
    });
    const namesList = lowEmployees.slice(0, 8).map(u => `${u.name} (${u.group}, ${u.avg}%)`).join('; ');
    if (namesList) parts.push(`Сотрудники для обучения: ${namesList}${lowEmployees.length > 8 ? ' и ещё ' + (lowEmployees.length - 8) + ' чел.' : ''}.`);
    return { text: `Требуется дополнительное обучение. ${parts.join('. ')}`, type: 'low' as const, details: { lowGroupsData, lowEmployees } };
  }, [filteredResults.length, kpis.avg, departmentChartData, allParticipants]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-brand-secondary tracking-tight">Аналитика <span className="text-brand-primary">Belinda</span></h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
              {selectedQuizId !== 'all' ? (
                <>Результаты по тесту: <span className="text-brand-primary">{(sessions || []).find(s => s.id === selectedQuizId)?.title || 'Тест'}</span></>
              ) : (
                'Корпоративная отчетность'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 text-[10px] font-black uppercase tracking-wider text-brand-secondary outline-none focus:ring-1 focus:ring-brand-primary">
              <option value="all">Все области</option>
              {allAreas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 text-[10px] font-black uppercase tracking-wider text-brand-secondary outline-none focus:ring-1 focus:ring-brand-primary">
              <option value="all">Все группы</option>
              {filteredGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={selectedQuizId} onChange={(e) => setSelectedQuizId(e.target.value)} className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 text-[10px] font-black uppercase tracking-wider text-brand-secondary outline-none focus:ring-1 focus:ring-brand-primary">
              <option value="all">Все тесты</option>
              {filteredSessions.map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
               {(['all', 'month', 'quarter'] as const).map(p => (
                 <button key={p} onClick={() => setDateRange(p)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${dateRange === p ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-400 hover:text-brand-secondary'}`}>
                   {p === 'all' ? 'Все время' : p === 'month' ? '30 дней' : 'Квартал'}
                 </button>
               ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Средний балл', val: `${kpis.avg}%`, icon: Target, color: 'text-brand-primary', bg: 'bg-red-50', onClick: undefined },
          { label: 'Процент сдачи', val: `${kpis.passRate}%`, icon: Award, color: 'text-green-600', bg: 'bg-green-50', onClick: undefined },
          { label: 'Инциденты', val: kpis.violations, icon: ShieldAlert, color: 'text-brand-primary', bg: 'bg-red-50', onClick: () => setShowViolationsModal(true) },
          { label: 'Всего попыток', val: kpis.attempts, icon: History, color: 'text-brand-secondary', bg: 'bg-gray-50', onClick: undefined },
        ].map((k, i) => (
          <div key={i} onClick={k.onClick} title={k.label === 'Инциденты' ? 'Нажмите для просмотра нарушителей' : undefined} className={`bg-white p-5 rounded-2xl border border-gray-100 shadow-sm text-center space-y-2 ${k.onClick ? 'cursor-pointer hover:border-brand-primary/30 hover:shadow-md transition-all' : ''}`}>
             <div className={`w-8 h-8 rounded-lg ${k.bg} ${k.color} flex items-center justify-center mx-auto`}>
               <k.icon size={16} />
             </div>
             <p className="text-2xl font-black text-brand-secondary leading-none">{k.val}</p>
             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="text-[10px] font-black text-brand-secondary uppercase tracking-widest mb-6 flex items-center gap-2">
               <TrendingUp size={14} className="text-brand-primary" /> Результативность отделов
            </h3>
            <ResponsiveContainer width="100%" height={240}>
               <BarChart data={departmentChartData} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis dataKey="name" type="category" fontSize={8} tickLine={false} axisLine={false} fontStyle="bold" stroke="#64748b" width={70} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', fontSize: '10px' }} />
                  <Bar dataKey="avg" name="Средний балл" radius={[0, 8, 8, 0]} barSize={18}>
                     {departmentChartData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.avg >= 60 ? '#10b981' : '#DF3B20'} />
                     ))}
                  </Bar>
               </BarChart>
            </ResponsiveContainer>
         </div>

         <div onClick={() => setShowRiskGroupModal(true)} className="lg:col-span-1 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-center text-center space-y-4 cursor-pointer hover:border-brand-primary/30 hover:shadow-md transition-all" title="Нажмите для подробной информации">
            <h3 className="text-[10px] font-black text-brand-secondary uppercase tracking-widest flex items-center gap-2 justify-center">
               <AlertTriangle size={14} className="text-amber-500" /> Группа риска
            </h3>
            <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
              <p className="text-4xl font-black text-brand-primary">{kpis.riskRate}%</p>
              <p className="text-[9px] font-black text-brand-primary uppercase tracking-widest mt-1">Критический порог</p>
            </div>
            <div className="flex justify-between px-4">
               <div className="text-center">
                  <p className="text-lg font-black text-brand-secondary">{kpis.attempts - (kpis.attempts * kpis.passRate / 100 | 0)}</p>
                  <p className="text-[8px] font-black text-gray-400 uppercase">Провалы</p>
               </div>
               <div className="text-center">
                  <p className="text-lg font-black text-brand-secondary">{kpis.violations}</p>
                  <p className="text-[8px] font-black text-gray-400 uppercase">Ошибки безопасности</p>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 bg-gray-50/50 border-b">
               <h3 className="text-[9px] font-black text-brand-secondary uppercase tracking-widest flex items-center gap-2">
                  <Medal size={14} className="text-brand-primary" /> Лидеры рейтинга
               </h3>
            </div>
            <div className="divide-y divide-gray-50">
               {topEmployees.map((user, idx) => (
                 <div key={user.id} className="p-3.5 flex items-center justify-between hover:bg-gray-50 transition-all cursor-pointer" onClick={() => navigate(`/employees/${user.id}/results`)}>
                   <div className="flex items-center gap-3">
                     <div className="w-7 h-7 rounded-lg bg-red-50 text-brand-primary flex items-center justify-center font-black text-[9px]">{idx + 1}</div>
                     <div>
                       <p className="text-[11px] font-black text-brand-secondary">{user.name}</p>
                       <p className="text-[8px] font-bold text-gray-300 uppercase truncate max-w-[120px]">{user.group}</p>
                     </div>
                   </div>
                   <div className="text-right flex items-center gap-3">
                      <span className="text-sm font-black text-brand-secondary">{user.avg}%</span>
                      <ChevronRight size={14} className="text-gray-300" />
                   </div>
                 </div>
               ))}
            </div>
         </div>

         <div className={`bg-white p-6 rounded-3xl border shadow-sm flex flex-col gap-4 ${recommendationData.type === 'ok' ? 'border-green-100 bg-green-50/30' : recommendationData.type === 'low' ? 'border-amber-100 bg-amber-50/30' : 'border-gray-100'}`}>
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${recommendationData.type === 'ok' ? 'bg-green-100 text-green-600' : recommendationData.type === 'low' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                 <Zap size={20} />
              </div>
              <div className="min-w-0 flex-1">
                 <h4 className="text-[10px] font-black text-brand-secondary uppercase tracking-widest leading-none mb-2">Рекомендация ИИ</h4>
                 <p className={`text-[10px] font-medium leading-relaxed ${recommendationData.type === 'empty' ? 'text-gray-400' : 'text-brand-secondary'}`}>
                    {recommendationData.text}
                 </p>
                 {recommendationData.type === 'low' && recommendationData.details && recommendationData.details.lowEmployees.length > 0 && (
                   <div className="mt-3 pt-3 border-t border-amber-200/50">
                     <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-2">Список сотрудников ({recommendationData.details.lowEmployees.length}):</p>
                     <div className="flex flex-wrap gap-1.5">
                       {recommendationData.details.lowEmployees.map(u => (
                         <button key={u.id} onClick={() => navigate(`/employees/${u.id}/results`)} className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-[9px] font-bold transition-colors">
                           {u.name} — {u.avg}%
                         </button>
                       ))}
                     </div>
                   </div>
                 )}
              </div>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50/50 border-b flex items-center justify-between">
          <h3 className="text-[9px] font-black text-brand-secondary uppercase tracking-widest flex items-center gap-2">
            <Users size={14} className="text-brand-primary" /> Все участники
          </h3>
          <span className="text-[9px] font-bold text-gray-400">{allParticipants.length} чел.</span>
        </div>
        <div>
          <table className="w-full text-left text-[10px]">
            <thead className="bg-gray-50/50 sticky top-0">
              <tr>
                <th className="px-4 py-3 font-black text-gray-400 uppercase text-[8px]">#</th>
                <th className="px-4 py-3 font-black text-gray-400 uppercase text-[8px]">Сотрудник</th>
                <th className="px-4 py-3 font-black text-gray-400 uppercase text-[8px]">Область</th>
                <th className="px-4 py-3 font-black text-gray-400 uppercase text-[8px]">Группа</th>
                <th className="px-4 py-3 font-black text-gray-400 uppercase text-[8px] text-right">Средний балл</th>
                <th className="px-4 py-3 font-black text-gray-400 uppercase text-[8px] text-right">Кол-во тем</th>
                <th className="px-4 py-3 font-black text-gray-400 uppercase text-[8px] text-right">Попытки</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allParticipants.map((user, idx) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/employees/${user.id}/results`)}>
                  <td className="px-4 py-3 font-black text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-bold text-brand-secondary">{user.name}</td>
                  <td className="px-4 py-3 text-gray-500">{user.area}</td>
                  <td className="px-4 py-3 text-gray-500">{user.group}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-black ${user.avg >= 60 ? 'text-green-600' : user.avg >= 50 ? 'text-amber-600' : 'text-brand-primary'}`}>{user.avg}%</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-400">{user.topicsCount}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-400">{user.attemptsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {allParticipants.length === 0 && (
          <div className="p-12 text-center text-gray-400 text-[10px] font-black uppercase">Нет данных по выбранным фильтрам</div>
        )}
      </div>

      {showRiskGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowRiskGroupModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-brand-secondary">Группа риска — что это?</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Подробная информация о метриках</p>
              </div>
              <button onClick={() => setShowRiskGroupModal(false)} className="p-2 text-gray-300 hover:text-brand-primary rounded-xl transition-colors"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-6">
              <div>
                <h4 className="text-[10px] font-black text-brand-primary uppercase tracking-widest mb-2">Критический порог ({kpis.riskRate}%)</h4>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  Доля попыток с высоким риском: балл ниже 40% или более 3 нарушений правил. Показывает, какой процент аттестаций требует внимания.
                </p>
              </div>
              <div>
                <h4 className="text-[10px] font-black text-brand-primary uppercase tracking-widest mb-2">Провалы ({riskGroupData.failures.length})</h4>
                <p className="text-[11px] text-gray-600 leading-relaxed mb-3">
                  Попытки, не сданные по проходному баллу или аннулированные из‑за нарушений. Список сотрудников:
                </p>
                {riskGroupData.failures.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic">Нет провалов</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {riskGroupData.failures.map(f => (
                      <div key={f.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-brand-secondary text-sm">{f.name}</p>
                          <p className="text-[9px] text-gray-500">{f.group} • {f.quizTitle}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-black text-brand-primary">{f.percentage}%</p>
                          <p className="text-[8px] text-gray-400">{new Date(f.date).toLocaleDateString()}</p>
                        </div>
                        <button onClick={() => { setShowRiskGroupModal(false); navigate(`/results/${f.id}`); }} className="ml-2 text-[9px] font-black text-brand-primary hover:underline">→</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-[10px] font-black text-brand-primary uppercase tracking-widest mb-2">Ошибки безопасности ({kpis.violations})</h4>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  Суммарное количество зафиксированных нарушений правил (переключение вкладок, уход с экрана и т.п.). Нажмите на карточку «Инциденты» выше, чтобы увидеть детали по каждому нарушителю.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showViolationsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowViolationsModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-brand-secondary">Инциденты и нарушения</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{violationRecords.length} записей</p>
              </div>
              <button onClick={() => setShowViolationsModal(false)} className="p-2 text-gray-300 hover:text-brand-primary rounded-xl transition-colors"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {violationRecords.length === 0 ? (
                <p className="text-center text-gray-400 py-12 text-[11px] font-bold">Нет зафиксированных нарушений</p>
              ) : (
                <div className="space-y-3">
                  {violationRecords.map(v => (
                    <div key={v.id} className="p-4 rounded-xl border border-red-100 bg-red-50/50">
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <div>
                          <p className="font-black text-brand-secondary text-sm">{v.name}</p>
                          <p className="text-[9px] font-bold text-gray-500 uppercase">{v.group}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[9px] font-black text-gray-400">{new Date(v.date).toLocaleString()}</p>
                          <p className="text-[9px] font-bold text-brand-primary mt-0.5">{v.quizTitle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldAlert size={14} className="text-brand-primary" />
                        <span className="text-[10px] font-black text-brand-primary">Нарушений: {v.violations}</span>
                      </div>
                      {v.details.length > 0 && (
                        <ul className="mt-2 space-y-1 text-[10px] text-gray-600">
                          {v.details.map((d, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-brand-primary">•</span>
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <button onClick={() => { setShowViolationsModal(false); navigate(`/results/${v.id}`); }} className="mt-2 text-[9px] font-black text-brand-primary hover:underline uppercase">
                        Подробнее →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
