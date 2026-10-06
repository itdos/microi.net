// 源码路由、在线 v3 发布和离线包共用同一元数据归一化，防止匿名标记在制包时丢失。
export function buildPlatformServiceRouteSnapshots(definitions, existingRoutes = []) {
  const existing = new Map(existingRoutes.map(route => [route.RoutePath, route]));
  const object = value => {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = {}; } }
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  };
  return definitions.map(definition => {
    const routePath = String(definition.path || '').trim();
    if (!routePath.startsWith('/') || /[?#\\]/.test(routePath)) throw new Error(`无效微服务路由：${routePath}`);
    const prior = existing.get(routePath) || {};
    const meta = { ...object(prior.RouteMetaJson), ...object(definition.RouteMetaJson) };
    delete meta._MicroiV3;
    if (definition.SourceFile) meta.SourceFile = definition.SourceFile;
    return {
      PageKey: String(definition.name || routePath.slice(1)),
      PageName: String(prior.PageName || definition.name || routePath.slice(1)),
      PageTitle: String(definition.title || definition.name || routePath),
      RoutePath: routePath, EntryPath: 'index.html',
      Sort: Number(definition.sort || 0),
      IsHome: definition.isHome === true || Number(definition.isHome) === 1 ? 1 : 0,
      IsEnable: 1, RouteMetaJson: JSON.stringify(meta), SourceDirName: 'microi-platform-service'
    };
  });
}
