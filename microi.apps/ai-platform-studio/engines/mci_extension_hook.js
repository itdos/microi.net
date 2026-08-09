/*
 * Microi吾码租户扩展 Hook。
 * 由应用包以 CreateIfMissing 发布，首次安装后归租户维护，官方升级永不覆盖。
 */
return {
  Code: 1,
  Data: {
    Accepted: true,
    HookKey: V8.Param && V8.Param.HookKey ? String(V8.Param.HookKey) : '',
    Records: [],
    Gates: [],
    Notifications: []
  },
  Msg: '未配置租户扩展，已按平台默认策略继续。'
};
