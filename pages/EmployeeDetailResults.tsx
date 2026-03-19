
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { QuestionType } from '../types';
import { generateEmployeeAnalytics, EmployeeAnalyticsReport, QuestionPerformance } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { CheckCircle2, XCircle, Hourglass, ExternalLink, ArrowLeft, User, Briefcase, MapPin, Calendar, ShieldAlert, Sparkles, Loader2, TrendingUp, AlertCircle, Target, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

export const EmployeeDetailResults: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { results, employees, positions, sessions, quizzes, currentUser } = useStore();

  if (currentUser?.role === 'employee' && id !== currentUser.id) {
    navigate('/active', { replace: true });
    return null;
  }
  const [aiReport, setAiReport] = useState<EmployeeAnalyticsReport | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const employee = employees.find(e => e.id === id);
  const employeeResults = results.filter(r => r.userId === id).sort((a, b) => b.date - a.date);
  const positionName = positions.find(p => p.id === employee?.positionId)?.name || 'Не указана';
  const getPassThreshold = (quizId: string) => {
    const s = sessions?.find(s => String(s.id) === String(quizId));
    const q = quizzes?.find(q => String(q.id) === String(quizId));
    return (s || q)?.passThreshold ?? 60;
  };

  if (!employee) {
    return (
      <div className="p-12 text-center text-gray-500 text-[10px] font-black uppercase">
        Сотрудник не найден
      </div>
    );
  }

  const chartData = [...employeeResults]
    .filter(r => (r.violations || 0) <= 3)
    .reverse()
    .map(r => ({
      date: new Date(r.date).toLocaleDateString(),
      score: r.percentage,
      title: r.quizTitle
    }));

  const validResults = employeeResults.filter(r => r.status === 'completed' && (r.violations || 0) <= 3);
  const avgScore = validResults.length > 0 
    ? Math.round(validResults.reduce((acc, curr) => acc + curr.percentage, 0) / validResults.length) 
    : 0;

  const questionPerformances = useMemo((): QuestionPerformance[] => {
    const out: QuestionPerformance[] = [];
    validResults.forEach(res => {
      let questions = res.questions || [];
      if (questions.length === 0) {
        const quiz = sessions?.find(s => String(s.id) === String(res.quizId)) || quizzes?.find(q => String(q.id) === String(res.quizId));
        questions = quiz?.questions || [];
      }
      questions.forEach(q => {
        if (q.type === QuestionType.SINGLE_CHOICE || q.type === QuestionType.MULTIPLE_CHOICE) {
          const userAns = (res.answers[q.id] as number[]) || [];
          const correct = q.correctAnswers || [];
          const isCorrect = q.type === QuestionType.SINGLE_CHOICE
            ? (userAns[0] === correct[0])
            : (userAns.length === correct.length && userAns.every(v => correct.includes(v)));
          out.push({ questionText: q.text, quizTitle: res.quizTitle, correct: isCorrect });
        } else if (q.type === QuestionType.OPEN_ENDED || q.type === QuestionType.RANGE) {
          const score = res.manualScores?.[q.id] ?? 0;
          const maxScore = 5;
          out.push({ questionText: q.text, quizTitle: res.quizTitle, correct: score >= 3, score, maxScore });
        }
      });
    });
    return out;
  }, [validResults, sessions, quizzes]);

  const handleGenerateAnalytics = async () => {
    if (questionPerformances.length === 0) {
      setAiError('Недостаточно данных по вопросам для анализа');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const report = await generateEmployeeAnalytics(employee.fullName, avgScore, questionPerformances);
      setAiReport(report);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Не удалось сгенерировать отчёт. Проверьте GEMINI_API_KEY.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    const successfulCount = employeeResults.filter(r => r.status === 'completed' && r.percentage >= getPassThreshold(r.quizId) && (r.violations || 0) <= 3).length;
    let text = `Результаты аттестаций — ${employee.fullName}\n`;
    text += `${'='.repeat(50)}\n\n`;
    text += `Должность: ${positionName}\n`;
    text += `Группа: ${employee.group}\n`;
    text += `Область: ${employee.area}\n\n`;
    text += `Средний балл: ${avgScore}%\n`;
    text += `Тестов пройдено: ${employeeResults.length}\n`;
    text += `Успешно сдано: ${successfulCount}\n\n`;
    text += `Результаты по тестам:\n`;
    text += `${'-'.repeat(50)}\n`;
    employeeResults.forEach(res => {
      const isDisqualified = (res.violations || 0) > 3;
      const status = isDisqualified ? 'Аннулирован' : res.status === 'pending' ? 'Проверка' : (res.percentage >= getPassThreshold(res.quizId) ? 'Сдано' : 'Не сдан');
      text += `${res.quizTitle} | ${new Date(res.date).toLocaleDateString()} | ${res.percentage}% | ${status}\n`;
    });
    if (aiReport) {
      text += `\n${'='.repeat(50)}\n`;
      text += `Аналитика от ИИ\n\n`;
      text += `Сильные стороны:\n`;
      aiReport.strengths.forEach(s => text += `• ${s}\n`);
      text += `\nСлабые стороны:\n`;
      aiReport.weaknesses.forEach(w => text += `• ${w}\n`);
      text += `\nРекомендации:\n`;
      aiReport.recommendations.forEach(r => text += `• ${r}\n`);
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Не удалось скопировать. Проверьте разрешения браузера.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(currentUser?.role === 'employee' ? '/results' : '/employees')} className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 text-gray-300 hover:text-brand-primary transition-all">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-black text-brand-secondary tracking-tight">{employee.fullName}</h2>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Личный прогресс аттестаций</p>
          </div>
        </div>
        <button
          onClick={handleCopyToClipboard}
          className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:bg-gray-50 hover:border-brand-primary transition-all font-bold text-[10px] uppercase tracking-widest text-brand-secondary"
        >
          {copied ? (
            <>
              <Check size={14} className="text-green-600" />
              Скопировано
            </>
          ) : (
            <>
              <Copy size={14} className="text-brand-primary" />
              Копировать для отправки сотруднику
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5 text-center">
             <div className="w-16 h-16 bg-brand-primary text-white rounded-2xl flex items-center justify-center font-black text-xl mx-auto shadow-md">
                {employee.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
             </div>
             <div className="space-y-3 pt-4 border-t border-gray-50 text-left">
               <div className="flex items-center gap-2.5 text-[10px] font-black text-brand-secondary uppercase">
                  <Briefcase size={14} className="text-brand-primary/40" />
                  {positionName}
               </div>
               <div className="flex items-center gap-2.5 text-[10px] font-black text-brand-secondary uppercase">
                  <User size={14} className="text-brand-primary/40" />
                  {employee.group}
               </div>
               <div className="flex items-center gap-2.5 text-[10px] font-black text-brand-secondary uppercase">
                  <MapPin size={14} className="text-brand-primary/40" />
                  {employee.area}
               </div>
             </div>
          </div>

          <div className="bg-brand-secondary text-white p-6 rounded-2xl shadow-lg border-b-4 border-brand-primary">
             <div className="text-center space-y-1">
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Средний балл</p>
                <p className={`text-4xl font-black ${avgScore >= 60 ? 'text-green-400' : 'text-brand-primary'}`}>{avgScore}%</p>
             </div>
             <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 mt-4">
                <div className="text-center">
                   <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Тестов</p>
                   <p className="text-lg font-black">{employeeResults.length}</p>
                </div>
                <div className="text-center">
                   <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Успешно</p>
                   <p className="text-lg font-black text-green-400">
                      {employeeResults.filter(r => r.status === 'completed' && r.percentage >= getPassThreshold(r.quizId) && (r.violations || 0) <= 3).length}
                   </p>
                </div>
             </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
           {chartData.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-[320px]">
              <h3 className="text-xs font-black text-brand-secondary uppercase tracking-widest mb-6">Динамика успеваемости</h3>
              <ResponsiveContainer width="100%" height="80%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                  <XAxis dataKey="date" fontSize={9} tickLine={false} axisLine={false} dy={8} fontStyle="bold" stroke="#cbd5e1" />
                  <YAxis fontSize={9} tickLine={false} axisLine={false} fontStyle="bold" stroke="#cbd5e1" domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 'bold' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    name="Балл"
                    stroke="#DF3B20" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#DF3B20', strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-5 border-b flex justify-between items-center">
                <h3 className="text-xs font-black text-brand-secondary uppercase tracking-widest">Все результаты</h3>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-gray-50/50 text-[9px] font-black text-gray-400 uppercase tracking-[0.1em] border-b">
                    <tr>
                      <th className="px-6 py-4">Тест / Сессия</th>
                      <th className="px-6 py-4">Дата</th>
                      <th className="px-6 py-4 text-center">Балл %</th>
                      <th className="px-6 py-4">Статус</th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-bold">
                    {employeeResults.map(res => {
                      const isDisqualified = (res.violations || 0) > 3;
                      return (
                        <tr key={res.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-brand-secondary">{res.quizTitle}</p>
                          </td>
                          <td className="px-6 py-4 text-gray-400">
                            {new Date(res.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isDisqualified ? (
                              <span className="text-brand-primary text-[10px] font-black uppercase">Аннулирован</span>
                            ) : (
                              <span className={`text-sm font-black ${res.percentage >= getPassThreshold(res.quizId) ? 'text-green-600' : 'text-brand-primary'}`}>
                                 {res.percentage}%
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isDisqualified ? (
                              <span className="inline-flex items-center gap-1 text-brand-primary text-[8px] font-black uppercase">
                                 <ShieldAlert size={10} /> Нарушение правил
                              </span>
                            ) : res.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1.5 text-amber-600 text-[8px] font-black uppercase">
                                 <Hourglass size={10} /> Проверка
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${res.percentage >= getPassThreshold(res.quizId) ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-brand-primary border border-red-100'}`}>
                                 {res.percentage >= getPassThreshold(res.quizId) ? 'Сдано' : 'Не сдан'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                             <Link to={`/results/${res.id}`} className="text-gray-300 hover:text-brand-primary transition-colors">
                               <ExternalLink size={16} />
                             </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
             </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xs font-black text-brand-secondary uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={14} className="text-brand-primary" /> Аналитика от ИИ
              </h3>
              {!aiReport && !aiLoading && (
                <button
                  onClick={handleGenerateAnalytics}
                  disabled={questionPerformances.length === 0}
                  className="px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-brand-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Sparkles size={12} /> Сгенерировать отчёт
                </button>
              )}
            </div>
            <div className="p-5">
              {aiLoading && (
                <div className="flex items-center gap-3 text-gray-400 py-8">
                  <Loader2 size={24} className="animate-spin" />
                  <span className="font-bold text-xs">Генерация отчёта...</span>
                </div>
              )}
              {aiError && !aiLoading && (
                <div className="flex items-center gap-3 text-brand-primary py-4">
                  <AlertCircle size={20} />
                  <span className="font-bold text-xs">{aiError}</span>
                </div>
              )}
              {aiReport && !aiLoading && (
                <div className="space-y-4">
                  <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                    <h4 className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <TrendingUp size={12} /> Сильные стороны
                    </h4>
                    <ul className="space-y-1.5 text-[11px] font-bold text-brand-secondary">
                      {aiReport.strengths.map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-green-500">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                    <h4 className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <AlertCircle size={12} /> Слабые стороны
                    </h4>
                    <ul className="space-y-1.5 text-[11px] font-bold text-brand-secondary">
                      {aiReport.weaknesses.map((w, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-amber-500">•</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                    <h4 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Target size={12} /> Рекомендации
                    </h4>
                    <ul className="space-y-1.5 text-[11px] font-bold text-brand-secondary">
                      {aiReport.recommendations.map((r, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-indigo-500">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {!aiReport && !aiLoading && !aiError && (
                <p className="text-[10px] text-gray-400 font-bold py-4">
                  {questionPerformances.length > 0
                    ? 'Нажмите «Сгенерировать отчёт», чтобы получить краткую аналитику по сильным и слабым сторонам сотрудника и рекомендации.'
                    : 'Недостаточно данных по отдельным вопросам для генерации аналитики.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
