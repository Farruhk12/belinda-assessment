
import React, { useState, useEffect, useRef } from 'react';
import { useUi } from '../context/UiContext';
import { useStore } from '../context/StoreContext';
import { Question, QuestionType, QuestionDifficulty, Quiz } from '../types';
import { generateQuizFromPDF, generateQuizFromText, type DifficultyLevel } from '../services/geminiService';
import { Sparkles, Plus, Trash, CheckCircle2, Save, Loader2, ArrowLeft, FileText, Upload, Settings2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

export const CreateQuiz: React.FC = () => {
  // Destructure updateSession from useStore hook to fix getState error
  const { addQuiz, updateQuiz, updateSession, quizzes, sessions } = useStore();
  const { notify } = useUi();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Аттестация');
  const [group, setGroup] = useState('');
  const [product, setProduct] = useState('');
  const [passThreshold, setPassThreshold] = useState<number>(60);
  const [tagsInput, setTagsInput] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [aiTextInput, setAiTextInput] = useState('');
  const [aiDifficulty, setAiDifficulty] = useState<DifficultyLevel>('medium');
  const [testCount, setTestCount] = useState(10);
  const [openCount, setOpenCount] = useState(3);
  const [mode, setMode] = useState<'manual' | 'ai'>('ai');
  const [showAddViaAI, setShowAddViaAI] = useState(false);

  // форма заполняется один раз: фоновое обновление данных не должно затирать несохранённые правки
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    if (isEditing && loadedId.current !== id) {
      // Ищем сначала в банке тестов, затем в сессиях (так как валидация может ссылаться на сессию)
      const quizToEdit = quizzes.find(q => String(q.id) === String(id)) || 
                         sessions.find(s => String(s.id) === String(id));
                         
      if (quizToEdit) {
        loadedId.current = id!;
        setTitle(quizToEdit.title || '');
        setDescription(quizToEdit.description || '');
        setCategory(quizToEdit.category || 'Аттестация');
        setGroup(quizToEdit.group || '');
        setProduct(quizToEdit.product || '');
        setPassThreshold(quizToEdit.passThreshold ?? 60);
        setTagsInput((quizToEdit.tags || []).join(', '));
        setQuestions(quizToEdit.questions || []);
        setMode('manual');
      }
    }
  }, [id, isEditing, quizzes, sessions]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const handleGenerateAI = async () => {
    if (!group || !product) {
      notify("Заполните Группу и Продукт.");
      return;
    }
    const hasText = aiTextInput.trim().length > 0;
    const hasPdf = !!pdfFile;
    if (!hasText && !hasPdf) {
      notify("Вставьте текст по теме или загрузите PDF.");
      return;
    }
    setIsGenerating(true);
    try {
      let generated;
      if (hasText) {
        generated = await generateQuizFromText(aiTextInput.trim(), testCount, openCount, aiDifficulty, { group, product });
      } else {
        const base64 = await fileToBase64(pdfFile!);
        generated = await generateQuizFromPDF(base64, testCount, openCount, { group, product });
      }
      const diffMap = { easy: 'easy' as const, medium: 'medium' as const, hard: 'hard' as const };
      const formatted: Question[] = generated.map((g, idx) => ({
        id: `ai-${Date.now()}-${idx}`,
        text: String(g.text || '').trim(),
        type: g.type as QuestionType,
        options: (g.options || []).map(o => String(o || '').trim()),
        correctAnswers: g.correctIndices || [],
        difficulty: diffMap[aiDifficulty]
      }));
      setQuestions(prev => (isEditing || showAddViaAI) ? [...formatted, ...prev] : formatted);
      if (!title) setTitle(`Тест: ${product}`);
      setMode('manual');
      if (showAddViaAI) {
        setShowAddViaAI(false);
        setAiTextInput('');
        setPdfFile(null);
      }
    } catch (e) {
      notify("Ошибка генерации ИИ. Проверьте API-ключ и подключение.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveQuiz = () => {
    if (!title || !group || !product || questions.length === 0) {
      notify("Заполните поля и добавьте вопросы.");
      return;
    }
    const trimmedQuestions: Question[] = questions.map(q => ({
      ...q,
      text: String(q.text || '').trim(),
      options: (q.options || []).map(opt => String(opt || '').trim())
    }));
    const tagsList = tagsInput.split(/[,\s]+/).map(t => t.trim()).filter(Boolean);
    const quizData: Quiz = {
      id: isEditing ? id : Date.now().toString(),
      title: title.trim(), description, category, group: group.trim(), product: product.trim(),
      passThreshold,
      tags: tagsList.length > 0 ? tagsList : undefined,
      createdAt: isEditing ? (quizzes.find(q => String(q.id) === String(id))?.createdAt || sessions.find(s => String(s.id) === String(id))?.createdAt || Date.now()) : Date.now(),
      questions: trimmedQuestions
    };
    if (isEditing) {
      // Если это была сессия, обновляем её, иначе шаблон в банке
      const isSession = sessions.some(s => String(s.id) === String(id));
      if (isSession) {
        // Fix: Call updateSession directly from context instead of using nonexistent getState()
        updateSession(String(id), quizData);
      } else {
        updateQuiz(String(id), quizData);
      }
    } else {
      addQuiz(quizData);
    }
    navigate('/');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-fade-in">
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-brand-primary font-bold text-xs transition-colors">
          <ArrowLeft size={16} />
          Назад
        </button>
        <h1 className="text-lg font-black text-brand-secondary">
          {isEditing ? 'Редактирование' : 'Новый шаблон'}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2 text-brand-secondary uppercase tracking-widest">
              <Settings2 size={14} className="text-brand-primary" />
              Параметры
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Группа', val: group, set: setGroup, ph: 'Отдел продаж' },
                { label: 'Продукт', val: product, set: setProduct, ph: 'Карта Visa' },
                { label: 'Название', val: title, set: setTitle, ph: 'Финальный тест' }
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">{f.label}</label>
                  <input type="text" value={f.val} onChange={(e) => f.set(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-brand-primary outline-none font-bold text-xs text-brand-secondary" placeholder={f.ph} />
                </div>
              ))}
              <div>
                <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Проходной балл (%)</label>
                <input type="number" min={1} max={100} value={passThreshold} onChange={(e)=>setPassThreshold(Math.min(100, Math.max(1, parseInt(e.target.value)||60)))} className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-brand-primary outline-none font-bold text-xs text-brand-secondary" placeholder="60" />
              </div>
              <div>
                <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Теги</label>
                <input type="text" value={tagsInput} onChange={(e)=>setTagsInput(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-brand-primary outline-none font-bold text-xs text-brand-secondary" placeholder="продукт, обучение, карта" />
                <p className="text-[10px] text-gray-400 mt-1">Через запятую для фильтрации в банке</p>
              </div>
            </div>
          </div>
          <div className="bg-brand-secondary rounded-2xl p-5 text-white shadow-lg border-b-4 border-brand-primary">
             <h3 className="font-black text-sm mb-2">Belinda AI</h3>
             <p className="text-gray-400 text-[10px] mb-4 leading-relaxed">
               {isEditing ? 'Добавьте вопросы через ИИ на основе текста по теме.' : 'Загрузите PDF или вставьте текст для генерации вопросов (RU + TJ).'}
             </p>
             {!isEditing && (
               <button onClick={() => setMode(mode === 'ai' ? 'manual' : 'ai')} className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl font-black text-[10px] uppercase border border-white/10 transition-all mb-2">
                 {mode === 'ai' ? 'Ручной ввод' : 'Использовать ИИ'}
               </button>
             )}
             {isEditing && (
               <button onClick={() => setShowAddViaAI(!showAddViaAI)} className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl font-black text-[10px] uppercase border border-white/10 transition-all flex items-center justify-center gap-2">
                 <Sparkles size={14} />
                 {showAddViaAI ? 'Скрыть' : 'Добавить через ИИ'}
               </button>
             )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {mode === 'ai' && !isEditing ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm space-y-8 animate-fade-in">
              <div className="text-center space-y-2">
                <Upload size={24} className="mx-auto text-brand-primary" />
                <h2 className="text-lg font-black text-brand-secondary">Генерация AI</h2>
                <p className="text-[10px] text-gray-400">Вопросы и ответы создаются на русском и таджикском</p>
              </div>
              <div className="space-y-2">
                <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Уровень сложности</label>
                <select value={aiDifficulty} onChange={(e) => setAiDifficulty(e.target.value as DifficultyLevel)} className="w-full bg-gray-50 rounded-xl p-3 font-black text-xs outline-none focus:ring-1 focus:ring-brand-primary">
                  <option value="easy">Лёгкий</option>
                  <option value="medium">Средний</option>
                  <option value="hard">Сложный</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[{ l: 'Тестов', v: testCount, s: setTestCount }, { l: 'Открытых', v: openCount, s: setOpenCount }].map(x => (
                  <div key={x.l} className="space-y-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">{x.l}</label>
                    <input type="number" value={x.v} onChange={(e) => x.s(Number(e.target.value))} className="w-full bg-gray-50 rounded-xl p-3 font-black text-xs outline-none focus:ring-1 focus:ring-red-50" min={1} />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Текст по теме (основа для генерации)</label>
                <textarea value={aiTextInput} onChange={(e) => setAiTextInput(e.target.value)} placeholder="Вставьте текст, инструкцию или материал по теме. ИИ создаст вопросы на основе этого текста." className="w-full bg-gray-50 rounded-xl p-4 font-bold text-xs outline-none focus:ring-1 focus:ring-brand-primary resize-none h-32" />
              </div>
              <div className="border-2 border-dashed border-gray-100 rounded-2xl p-6 transition-all hover:border-brand-primary bg-gray-50/50 text-center">
                <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} className="hidden" id="pdf-upload" />
                <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center gap-2">
                  <FileText className={pdfFile ? 'text-brand-primary' : 'text-gray-300'} size={32} />
                  <span className="font-bold text-[10px] text-gray-500">Или выберите PDF</span>
                </label>
              </div>
              <button onClick={handleGenerateAI} disabled={isGenerating || (!aiTextInput.trim() && !pdfFile)} className="w-full py-4 bg-brand-primary text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isGenerating ? 'Генерация...' : 'Сгенерировать'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {showAddViaAI && (
                <div className="bg-brand-secondary/10 border-2 border-brand-primary/30 rounded-2xl p-6 space-y-4 animate-fade-in">
                  <h3 className="font-black text-sm text-brand-secondary flex items-center gap-2">
                    <Sparkles size={16} className="text-brand-primary" /> Добавить вопросы через ИИ
                  </h3>
                  <p className="text-[10px] text-gray-500">Вставьте текст или загрузите PDF. Вопросы и ответы будут созданы на русском и таджикском.</p>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Уровень сложности</label>
                    <select value={aiDifficulty} onChange={(e) => setAiDifficulty(e.target.value as DifficultyLevel)} className="w-full bg-white rounded-xl p-3 font-black text-xs outline-none focus:ring-1 focus:ring-brand-primary border border-gray-100">
                      <option value="easy">Лёгкий</option>
                      <option value="medium">Средний</option>
                      <option value="hard">Сложный</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[{ l: 'Тестов', v: testCount, s: setTestCount }, { l: 'Открытых', v: openCount, s: setOpenCount }].map(x => (
                      <div key={x.l} className="space-y-1">
                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">{x.l}</label>
                        <input type="number" value={x.v} onChange={(e) => x.s(Number(e.target.value))} className="w-full bg-white rounded-xl p-2.5 font-black text-xs outline-none border border-gray-100" min={1} />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Текст по теме</label>
                    <textarea value={aiTextInput} onChange={(e) => setAiTextInput(e.target.value)} placeholder="Вставьте текст (инструкция, материал, описание продукта)..." className="w-full bg-white rounded-xl p-4 font-bold text-xs outline-none border border-gray-100 resize-none h-24" />
                  </div>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 transition-all hover:border-brand-primary/50 bg-white/50 text-center">
                    <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} className="hidden" id="pdf-upload-edit" />
                    <label htmlFor="pdf-upload-edit" className="cursor-pointer flex flex-col items-center gap-2">
                      <FileText className={pdfFile ? 'text-brand-primary' : 'text-gray-300'} size={28} />
                      <span className="font-bold text-[10px] text-gray-500">{pdfFile ? pdfFile.name : 'Или выберите PDF'}</span>
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setShowAddViaAI(false); setAiTextInput(''); setPdfFile(null); }} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-black text-[10px] uppercase">Отмена</button>
                    <button onClick={handleGenerateAI} disabled={isGenerating || (!aiTextInput.trim() && !pdfFile)} className="flex-1 py-2.5 bg-brand-primary text-white rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 disabled:opacity-50">
                      {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {isGenerating ? 'Генерация...' : 'Сгенерировать'}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                 <h2 className="font-black text-sm text-brand-secondary uppercase tracking-widest">Вопросы ({questions.length})</h2>
                 <div className="flex gap-2">
                   {isEditing && (
                     <button onClick={() => setShowAddViaAI(!showAddViaAI)} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-1.5 ${showAddViaAI ? 'bg-gray-100 text-gray-600' : 'bg-brand-secondary/20 text-brand-primary border border-brand-primary/30'}`}>
                       <Sparkles size={14} /> ИИ
                     </button>
                   )}
                   <button onClick={() => setQuestions([{ id: Date.now().toString(), text: '', type: QuestionType.SINGLE_CHOICE, options: ['', '', '', ''], correctAnswers: [0], difficulty: 'medium' }, ...questions])} className="bg-brand-primary text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-1.5 shadow-md shadow-red-100">
                    <Plus size={14} /> Добавить
                  </button>
                 </div>
              </div>
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm relative group border-l-8 border-l-brand-primary">
                  <button onClick={() => setQuestions(questions.filter(qi => qi.id !== q.id))} className="absolute top-4 right-4 text-gray-300 hover:text-brand-primary p-1.5 transition-all">
                    <Trash size={14} />
                  </button>
                  <div className="flex flex-wrap items-center gap-3 mb-5">
                    <span className="w-8 h-8 bg-brand-secondary text-white rounded-lg flex items-center justify-center font-black text-xs shrink-0">{idx + 1}</span>
                    <select value={q.difficulty || 'medium'} onChange={(e) => setQuestions(questions.map(qi => qi.id === q.id ? { ...qi, difficulty: e.target.value as QuestionDifficulty } : qi))} className={`rounded-xl px-3 py-2 font-black text-[10px] outline-none border shrink-0 ${(q.difficulty || 'medium') === 'easy' ? 'bg-green-50 border-green-200 text-green-700' : (q.difficulty || 'medium') === 'hard' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                      <option value="easy">Легкий</option>
                      <option value="medium">Средний</option>
                      <option value="hard">Сложный</option>
                    </select>
                    <select value={q.type} onChange={(e) => setQuestions(questions.map(qi => qi.id === q.id ? { ...qi, type: e.target.value as QuestionType } : qi))} className="bg-gray-50 border-none rounded-xl px-4 py-2 font-black text-xs outline-none">
                      <option value={QuestionType.SINGLE_CHOICE}>Тест (1 ответ)</option>
                      <option value={QuestionType.MULTIPLE_CHOICE}>Тест (несколько)</option>
                      <option value={QuestionType.OPEN_ENDED}>Развернутый ответ</option>
                      <option value={QuestionType.RANGE}>Промежуток (От-До)</option>
                    </select>
                  </div>
                  <div className="space-y-1 mb-5">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 block">Текст вопроса</label>
                    <textarea value={q.text} onChange={(e) => setQuestions(questions.map(qi => qi.id === q.id ? { ...qi, text: e.target.value } : qi))} className="w-full text-sm font-bold border-none bg-gray-50 rounded-xl p-4 focus:ring-1 focus:ring-red-50 outline-none text-brand-secondary resize-none" placeholder="Введите вопрос..." rows={2} />
                  </div>
                  {q.type !== QuestionType.OPEN_ENDED && q.type !== QuestionType.RANGE && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(q.options || []).map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <button onClick={() => {
                            const newCorrect = q.type === QuestionType.SINGLE_CHOICE ? [oIdx] : (q.correctAnswers.includes(oIdx) ? q.correctAnswers.filter(i => i !== oIdx) : [...q.correctAnswers, oIdx]);
                            setQuestions(questions.map(qi => qi.id === q.id ? { ...qi, correctAnswers: newCorrect } : qi));
                          }} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${q.correctAnswers.includes(oIdx) ? 'bg-brand-primary border-brand-primary text-white' : 'bg-white border-gray-100'}`}>
                            <CheckCircle2 size={12} />
                          </button>
                          <input type="text" value={opt} onChange={(e) => {
                            const newOpts = [...q.options];
                            newOpts[oIdx] = e.target.value;
                            setQuestions(questions.map(qi => qi.id === q.id ? { ...qi, options: newOpts } : qi));
                          }} className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-[11px] font-bold focus:bg-white outline-none border-none" placeholder={`Вариант ${oIdx + 1}`} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="fixed bottom-6 right-6 flex gap-3 z-40">
        <button onClick={handleSaveQuiz} className="bg-brand-secondary text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-brand-primary transition-all shadow-xl flex items-center gap-2 border-b-4 border-black">
          <Save size={18} />
          {isEditing ? 'Обновить' : 'Опубликовать'}
        </button>
      </div>
    </div>
  );
};
