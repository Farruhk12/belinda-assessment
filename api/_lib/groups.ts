// Чистые функции без серверных зависимостей: используются и на сервере, и в браузере

export const norm = (v: unknown) => String(v ?? '').toLowerCase().trim();

export const asList = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : []; } catch { return []; }
  }
  return [];
};

// Все группы сотрудника: список groups, а если его нет — поле group.
// Раньше несколько групп записывали в group через запятую («Альфа, Гамма»), поэтому такие значения тоже разбиваются.
export const employeeGroups = (e: { group?: unknown; groups?: unknown }): string[] => {
  const listed = asList(e.groups);
  const source = (listed.length > 0 ? listed : [String(e.group ?? '')]).flatMap(g => g.split(','));
  const seen = new Set<string>();
  return source.map(g => g.trim()).filter(g => g && !seen.has(norm(g)) && seen.add(norm(g)));
};

// Совпадение по любой отдельной группе, а также по исходной строке в поле group:
// так продолжают работать старые назначения на составную группу «Альфа, Гамма»
export const hasGroup = (e: { group?: unknown; groups?: unknown }, group: unknown): boolean => {
  const g = norm(group);
  return g !== '' && (employeeGroups(e).some(x => norm(x) === g) || norm(e.group) === g);
};

export const groupsLabel = (e: { group?: unknown; groups?: unknown }): string => employeeGroups(e).join(', ');
