// 只比较已授权方案的经济性；人工确认设备适配不替代接口权限或设备性能验收。
export function proposalComparisonText(value) {
  if (value === null || value === undefined) return '';
  var text = String(value).trim();
  if (text.charAt(0) === '[') {
    try { return JSON.stringify(JSON.parse(text).map(String).sort()); } catch (error) { /* 历史普通文本按原值比较。 */ }
  }
  return text.replace(/\s+/g, ' ');
}

// 空报价与零元报价严格分开，拒绝布尔值、数组及不能用分精确表达的超大金额。
export function proposalComparisonNumber(value, positiveInteger) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return false;
  var number = Number(value);
  return isFinite(number) && number >= 0 && number * 100 <= 9007199254740991 &&
    (!positiveInteger || (number >= 1 && Math.floor(number) === number));
}

// 需求特征不包含设备型号、数量及价格，允许通过不同设备组合满足同一份已填需求。
export function proposalRequirementSignature(locations) {
  return JSON.stringify((locations || []).map(function(point) {
    return JSON.stringify(['AnzhuangCS', 'Renshu', 'ShuizhiYQ', 'DashuiFS', 'JiareFS', 'ShuiwenYQ', 'GaofengSDKSL'].map(function(key) {
      if ((key === 'Renshu' || key === 'GaofengSDKSL') && proposalComparisonNumber(point[key])) return String(Number(point[key]));
      return proposalComparisonText(point[key]);
    }));
  }).sort());
}

// 按分排名，保留全部并列项；差额只与下一档有效报价比较，不将缺价当成零元。
export function rankProposalCostOptions(options) {
  options.sort(function(a, b) { return Math.round(a.Cost * 100) - Math.round(b.Cost * 100) || a.Id.localeCompare(b.Id) || a.Mode.localeCompare(b.Mode); });
  var last = null, rank = 0;
  for (var i = 0; i < options.length; i++) {
    var cents = Math.round(options[i].Cost * 100);
    if (cents !== last) rank = i + 1;
    options[i].Rank = rank;
    last = cents;
  }
  var winners = options.filter(function(item) { return item.Rank === 1; });
  var next = options.filter(function(item) { return item.Rank > 1; })[0];
  var gap = next ? Math.round((next.Cost - winners[0].Cost) * 100) / 100 : null;
  return { Options: options, Winners: winners, GapToNext: gap,
    SavingPercent: next && next.Cost > 0 ? Math.round(gap / next.Cost * 10000) / 100 : null };
}

// 完整性与同一需求由服务端回读数据决定；客户端只提供本次人工确认，不持久化业务数据。
export function buildProposalCostRecommendation(rows, options) {
  options = options || {};
  var reference = rows.filter(function(row) { return row.Id === options.ReferenceId; })[0] || rows[0];
  var signature = reference ? proposalRequirementSignature(reference.Locations) : '';
  var rental = [], buyout = [], confirmed = options.RequirementsConfirmed === true;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i], locations = row.Locations || [], scope = [], rentalIssues = [], buyoutIssues = [];
    if (!row.CustomerId || !reference.CustomerId) scope.push('未关联客户，无法核对是否属于同一需求');
    else if (row.CustomerId !== reference.CustomerId) scope.push('与需求基准不属于同一客户');
    if (!locations.length) scope.push('未配置安装点位');
    if (proposalRequirementSignature(locations) !== signature) scope.push('点位、人数或已填用水要求与需求基准不一致');
    for (var j = 0; j < locations.length; j++) {
      var point = locations[j], label = '点位' + (j + 1) + '（' + (point.AnzhuangCS || '未填写场所') + '）';
      if (!proposalComparisonText(point.AnzhuangCS)) scope.push(label + '缺少安装场所');
      if (!proposalComparisonNumber(point.Renshu, true)) scope.push(label + '用水人数须为正整数');
      if (!proposalComparisonNumber(point.ShebeiSL, true)) scope.push(label + '设备数量须为正整数');
      if (point.GaofengSDKSL !== null && point.GaofengSDKSL !== undefined && String(point.GaofengSDKSL).trim() !== '' && !proposalComparisonNumber(point.GaofengSDKSL)) scope.push(label + '高峰开水量须为有效非负数');
      if (!proposalComparisonText(point.ShebeiMC) && !proposalComparisonText(point.ShebeiXH)) scope.push(label + '未选择设备');
      if (!proposalComparisonNumber(point.ShebeiDJZL)) rentalIssues.push(label + '缺少有效租赁报价');
      if (!proposalComparisonNumber(point.ShebeiDJ)) buyoutIssues.push(label + '缺少有效买断报价');
      if (!proposalComparisonNumber(point.GenghuanLXJG)) buyoutIssues.push(label + '缺少年滤芯费用（免费也需填写0）');
    }
    if (!proposalComparisonNumber(row.RentalMultiYearCost)) rentalIssues.push('租赁累计成本无效');
    if (!proposalComparisonNumber(row.BuyoutMultiYearCost)) buyoutIssues.push('买断累计成本无效');
    if (Number(row.Years) !== Number(options.Years)) scope.push('试算年数未统一');
    row.CostReview = { ScopeReasons: scope, RentalIssues: rentalIssues, BuyoutIssues: buyoutIssues,
      RentalEligible: confirmed && !scope.length && !rentalIssues.length,
      BuyoutEligible: confirmed && !scope.length && !buyoutIssues.length, RentalRank: null, BuyoutRank: null };
    if (row.CostReview.RentalEligible) rental.push({ Id: row.Id, Name: row.FanganMC, Mode: 'Rental', ModeName: '租赁', Cost: row.RentalMultiYearCost });
    if (row.CostReview.BuyoutEligible) buyout.push({ Id: row.Id, Name: row.FanganMC, Mode: 'Buyout', ModeName: '买断', Cost: row.BuyoutMultiYearCost, UpfrontCost: row.BuyoutPriceTotal });
  }
  var rentRank = rankProposalCostOptions(rental), buyRank = rankProposalCostOptions(buyout);
  for (var r = 0; r < rows.length; r++) {
    var rentOption = rental.filter(function(item) { return item.Id === rows[r].Id; })[0];
    var buyOption = buyout.filter(function(item) { return item.Id === rows[r].Id; })[0];
    rows[r].CostReview.RentalRank = rentOption ? rentOption.Rank : null;
    rows[r].CostReview.BuyoutRank = buyOption ? buyOption.Rank : null;
  }
  // 综合排序复制选项，避免改写租赁/买断各自的排名。
  var combined = rental.concat(buyout).map(function(item) { var copy = {}; for (var key in item) copy[key] = item[key]; return copy; });
  var eligiblePlans = rows.filter(function(row) { return row.CostReview.RentalEligible || row.CostReview.BuyoutEligible; }).length;
  return { Version: 1, Years: options.Years, ReferenceId: reference ? reference.Id : '', ReferenceName: reference ? reference.FanganMC : '',
    RequirementsConfirmed: confirmed, EligiblePlanCount: eligiblePlans, SelectedPlanCount: rows.length,
    Status: !confirmed ? 'confirmation-required' : !combined.length ? 'no-candidates' : combined.length < rows.length * 2 || eligiblePlans < 2 ? 'limited' : 'ready',
    Rental: rentRank, Buyout: buyRank, Best: rankProposalCostOptions(combined),
    Basis: '按已填需求一致且人工确认设备适配的前提，比较同一使用年数的累计成本；不评价设备品质或售后优劣。',
    Warning: '排名仅覆盖报价完整的可比选项。买断包含一次性设备款；未计入现有公式以外的融资、维修、残值及价格变化。' };
}
