
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { UserPlus, Search, Filter, Edit2, Trash2, MapPin, Briefcase, ChevronRight, BarChart3, ShieldCheck, User, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const EmployeeList: React.FC = () => {
  const { employees, positions, deleteEmployee } = useStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('all');

  const filteredEmployees = employees.filter(emp => {
    const fullName = String(emp.fullName || '').toLowerCase();
    const login = String(emp.login || '').toLowerCase();
    const group = String(emp.group || '').toLowerCase();
    const searchLower = searchTerm.toLowerCase();

    return (fullName.includes(searchLower) || login.includes(searchLower) || group.includes(searchLower)) && 
           (selectedPosition === 'all' || emp.positionId === selectedPosition);
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-brand-secondary tracking-tight">Сотрудники <span className="text-brand-primary">Belinda</span></h2>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Управление кадрами</p>
        </div>
        <button 
          onClick={() => navigate('/employees/new')}
          className="bg-brand-primary text-white px-6 py-3 rounded-xl hover:bg-brand-secondary transition-all shadow-md font-bold flex items-center gap-2 text-xs uppercase tracking-widest"
        >
          <UserPlus size={14} />
          Добавить
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
          <input 
            type="text"
            placeholder="Поиск по ФИО, логину или отделу..."
            className="w-full pl-11 pr-4 py-2 bg-gray-50 rounded-xl outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary transition-all font-bold text-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          value={selectedPosition}
          onChange={(e) => setSelectedPosition(e.target.value)}
          className="bg-gray-50 px-4 py-2 rounded-xl outline-none font-black text-[9px] text-brand-secondary uppercase tracking-wider w-full md:w-auto"
        >
          <option value="all">Все должности</option>
          {positions.map(pos => <option key={pos.id} value={pos.id}>{pos.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-gray-400 font-black text-[9px] uppercase tracking-widest border-b">
              <tr>
                <th className="px-6 py-4">ФИО / Логин</th>
                <th className="px-6 py-4">Должность</th>
                <th className="px-6 py-4">Группа / Область</th>
                <th className="px-6 py-4">Роль</th>
                <th className="px-6 py-4 text-right">Управление</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-[11px]">
              {filteredEmployees.map((emp) => {
                const position = positions.find(p => p.id === emp.positionId)?.name || 'Не указана';
                const initials = (emp.fullName || '??').split(' ').map(n => n[0]).join('').substring(0, 2);
                
                return (
                  <tr key={emp.id} className="group hover:bg-gray-50 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-50 text-brand-primary flex items-center justify-center font-black text-[10px]">{initials}</div>
                        <div>
                          <p className="font-black text-brand-secondary leading-tight">{emp.fullName}</p>
                          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">{emp.login}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black text-brand-secondary uppercase truncate max-w-[120px] block">{position}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-black text-brand-secondary uppercase">{emp.group}</p>
                      <p className="text-[8px] text-gray-400 font-bold uppercase">{emp.area}</p>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase border ${emp.role === 'admin' ? 'bg-red-50 text-brand-primary border-red-100' : emp.role === 'manager' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-gray-50 text-gray-400'}`}>
                         {emp.role}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => navigate(`/employees/${emp.id}/results`)} className="p-1.5 text-gray-300 hover:text-brand-primary transition-colors"><BarChart3 size={14} /></button>
                        <button onClick={() => navigate(`/employees/edit/${emp.id}`)} className="p-1.5 text-gray-300 hover:text-brand-primary transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => { if(confirm('Удалить?')) deleteEmployee(emp.id) }} className="p-1.5 text-gray-300 hover:text-brand-primary transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
