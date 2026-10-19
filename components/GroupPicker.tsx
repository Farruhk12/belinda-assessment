import React, { useMemo, useState } from 'react';
import { X, Plus, Briefcase } from 'lucide-react';

interface GroupPickerProps {
  value: string[];
  options: string[];
  onChange: (groups: string[]) => void;
  placeholder?: string;
  /** можно ли вводить группу, которой ещё нет в списке */
  allowCustom?: boolean;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Выбор нескольких групп: выбранные показываются метками, остальные предлагаются списком
export const GroupPicker: React.FC<GroupPickerProps> = ({ value, options, onChange, placeholder = 'Введите название группы', allowCustom = false }) => {
  const [query, setQuery] = useState('');

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter(o => !value.some(v => same(v, o)) && (!q || o.toLowerCase().includes(q)));
  }, [options, value, query]);

  const add = (raw: string) => {
    const name = raw.trim();
    if (!name || value.some(v => same(v, name))) { setQuery(''); return; }
    const known = options.find(o => same(o, name));
    if (!known && !allowCustom) return;
    onChange([...value, known ?? name]);
    setQuery('');
  };

  const remove = (g: string) => onChange(value.filter(v => v !== g));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {value.length === 0 && <span className="text-[10px] font-bold text-gray-400 italic py-1">Группы не выбраны</span>}
        {value.map((g, i) => (
          <span key={g} className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-[10px] font-black ${i % 2 === 0 ? 'bg-brand-primary text-white' : 'bg-sky-100 text-sky-700'}`}>
            {g}
            <button type="button" onClick={() => remove(g)} aria-label={`Убрать группу ${g}`} className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/10">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(query || suggestions[0] || ''); } }}
          className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-12 py-3 focus:ring-1 focus:ring-brand-primary outline-none font-bold text-xs"
          placeholder={placeholder}
        />
        <button type="button" onClick={() => add(query || suggestions[0] || '')} aria-label="Добавить группу" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-brand-primary text-white flex items-center justify-center hover:bg-brand-secondary transition-colors">
          <Plus size={14} />
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
          {suggestions.slice(0, 40).map(o => (
            <button key={o} type="button" onClick={() => add(o)} className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold hover:bg-brand-primary hover:text-white transition-colors">
              + {o}
            </button>
          ))}
        </div>
      )}
      {value.length > 1 && <p className="text-[9px] font-bold text-gray-400">Тесты придут по всем выбранным группам.</p>}
    </div>
  );
};
