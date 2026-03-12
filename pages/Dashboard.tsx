
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Trash2, ArrowRight, Briefcase, Pencil, Folder, Search, X, CheckCircle2, List, Layers, Package, FileQuestion, Copy } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Quiz, QuestionType } from '../types';

export const Dashboard: React.FC = () => {
  const { quizzes, deleteQuiz, addQuiz } = useStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    quizzes.filter(q => !q.isSession).forEach(q => (q.tags || []).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [quizzes]);

  const bankStructure = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    const filtered = quizzes.filter(q => {
      if (q.isSession) return false;
      const matchesTag = !selectedTag || (q.tags || []).includes(selectedTag);
      if (!matchesTag) return false;
      if (!searchLower) return true;
      
      const title = (q.title || '').toString().toLowerCase();
      const group = (q.group || '').toString().toLowerCase();
      const product = (q.product || '').toString().toLowerCase();
      const tagsStr = (q.tags || []).join(' ').toLowerCase();
      
      return title.includes(searchLower) ||
             group.includes(searchLower) ||
             product.includes(searchLower) ||
             tagsStr.includes(searchLower) ||
             (q.tags || []).some(t => t.toLowerCase().includes(searchLower));
    });

    const structure: Record<string, Quiz[]> = {};
    filtered.forEach(quiz => {
      const g = quiz.group || 'Общие';
      if (!structure[g]) structure[g] = [];
      structure[g].push(quiz);
    });
    return structure;
  }, [quizzes, searchTerm, selectedTag]);

  const bankEntries = Object.entries(bankStructure) as [string, Quiz[]][];

  const handleDuplicate = (e: React.MouseEvent, quiz: Quiz) => {
    e.stopPropagation();
    const newId = `quiz-${Date.now()}`;
    const duplicated: Quiz = {
      ...quiz,
      id: newId,
      title: `${quiz.title} (копия)`,
      createdAt: Date.now(),
      questions: (quiz.questions || []).map((q, i) => ({
        ...q,
        id: `q-${newId}-${i}-${Date.now()}`
      }))
    };
    addQuiz(duplicated);
    navigate(`/edit/${newId}`);
  };

  const summaryStats = useMemo(() => {
    const groups = Object.keys(bankStructure);
    const products = bankEntries.reduce((sum, [, qs]) => sum + qs.length, 0);
    const totalTests = bankEntries.reduce((sum, [, qs]) => {
      return sum + qs.reduce((s, q) => {
        const questions = q.questions || [];
        return s + questions.filter(qu => qu.type === QuestionType.SINGLE_CHOICE || qu.type === QuestionType.MULTIPLE_CHOICE).length;
      }, 0);
    }, 0);
    return { groups, products, totalTests };
  }, [bankStructure, bankEntries]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-brand-secondary tracking-tight">Банк тестов <span className="text-brand-primary">Belinda</span></h2>
            <p className="text-gray-400 font-medium text-[11px] uppercase tracking-widest">Управление шаблонами</p>
          </div>
          <Link 
            to="/create" 
            className="bg-brand-primary text-white px-6 py-3 rounded-xl hover:shadow-md transition-all font-bold flex items-center gap-2 group text-xs"
          >
            <span>Создать шаблон</span>
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
          <input 
            type="text"
            placeholder="Поиск по названию, группе, продукту, тегам..."
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:bg-white focus:ring-2 focus:ring-red-50 outline-none font-bold text-sm transition-all text-brand-secondary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${!selectedTag ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              Все
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${selectedTag === tag ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {bankEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <Layers size={24} className="text-brand-primary" />
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Группы</p>
              <p className="text-lg font-black text-brand-secondary">{summaryStats.groups.length}</p>
              <p className="text-[10px] font-bold text-gray-400 truncate max-w-[140px]" title={summaryStats.groups.join(', ')}>{summaryStats.groups.join(', ') || '—'}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
              <Package size={24} className="text-amber-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Продуктов</p>
              <p className="text-lg font-black text-brand-secondary">{summaryStats.products}</p>
              <p className="text-[10px] font-bold text-gray-400">шаблонов в банке</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
              <FileQuestion size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Тестов всего</p>
              <p className="text-lg font-black text-brand-secondary">{summaryStats.totalTests}</p>
              <p className="text-[10px] font-bold text-gray-400">тестовых вопросов</p>
            </div>
          </div>
        </div>
      )}

      {bankEntries.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
          <Folder className="text-gray-200 mx-auto mb-3" size={32} />
          <h3 className="text-sm font-bold text-brand-secondary">Банк Belinda пуст</h3>
          <p className="text-gray-400 text-[11px] italic">Здесь будут храниться ваши учебные материалы.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {bankEntries.map(([groupName, groupQuizzes]) => (
            <div key={groupName} className="space-y-2">
              <div className="flex items-center gap-2 ml-1">
                <div className="w-4 h-4 bg-red-50 rounded flex items-center justify-center text-brand-primary">
                  <Briefcase size={9} />
                </div>
                <h3 className="text-[9px] font-black text-brand-secondary uppercase tracking-[0.2em]">{groupName}</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {groupQuizzes.map((quiz) => {
                  const questions = quiz.questions || [];
                  const testCount = questions.filter(q => q.type === QuestionType.SINGLE_CHOICE || q.type === QuestionType.MULTIPLE_CHOICE).length;
                  const openCount = questions.filter(q => q.type === QuestionType.OPEN_ENDED || q.type === QuestionType.RANGE).length;

                  return (
                    <div 
                      key={quiz.id} 
                      onClick={() => setPreviewQuiz(quiz)}
                      className="bg-white group rounded-xl border border-gray-100 p-3 hover:shadow-md transition-all duration-200 flex flex-col cursor-pointer relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start">
                        <h5 className="text-[12px] font-black text-brand-secondary leading-tight group-hover:text-brand-primary transition-colors line-clamp-1 flex-1 pr-2">
                          {quiz.title}
                        </h5>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={(e) => handleDuplicate(e, quiz)} className="p-1 text-gray-300 hover:text-brand-primary transition-colors" title="Дублировать">
                            <Copy size={11} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/edit/${quiz.id}`); }} 
                            className="p-1 text-gray-300 hover:text-brand-primary transition-colors"
                          >
                            <Pencil size={11} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); if(confirm('Удалить?')) deleteQuiz(quiz.id); }} 
                            className="p-1 text-gray-300 hover:text-brand-primary transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      <p className="text-[8px] font-bold text-gray-300 uppercase tracking-tight truncate mb-1">
                        {quiz.product}
                      </p>
                      {(quiz.tags || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {(quiz.tags || []).slice(0, 3).map(t => (
                            <span key={t} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[7px] font-bold uppercase">{t}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest pt-2 border-t border-gray-50">
                        <span className="text-brand-primary">
                          {testCount} {testCount === 1 ? 'ТЕСТ' : (testCount > 1 && testCount < 5 ? 'ТЕСТА' : 'ТЕСТОВ')}
                        </span>
                        <span className="text-gray-200">
                          {openCount} {openCount === 1 ? 'ОТКРЫТЫЙ' : (openCount > 1 && openCount < 5 ? 'ОТКРЫТЫХ' : 'ОТКРЫТЫХ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewQuiz && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-brand-secondary/70 backdrop-blur-sm" onClick={() => setPreviewQuiz(null)}></div>
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl relative z-10 flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-lg font-black text-brand-secondary leading-tight">{previewQuiz.title}</h3>
                <p className="text-[9px] font-black text-brand-primary uppercase tracking-widest mt-0.5">{previewQuiz.group} • {previewQuiz.product}</p>
              </div>
              <button onClick={() => setPreviewQuiz(null)} className="p-2 text-gray-400 hover:text-brand-primary transition-all">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white custom-scrollbar">
              <div className="grid grid-cols-2 gap-3 mb-2">
                 <div className="bg-gray-50 p-3 rounded-xl border flex items-center gap-2">
                    <List className="text-brand-primary" size={16} />
                    <div>
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Вопросов всего</p>
                      <p className="font-black text-xs text-brand-secondary">{(previewQuiz.questions || []).length}</p>
                    </div>
                 </div>
                 <button 
                   onClick={() => { navigate(`/edit/${previewQuiz.id}`); setPreviewQuiz(null); }}
                   className="bg-brand-primary text-white p-3 rounded-xl flex items-center justify-center gap-2 hover:bg-brand-secondary transition-all shadow-md font-black text-[11px]"
                 >
                    <Pencil size={14} />
                    Редактировать
                 </button>
              </div>

              {(previewQuiz.questions || []).map((q, idx) => (
                <div key={q.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 bg-brand-secondary text-white rounded flex items-center justify-center text-[9px] font-black">{idx + 1}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded text-[8px] font-black text-gray-400 uppercase border border-gray-100">
                      {q.type === QuestionType.OPEN_ENDED ? 'Открытый' : q.type === QuestionType.RANGE ? 'Промежуток' : 'Тест'}
                    </span>
                  </div>
                  <h4 className="font-bold text-brand-secondary text-sm mb-3">{q.text}</h4>
                  
                  {q.type !== QuestionType.OPEN_ENDED && q.type !== QuestionType.RANGE && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(q.options || []).map((opt, oIdx) => {
                        const isCorrect = (q.correctAnswers || []).includes(oIdx);
                        return (
                          <div key={oIdx} className={`p-2 px-3 rounded-lg border text-[11px] flex items-center justify-between ${isCorrect ? 'bg-green-50 border-green-200 text-green-700 font-bold' : 'bg-white border-gray-50 text-gray-500'}`}>
                            {opt}
                            {isCorrect && <CheckCircle2 size={12} className="text-green-500" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="p-5 border-t bg-gray-50/50 flex justify-end">
              <button 
                onClick={() => setPreviewQuiz(null)}
                className="px-8 py-2.5 bg-brand-secondary text-white rounded-xl font-black text-xs hover:bg-brand-primary transition-all shadow-md"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
