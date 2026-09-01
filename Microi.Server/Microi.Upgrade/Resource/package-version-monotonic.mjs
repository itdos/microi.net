function numericVersionParts(value) {
  const match = String(value || '').trim().match(/^v?(\d+(?:\.\d+)*)/i);
  return match ? match[1].split('.').map((part) => Number(part)) : null;
}

export function comparePackageVersions(left, right) {
  const leftParts = numericVersionParts(left);
  const rightParts = numericVersionParts(right);
  if (!leftParts || !rightParts) return null;
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index++) {
    const delta = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  return 0;
}

export function selectMonotonicPackageVersion(currentVersion, migrationVersion) {
  const current = String(currentVersion || '').trim();
  const migration = String(migrationVersion || '').trim();
  if (!current) return migration;
  if (!migration) return current;
  const comparison = comparePackageVersions(current, migration);
  return comparison !== null && comparison >= 0 ? current : migration;
}
