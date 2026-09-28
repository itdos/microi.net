// 文案与时间编排属于 Managed 接口引擎；期限及身份只能来自宿主可信上下文。
function createLicenseExpiryModel() {
  function normalize(input) {
    var result = {};
    ['Personal', 'Enterprise'].forEach(function(edition) {
      var value = input && input[edition] || {}, days = value.AdvanceDays == null ? 7 : Number(value.AdvanceDays);
      if (!isFinite(days) || Math.floor(days) !== days || days < 1 || days > 3650) throw new Error('提前提醒天数必须是 1 到 3650 的整数。');
      var content = String(value.Content || '').trim();
      if (content.length > 8000) throw new Error('授权提醒文案最多 8000 字。');
      result[edition] = { AdvanceDays: days, Content: content };
    });
    return result;
  }
  function project(policy, edition, expiration, now, parent) {
    var end = Date.parse(expiration || '');
    if (['Personal', 'Enterprise'].indexOf(edition) < 0 || !isFinite(end)) return null;
    var setting = normalize(policy)[edition];
    if (end - now > setting.AdvanceDays * 86400000) return null;
    var minutes = Math.max(0, Math.ceil((end - now) / 60000));
    var countdown = Math.floor(minutes / 1440) + '天' + Math.floor(minutes / 60) % 24 + '小时' + minutes % 60 + '分';
    var expiry = new Date(end).toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
    var label = edition === 'Enterprise' ? '企业版' : '个人版';
    var content = setting.Content || (parent ? '当前子租户{版本}授权到期时间为 {到期时间}。倒计时{倒计时}。请及时联系主租户管理员续期。'
      : '当前系统授权到期时间为 {到期时间}。倒计时{倒计时}。请及时联系授权账号持有人续期，并在授权管理中重新部署有效授权。');
    var hasCountdown = content.indexOf('{倒计时}') >= 0;
    content = content.replace(/\{版本\}/g, label).replace(/\{到期时间\}/g, expiry).replace(/\{倒计时\}/g, countdown);
    if (!hasCountdown) content += '\n倒计时' + countdown + '。';
    return { Content: content, DueAt: new Date(end - setting.AdvanceDays * 86400000).toISOString(),
      Title: (parent ? '子租户授权' : '系统授权') + (end <= now ? '已到期' : '即将到期'),
      TitleTone: 'danger', Icon: 'warning', Severity: 'error', Priority: parent ? 99 : 100,
      EndsAt: new Date(Math.max(now, end) + 86400000).toISOString(), DisplayMode: 'EveryLogin',
      LinkUrl: '/#/license', LinkText: '查看授权', Slot: 0 };
  }
  return { normalize: normalize, project: project };
}
