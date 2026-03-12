
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { ArrowLeft, Save, Plus, X, Briefcase, MapPin, Key, User, Settings, Trash2, ShieldCheck, Users, UsersRound, CheckCircle2 } from 'lucide-react';
import { Employee } from '../types';

export const EmployeeForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { employees, positions, addEmployee, updateEmployee, addPosition, deletePosition } = useStore();
  const isEditing = !!id;

  const [fullName, setFullName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [group, setGroup] = useState('');
  const [area, setArea] = useState('');
  const [positionId, setPositionId] = useState('');
  const [role, setRole] = useState<'admin' | 'employee' | 'manager'>('employee');
  
  // Дополнительные поля для менеджера
  const [managedArea, setManagedArea] = useState('');
  const [managedGroups, setManagedGroups] = useState<string[]>([]);
  
  const [showPosManager, setShowPosManager] = useState(false);
  const [newPosName, setNewPosName] = useState('');

  const allGroups = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.group.trim()))).filter(Boolean).sort();
  }, [employees]);

  const allAreas = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.area.trim()))).filter(Boolean).sort();
  }, [employees]);

  useEffect(() => {
    if (isEditing) {
      const emp = employees.find(e => e.id === id);
      if (emp) {
        setFullName(emp.fullName);
        setLogin(emp.login);
        setPassword(emp.password || '');
        setGroup(emp.group);
        setArea(emp.area);
        setPositionId(emp.positionId);
        setRole(emp.role || 'employee');
        setManagedArea(emp.managedArea || '');
        setManagedGroups(emp.managedGroups || []);
      }
    }
  }, [id, isEditing, employees]);

  const handleSave = () => {
    if (!fullName || !login || !positionId) {
      alert('Пожалуйста, заполните ФИО, логин и выберите должность');
      return;
    }

    const employeeData: Employee = {
      id: isEditing ? id : `emp-${Date.now()}`,
      fullName, login, password, group, area, positionId, role,
      managedArea: role === 'manager' ? managedArea : undefined,
      managedGroups: role === 'manager' ? managedGroups : undefined,
      createdAt: isEditing ? (employees.find(e => e.id === id)?.createdAt || Date.now()) : Date.now()
    };

    if (isEditing) updateEmployee(id, employeeData);
    else addEmployee(employeeData);
    navigate('/employees');
  };

  const toggleManagedGroup = (g: string) => {
    setManagedGroups(prev => 
      prev.includes(g) ? prev.filter(item => item !== g) : [...prev, g]
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <button onClick={() => navigate('/employees')} className="flex items-center gap-2 text-gray-400 hover:text-brand-primary font-black text-[10px] uppercase transition-colors">
          <ArrowLeft size={16} /> К списку
        </button>
        <h2 className="text-lg font-black text-brand-secondary">
          {isEditing ? 'Профиль сотрудника' : 'Новый профиль'}
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">
            <h3 className="font-black text-xs text-brand-secondary uppercase tracking-widest flex items-center gap-2 border-b pb-4">
              <ShieldCheck size={16} className="text-brand-primary" /> Уровень доступа
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'employee', label: 'Сотрудник', icon: Users },
                { id: 'manager', label: 'Менеджер', icon: UsersRound },
                { id: 'admin', label: 'Админ', icon: ShieldCheck },
              ].map(r => (
                <button 
                  key={r.id}
                  onClick={() => setRole(r.id as any)}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${role === r.id ? 'border-brand-primary bg-red-50/50 text-brand-primary' : 'border-gray-50 bg-gray-50 text-gray-400 hover:border-gray-100'}`}
                >
                  <r.icon size={20} />
                  <span className="font-black text-[9px] uppercase tracking-widest text-center">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {role === 'manager' && (
            <div className="bg-brand-secondary rounded-2xl p-6 shadow-xl space-y-6 animate-fade-in border-b-4 border-brand-primary">
              <h3 className="font-black text-xs text-white uppercase tracking-widest flex items-center gap-2 border-b border-white/10 pb-4">
                <UsersRound size={16} className="text-brand-primary" /> Зона ответственности менеджера
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 block">Контролируемая область</label>
                  <select 
                    value={managedArea} 
                    onChange={(e) => setManagedArea(e.target.value)}
                    className="w-full bg-white/10 border-none rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-primary outline-none font-bold text-xs text-white appearance-none"
                  >
                    <option value="" className="text-brand-secondary">Выберите область...</option>
                    {allAreas.map(a => <option key={a} value={a} className="text-brand-secondary">{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 block">Контролируемые группы (выберите несколько)</label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 pr-2 custom-scrollbar">
                    {allGroups.map(g => {
                      const isSelected = managedGroups.includes(g);
                      return (
                        <button 
                          key={g}
                          onClick={() => toggleManagedGroup(g)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold transition-all border ${isSelected ? 'bg-brand-primary border-brand-primary text-white' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                        >
                          <span className="truncate pr-2">{g}</span>
                          {isSelected && <CheckCircle2 size={12} />}
                        </button>
                      );
                    })}
                  </div>
                  {allGroups.length === 0 && <p className="text-[9px] text-gray-500 italic">Сначала создайте хотя бы одного сотрудника в группе.</p>}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            <h3 className="font-black text-xs text-brand-secondary uppercase tracking-widest flex items-center gap-2 border-b pb-4">
              <User size={16} className="text-brand-primary" /> Данные анкеты
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 block">ФИО полностью</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-primary outline-none font-bold text-xs" placeholder="Иванов Иван Иванович" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 block">Должность</label>
                  <div className="relative">
                    <select value={positionId} onChange={(e) => setPositionId(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-primary outline-none font-bold text-xs appearance-none">
                      <option value="">Выбор...</option>{positions.map(pos => <option key={pos.id} value={pos.id}>{pos.name}</option>)}
                    </select>
                    <button onClick={() => setShowPosManager(!showPosManager)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-300 hover:text-brand-primary transition-colors"><Settings size={14} /></button>
                  </div>
                </div>
                <div>
                  <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 block">Область</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                    <input type="text" value={area} onChange={(e) => setArea(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-3 focus:ring-1 focus:ring-brand-primary outline-none font-bold text-xs" placeholder="Душанбе" />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 block">Отдел / Группа</label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                  <input type="text" value={group} onChange={(e) => setGroup(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-3 focus:ring-1 focus:ring-brand-primary outline-none font-bold text-xs" placeholder="Продажи" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            <h3 className="font-black text-xs text-brand-secondary uppercase tracking-widest flex items-center gap-2 border-b pb-4">
              <Key size={16} className="text-brand-primary" /> Авторизация
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Логин</label>
                <input type="text" value={login} onChange={(e) => setLogin(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-primary outline-none font-bold text-xs" placeholder="i.ivanov" />
              </div>
              <div>
                <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Пароль</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-primary outline-none font-bold text-xs" placeholder="••••••••" />
              </div>
            </div>
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-brand-secondary text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-primary transition-all shadow-xl active:scale-95 border-b-4 border-black"
          >
            <Save size={18} className="inline mr-2" />
            {isEditing ? 'Обновить' : 'Сохранить'}
          </button>

          {showPosManager && (
            <div className="bg-brand-secondary text-white rounded-2xl p-5 shadow-xl animate-fade-in space-y-4">
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <h3 className="font-black text-[10px] uppercase tracking-widest">Должности</h3>
                <button onClick={() => setShowPosManager(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {positions.map(pos => (
                  <div key={pos.id} className="flex justify-between items-center bg-white/5 p-2 rounded-lg group">
                    <span className="font-bold text-[10px]">{pos.name}</span>
                    <button onClick={() => deletePosition(pos.id)} className="text-white/20 hover:text-brand-primary transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newPosName} onChange={(e) => setNewPosName(e.target.value)} className="flex-1 bg-white/10 border-none rounded-lg px-3 py-2 text-[10px] outline-none" placeholder="Новая..." />
                <button onClick={() => { if(newPosName) { addPosition(newPosName); setNewPosName(''); } }} className="bg-brand-primary p-2 rounded-lg"><Plus size={16} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
