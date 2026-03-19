
import React, { ReactNode, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Database, PlayCircle, BarChart3, ClipboardCheck, Users, Menu, X, Inbox, Loader2, LogOut, BarChartBig, UsersRound, PieChart, Moon, Sun } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useTheme } from '../context/ThemeContext';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentRole, currentUser, logoutUser, isLoading, sheetsUrl } = useStore();
  const { theme, toggleTheme } = useTheme();

  const adminNav = [
    { name: 'Банк тестов', href: '/', icon: Database },
    { name: 'Назначить тест', href: '/take', icon: PlayCircle },
    { name: 'Проверка', href: '/review', icon: ClipboardCheck },
    { name: 'Аналитика', href: '/analytics', icon: PieChart },
    { name: 'Валидация', href: '/validation', icon: BarChartBig },
  ];

  const managerNav = [
    { name: 'Активные тесты', href: '/active', icon: Inbox },
    { name: 'Мои результаты', href: '/results', icon: BarChart3 },
    { name: 'Аналитика команды', href: '/analytics', icon: PieChart },
    { name: 'Моя команда', href: '/team', icon: UsersRound },
  ];

  const employeeNav = [
    { name: 'Активные тесты', href: '/active', icon: Inbox },
    { name: 'Мои результаты', href: '/results', icon: BarChart3 },
  ];

  let navigation = employeeNav;
  if (currentRole === 'admin') navigation = adminNav;
  else if (currentUser?.role === 'manager') navigation = managerNav;

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col md:flex-row overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 flex justify-between items-center sticky top-0 z-20">
        <div>
          <h1 className="text-xs font-black leading-none uppercase">
            <span className="text-brand-primary">Belinda</span> <span className="text-brand-secondary dark:text-gray-300">assessment</span>
          </h1>
          <p className="text-[7px] font-bold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-widest">Аттестация сотрудников</p>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1.5 text-gray-600 dark:text-gray-300">
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 shadow-sm transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-8 border-b">
            <div>
              <h1 className="text-lg font-black leading-tight uppercase tracking-tight">
                <span className="text-brand-primary">Belinda</span> <br />
                <span className="text-brand-secondary">assessment</span>
              </h1>
              <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-[0.2em] leading-tight">Аттестация сотрудников</p>
            </div>
          </div>
          
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-3 mb-2">Навигация</p>
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all
                      ${isActive 
                        ? 'bg-brand-primary text-white shadow-lg shadow-red-100' 
                        : 'text-brand-secondary/70 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-brand-secondary dark:hover:text-white'}
                    `}
                  >
                    <item.icon size={18} />
                    {item.name}
                  </NavLink>
              );
            })}
          </nav>

          <div className="p-4 border-t dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/50 space-y-4">
            {currentRole === 'admin' && (
              <NavLink
                to="/employees"
                onClick={() => setIsMobileMenuOpen(false)}
                end={false}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all
                  ${isActive
                    ? 'bg-brand-primary text-white shadow-lg shadow-red-100'
                    : 'text-brand-secondary/70 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-brand-secondary dark:hover:text-white'}`
                }
              >
                <Users size={18} />
                Сотрудники
              </NavLink>
            )}
            <button 
              onClick={toggleTheme}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold rounded-lg transition-all text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            </button>
            {currentUser && (
              <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-8 h-8 bg-brand-primary/10 text-brand-primary rounded-lg flex items-center justify-center font-black text-xs shrink-0">
                    {currentUser.fullName[0]}
                  </div>
                  <div className="truncate">
                    <p className="text-[10px] font-black text-brand-secondary dark:text-gray-200 truncate leading-tight">{currentUser.fullName}</p>
                    <p className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                      {currentUser.role === 'admin' ? 'Админ' : currentUser.role === 'manager' ? 'Менеджер' : 'Сотрудник'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-50 text-brand-primary rounded-lg hover:bg-brand-primary hover:text-white transition-all font-black text-[9px] uppercase tracking-widest"
                >
                  <LogOut size={12} />
                  Выход
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-5 md:p-8 overflow-y-auto h-screen bg-[#F8FAFC] dark:bg-gray-900">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="animate-spin text-brand-primary" size={32} />
              <h3 className="text-sm font-black text-brand-secondary dark:text-gray-200">Загрузка данных...</h3>
            </div>
          ) : children}
        </div>
      </main>
    </div>
  );
};
