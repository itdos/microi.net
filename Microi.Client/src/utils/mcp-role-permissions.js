export const emptyMcpPolicy = () => ({ Enabled: false, Scope: 'Role', CanWrite: false, CanDelete: false });
export const isMcpAdministrator = user => Number(user?.Level || 0) >= 9999;
export function normalizeMcpPolicy(value) {
    if (!value || value.Enabled !== true) return emptyMcpPolicy();
    return { Enabled: true, Scope: value.Scope === 'Full' ? 'Full' : 'Role', CanWrite: value.CanWrite === true, CanDelete: value.CanDelete === true };
}
export function changedMcpRoles(rows, originals) {
    return rows.filter(row => JSON.stringify(normalizeMcpPolicy(row.Policy)) !== JSON.stringify(normalizeMcpPolicy(originals[row.Id])))
        .map(row => ({ Id: row.Id, Version: row.Version, Policy: normalizeMcpPolicy(row.Policy) }));
}
