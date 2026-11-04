export interface ModuleOrderInfo {
  id: string;
  order: number;
  isMandatory: boolean;
}

/**
 * Pure: which modules are locked. Mandatory modules are sequential by `order`
 * (a module is locked until the previous mandatory module is complete). Optional
 * (track) modules unlock once every mandatory module is complete.
 */
export function computeLockedModules(modules: ModuleOrderInfo[], completed: ReadonlySet<string>): Set<string> {
  const locked = new Set<string>();
  const mandatory = modules.filter((m) => m.isMandatory).sort((a, b) => a.order - b.order);
  mandatory.forEach((m, i) => {
    if (i > 0 && !completed.has(mandatory[i - 1].id)) locked.add(m.id);
  });
  const allMandatoryDone = mandatory.every((m) => completed.has(m.id));
  for (const m of modules) if (!m.isMandatory && !allMandatoryDone) locked.add(m.id);
  return locked;
}

export function allMandatoryComplete(modules: ModuleOrderInfo[], completed: ReadonlySet<string>): boolean {
  return modules.filter((m) => m.isMandatory).every((m) => completed.has(m.id));
}
