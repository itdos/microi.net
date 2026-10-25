import { isDeepStrictEqual } from 'node:util';

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value: RecordValue, key: string) => Object.hasOwn(value, key);

/**
 * 先校验原始声明，再交给兼容层归一化。兼容层会过滤无效成员，不能作为写前校验器；
 * 否则 AI 生成的一项错误可能被当成“未声明”，前面的合法资源却已写入。
 * 这里只返回路径和固定原因，不回显可能含代码、密钥或业务数据的原始值。
 */
export function validateManifestDeclarations(manifest: RecordValue): string[] {
  const errors: string[] = [];
  const collection = (record: RecordValue, aliases: string[], prefix: string): RecordValue[] => {
    const present = aliases.filter(key => own(record, key));
    if (!present.length) return [];
    const label = prefix + aliases[0];
    if (present.some(key => !Array.isArray(record[key]))) {
      errors.push(`${label} 必须是对象数组；省略可选集合时请删除该属性`);
      return [];
    }
    if (present.length > 1 && !isDeepStrictEqual(record[present[0]], record[present[1]])) {
      errors.push(`${label} 与 ${prefix + present[1]} 的集合别名冲突，请只保留一份明确声明`);
    }
    const result: RecordValue[] = [];
    (record[present[0]] as unknown[]).forEach((item, index) => {
      if (!isRecord(item) || !Object.keys(item).length) errors.push(`${label}[${index}] 必须是非空资源对象`);
      // 保留原下标，不能因为过滤第一个坏项而把后续错误指向另一条资源。
      result.push(isRecord(item) ? item : {});
    });
    return result;
  };
  const unique = (items: RecordValue[], aliases: string[], prefix: string) => {
    const seen = new Map<string, number>();
    items.forEach((item, index) => {
      const values = aliases.filter(key => own(item, key)).map(key => item[key]);
      if (!values.length) return; // 必填及引用语义继续由原有领域预检负责。
      const label = `${prefix}[${index}].${aliases[0]}`;
      if (values.some(value => typeof value !== 'string')) { errors.push(`${label} 必须是字符串`); return; }
      const names = (values as string[]).map(value => value.trim().toLowerCase());
      if (names.some(name => name !== names[0])) errors.push(`${label} 的属性别名冲突`);
      const key = names[0];
      if (!key) return;
      const first = seen.get(key);
      if (first !== undefined) errors.push(`${label} 与 ${prefix}[${first}] 重复，不能依靠后写覆盖消除歧义`);
      else seen.set(key, index);
    });
  };
  const groups: Record<string, RecordValue[]> = {};
  for (const key of ['roles', 'tables', 'engines', 'modules', 'events', 'dataSources', 'pages', 'printTemplates', 'workflows', 'jobs', 'permissions']) {
    groups[key] = collection(manifest, [key, key[0].toUpperCase() + key.slice(1)], '');
  }
  // 这些 Key 在生成器和服务端按当前租户唯一定位；字段和索引则只在所属表内唯一。
  unique(groups.tables, ['name', 'Name'], 'tables');
  unique(groups.engines, ['apiEngineKey', 'ApiEngineKey'], 'engines');
  unique(groups.dataSources, ['dataSourceKey', 'DataSourceKey'], 'dataSources');
  groups.tables.forEach((table, tableIndex) => {
    const prefix = `tables[${tableIndex}].`;
    unique(collection(table, ['fields', 'Fields'], prefix), ['name', 'Name'], prefix + 'fields');
    unique(collection(table, ['indexes', 'Indexes'], prefix), ['name', 'Name'], prefix + 'indexes');
  });
  return errors;
}
