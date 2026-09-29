// 只接受可连续映射到当前可见列的分组；错误配置回退单层表头，避免数据列错位。
export function buildTableHeaderPlan(rawHeaders, fields) {
    if (!rawHeaders) return [];
    let definitions;
    try {
        definitions = typeof rawHeaders === "string" ? JSON.parse(rawHeaders) : rawHeaders;
    } catch {
        return [];
    }
    if (!Array.isArray(definitions) || definitions.length > 32) return [];
    const visible = (fields || []).map((field) => [field?.Name, field?.AsName]
        .filter(Boolean).map((name) => String(name).toLowerCase()));
    const occupied = new Set();

    function parseGroup(group, depth = 0) {
        if (!group || typeof group !== "object" || depth > 3) return null;
        const label = String(group.Label || group.label || "").trim();
        if (!label || label.length > 80) return null;
        const refs = group.Fields || group.fields;
        const nested = group.Children || group.children;
        let children = [];
        if (Array.isArray(refs) && refs.length > 0) {
            children = refs.map((ref) => {
                const key = String(ref?.Name || ref?.Field || ref || "").toLowerCase();
                const index = visible.findIndex((names) => names.includes(key));
                if (index < 0 || occupied.has(index)) return null;
                occupied.add(index);
                return { index };
            });
        } else if (Array.isArray(nested) && nested.length > 0) {
            children = nested.map((child) => parseGroup(child, depth + 1));
        }
        if (!children.length || children.some((child) => !child)) return null;
        const indexes = children.flatMap((child) => child.index !== undefined ? [child.index] : child.indexes);
        const sorted = [...indexes].sort((a, b) => a - b);
        if (indexes.some((index, offset) => index !== sorted[offset])
            || sorted.some((index, offset) => index !== sorted[0] + offset)) return null;
        return { label, children, indexes: sorted, start: sorted[0], end: sorted.at(-1) };
    }

    const groups = definitions.map((definition) => parseGroup(definition));
    if (groups.some((group) => !group)) return [];
    groups.sort((a, b) => a.start - b.start);
    return groups;
}
