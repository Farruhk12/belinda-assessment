import { norm, asList, employeeGroups, hasGroup } from './groups.js';

// Применимо ли назначение к сотруднику (без учёта пройденности и дат)
export const assignmentApplies = (a: any, user: any): boolean => {
  const area = norm(user.area);
  const tArea = norm(a.targetArea);
  switch (a.targetType) {
    case 'ALL': return true;
    case 'INDIVIDUAL': return String(a.targetEmployeeId) === String(user.id);
    case 'AREA': return area !== '' && tArea === area;
    case 'GROUP': return hasGroup(user, a.targetGroup);
    case 'AREA_GROUP': return tArea === area && hasGroup(user, a.targetGroup);
    default: return false;
  }
};

// Подчинённые менеджера: сотрудник попадает в команду, если хотя бы одна его группа подходит
export const teamOf = (manager: any, employees: any[]): any[] => {
  const managed = asList(manager.managedAreas);
  const areas = (managed.length ? managed : manager.managedArea ? [manager.managedArea] : []).map(norm);
  const managedGroups = asList(manager.managedGroups).map(norm);
  const allowedGroups = managedGroups.length > 0 ? managedGroups : employeeGroups(manager).map(norm);
  return employees.filter(e => {
    if (String(e.id) === String(manager.id)) return false;
    const okArea = areas.length === 0 || areas.includes(norm(e.area));
    const okGroup = employeeGroups(e).some(g => allowedGroups.includes(norm(g)));
    return okArea && okGroup;
  });
};
