
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Database, Lock, User, LogIn, Loader2, AlertCircle, Info, CloudAlert } from 'lucide-react';

export const Login: React.FC = () => {
  const { loginUser, isLoading, employees, sheetsUrl } = useStore();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login || !password) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const success = await loginUser(login, password);
      if (!success) {
        if (employees.length === 0) {
          setError('База данных пуста. Для первой настройки используйте логин "admin" и пароль "admin".');
        } else {
          setError('Неверный логин или пароль. Проверьте правильность ввода.');
        }
        setIsSubmitting(false);
      }
    } catch (err) {
      setError('Ошибка при попытке входа. Проверьте соединение с интернетом.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="max-w-xs w-full space-y-6">
        <div className="text-center space-y-3">
          <img src="https://belinda.tj/img/main-logo.svg" alt="Belinda" className="h-16 mx-auto mb-2" />
          <h1 className="text-2xl font-black tracking-tight leading-none">
            <span className="text-brand-primary">Belinda</span> <span className="text-brand-secondary">assessment</span>
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Аттестация сотрудников</p>
        </div>
        
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 space-y-6">
          <div className="space-y-1 text-center">
            <h2 className="text-lg font-black text-brand-secondary">Вход в систему</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Авторизация сотрудника</p>
          </div>

          {!sheetsUrl && (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
              <CloudAlert className="text-amber-600 shrink-0" size={16} />
              <p className="text-[9px] font-bold text-amber-800 leading-tight uppercase">
                Внимание: URL базы данных не настроен. Обратитесь к администратору.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <input 
                  type="text" 
                  value={login} 
                  onChange={(e) => setLogin(e.target.value)} 
                  required 
                  disabled={isLoading || isSubmitting}
                  className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-red-50 outline-none font-bold text-xs disabled:opacity-50" 
                  placeholder="Логин или ФИО" 
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  disabled={isLoading || isSubmitting}
                  className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-red-50 outline-none font-bold text-xs disabled:opacity-50" 
                  placeholder="Пароль" 
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex items-start gap-2 animate-fade-in">
                <AlertCircle className="text-brand-primary shrink-0" size={14} />
                <p className="text-[9px] font-bold text-brand-primary leading-tight uppercase">{error}</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting || isLoading} 
              className="w-full bg-brand-primary text-white py-4 rounded-xl font-black text-xs hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 border-b-4 border-red-800 active:border-b-0 active:translate-y-1"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Загрузка базы...</span>
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Проверка...</span>
                </>
              ) : (
                <>
                  <LogIn size={14} />
                  <span>Войти</span>
                </>
              )}
            </button>
          </form>
          
          {employees.length === 0 && !isLoading && (
            <div className="flex items-center gap-2 justify-center text-[8px] font-black text-gray-400 uppercase tracking-widest border-t pt-4">
              <Info size={12} />
              Первый вход? Используйте admin / admin
            </div>
          )}
        </div>
      </div>
    </div>
  );
};