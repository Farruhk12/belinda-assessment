
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Search, Briefcase, MapPin, ChevronRight, BarChart3, UsersRound, TrendingUp, Target, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ManagerTeam: React.FC = () => {
  const { employees, positions, currentUser, results } = useStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  if (!currentUser || currentUser.role !== 'manager') return null;

  const teamMembers = useMemo(() => {
    // Нормализуем данные менеджера один раз для производительности
    const mgrAreaNorm = (currentUser.managedArea || currentUser.area || "").toLowerCase().trim();
    const mgrGroupNorm = (currentUser.group || "").toLowerCase().trim();
    const managedGroupsNorm = (currentUser.managedGroups || []).map(g => g.toLowerCase().trim());
    const hasDefinedGroups = managedGroupsNorm.length > 0;

    return employees.filter(emp => {
      // 1. Исключаем самого менеджера
      if (String(emp.id) === String(currentUser.id)) return false;
      
      const empAreaNorm = (emp.area || "").toLowerCase().trim();
      const empGroupNorm = (emp.group || "").toLowerCase().trim();

      // 2. Фильтр по Области (регистронезависимый)
      const matchesArea = !currentUser.managedArea || empAreaNorm === mgrAreaNorm;
      
      // 3. Фильтр по Группе (регистронезависимый)
      let matchesGroup = false;
      if (hasDefinedGroups) {
        matchesGroup = managedGroupsNorm.includes(empGroupNorm);
      } else {
        matchesGroup = empGroupNorm === mgrGroupNorm;
      }
      
      // 4. Поиск по тексту (уже был регистронезависимый)
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = emp.fullName.toLowerCase().includes(searchLower) || 
                            empGroupNorm.includes(searchLower);
                            
      return matchesArea && matchesGroup && matchesSearch;
    });
  }, [employees, currentUser, searchTerm]);

  const teamStats = useMemo(() => {
    const totalMembers = teamMembers.length;
    const teamUserIds = teamMembers.map(m => String(m.id));
    const teamResults = results.filter(r => teamUserIds.includes(String(r.userId)));
    const completedResults = teamResults.filter(r => r.status === 'completed');
    
    const avgScore = completedResults.length > 0 
      ? Math.round(completedResults.reduce((acc, curr) => acc + curr.percentage, 0) / completedResults.length)
      : 0;
      
    return { totalMembers, avgScore, completedCount: completedResults.length };
  }, [teamMembers, results]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="bg-brand-secondary p-6 md:p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 border-b-4 border-brand-primary">
        <div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight leading-none mb-2">Моя команда <span className="text-brand-primary">Belinda</span></h2>
          <p className="text-gray-400 text-[11px] font-medium">Контроль успеваемости сотрудников вашей зоны ответственности.</p>
        </div>
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Область</p>
            <p className="bg-white/10 px-3 py-1 rounded-lg font-black text-[10px] uppercase border border-white/10">{currentUser.managedArea || currentUser.area || 'Все'}</p>
          </div>
          <div className="text-center">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Доступно групп</p>
            <p className="bg-white/10 px-3 py-1 rounded-lg font-black text-[10px] uppercase border border-white/10">{currentUser.managedGroups?.length || 1}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-red-50 text-brand-primary rounded-xl flex items-center justify-center shadow-inner"><UsersRound size={20}/></div>
          <div>
            <div className="text-gray-400 text-[8px] font-black uppercase tracking-widest">В команде</div>
            <div className="text-xl font-black text-brand-secondary">{teamStats.totalMembers}</div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center shadow-inner"><TrendingUp size={20}/></div>
          <div>
            <div className="text-gray-400 text-[8px] font-black uppercase tracking-widest">Средний балл</div>
            <div className="text-xl font-black text-brand-secondary">{teamStats.avgScore}%</div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shadow-inner"><CheckCircle2 size={20}/></div>
          <div>
            <div className="text-gray-400 text-[8px] font-black uppercase tracking-widest">Сдано тестов</div>
            <div className="text-xl font-black text-green-600">{teamStats.completedCount}</div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
          <input 
            type="text"
            placeholder="Поиск сотрудника по имени или группе..."
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-red-50 transition-all font-bold text-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-gray-400 font-black text-[9px] uppercase tracking-[0.15em] border-b">
              <tr>
                <th className="px-6 py-4">Сотрудник</th>
                <th className="px-6 py-4">Должность / Группа</th>
                <th className="px-6 py-4">Область</th>
                <th className="px-6 py-4 text-center">Пройдено тестов</th>
                <th className="px-6 py-4 text-right">Результаты</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-[11px]">
              {teamMembers.map((emp) => {
                const position = positions.find(p => String(p.id) === String(emp.positionId))?.name || 'Не указана';
                const initials = emp.fullName.split(' ').map(n => n[0]).join('').substring(0, 2);
                const empResultsCount = results.filter(r => String(r.userId) === String(emp.id) && r.status === 'completed').length;

                return (
                  <tr key={emp.id} className="group hover:bg-gray-50 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-[10px] bg-red-50 text-brand-primary shadow-sm">
                          {initials}
                        </div>
                        <div>
                          <p className="font-black text-brand-secondary leading-tight">{emp.fullName}</p>
                          <p className="text-[9px] font-bold text-gray-300 mt-0.5 uppercase tracking-tighter">{emp.login}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="inline-flex items-center gap-1.5 font-black text-brand-secondary">
                          <Briefcase size={12} className="text-brand-primary/40" />
                          {position}
                        </span>
                        <span className="text-[9px] text-gray-400 font-bold mt-0.5 uppercase">{emp.group}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-gray-500 font-bold">
                        <MapPin size={12} className="text-gray-300" />
                        {emp.area}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-full font-black text-[10px]">
                          {empResultsCount}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => navigate(`/team/${emp.id}/results`)}
                        className="p-2 text-gray-300 hover:text-brand-primary hover:bg-white rounded-lg transition-all border border-transparent hover:border-gray-100 flex items-center justify-end gap-2 ml-auto"
                      >
                        <BarChart3 size={16} />
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {teamMembers.length === 0 && (
            <div className="p-20 text-center text-gray-400">
              <UsersRound size={32} className="text-gray-100 mx-auto mb-3" />
              <p className="font-black text-[10px] uppercase tracking-widest">Сотрудники не найдены</p>
              <p className="text-[9px] mt-1 italic">В зоне вашей ответственности или выбранных группах пока нет других сотрудников.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
