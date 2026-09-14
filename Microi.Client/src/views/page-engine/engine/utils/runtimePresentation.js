// Derive presentation without modifying the saved JSON or business colours.
export function runtimeSurfaceStyle(style, dark, design = false) {
  if (!style || typeof style !== 'object' || design || !dark) return style;
  const result = { ...style };
  const lightNeutral = value => {
    const text = value.trim().toLowerCase();
    if (text === 'white') return true;
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
    const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*1(?:\.0*)?)?\s*\)$/.exec(text);
    const channels = hex ? (hex[1].length === 3 ? hex[1].split('').map(x => x+x).join('') : hex[1]).match(/../g).map(x => parseInt(x,16)) : rgb ? rgb.slice(1,4).map(Number) : [];
    return channels.length === 3 && Math.min(...channels) >= 235 && Math.max(...channels) <= 255 && Math.max(...channels) - Math.min(...channels) <= 12;
  };
  const ink = /^(?:black|#000(?:000)?|#(?:333|444|555|666)(?:333|444|555|666)?|#303133|#606266|#1f2937|#111827|#344054|#475467|#4b5563)$/i;
  for (const key of ['background', 'backgroundColor']) {
    if (typeof result[key] === 'string' && lightNeutral(result[key])) result[key] = 'var(--el-bg-color)';
  }
  if (typeof result.color === 'string' && ink.test(result.color.trim())) result.color = 'var(--el-text-color-primary)';
  return result;
}

export function runtimePanelHeight(option, design, mobile) {
  if (mobile || (!design && option?.heightMode !== 'fixed')) return 'auto';
  const height = Number(option?.height);
  return Number.isFinite(height) && height > 0 ? `${height}px` : 'auto';
}

export function pageChartTheme(option, dark, compact = true) {
  const text = dark ? '#d8e1ee' : '#344054';
  const muted = dark ? '#aab8cc' : '#667085';
  const line = dark ? '#334258' : '#e8ecf2';
  const map = (value, fn) => Array.isArray(value) ? value.map(fn) : value ? fn(value) : value;
  const result = { ...option, backgroundColor: 'transparent', textStyle: { ...option.textStyle, color: text } };
  result.title = map(option.title, title => ({ ...title, textStyle: { ...title.textStyle, color: text, fontSize: 16, fontWeight: 600 }, subtextStyle: { ...title.subtextStyle, color: muted } }));
  result.legend = map(option.legend, legend => ({ ...legend, textStyle: { ...legend.textStyle, color: muted } }));
  result.tooltip = { ...option.tooltip, backgroundColor: dark ? '#1c293c' : '#fff', borderColor: line, textStyle: { ...option.tooltip?.textStyle, color: text } };
  for (const key of ['xAxis', 'yAxis']) result[key] = map(option[key], axis => ({
    ...axis, axisLabel: { ...axis.axisLabel, color: muted }, nameTextStyle: { ...axis.nameTextStyle, color: muted },
    axisLine: { ...axis.axisLine, lineStyle: { ...axis.axisLine?.lineStyle, color: line } },
    splitLine: { ...axis.splitLine, lineStyle: { ...axis.splitLine?.lineStyle, color: line } },
  }));
  result.series = map(option.series, series => ({ ...series, label: { ...series.label, color: series.label?.color || text }, labelLine: { ...series.labelLine, lineStyle: { ...series.labelLine?.lineStyle, color: muted } } }));
  if (compact && option.xAxis) {
    const hasTitle = [].concat(option.title || []).some(x => x.text);
    const hasLegend = [].concat(option.legend || []).some(x => x.show !== false);
    result.grid = { left: 12, right: 20, top: hasTitle ? 44 : 20, bottom: hasLegend ? 42 : 12, containLabel: true, ...option.grid };
  }
  return result;
}
