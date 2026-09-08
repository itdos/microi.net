// 点位、小程序预览和后端事件共用计算口径；后端发布脚本只移除 export，不另写一套公式。
export var PROPOSAL_AFTER_COST_FIELDS = [
  'HezuoHYDCB', 'HezuoHYSCB', 'HezuoHFWCB', 'HezuoHYSZCB',
  'HezuoHYSSBSL', 'HezuoHYSZCBAll', 'ShisuanNS', 'DuonianLJCBAfter',
  'ShebeiMDCBDT', 'HezuoHYDCBMD', 'HezuoHYSCBMD', 'HezuoHFWCBMD',
  'HezuoHYSZCBMD', 'HezuoHYSSBSLMD', 'HezuoHYSZCBAllMD', 'ShisuanNSMD', 'DuonianLJCBMD'
];

// 空值与零元报价分开，未维护价格不能作为免费设备参加比价。
export function costPresent(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

// 兼容历史 varchar 金额，非法数字由提交校验拒绝，预览阶段不显示 NaN。
export function costNumber(value) {
  var result = Number(value);
  return isFinite(result) ? result : 0;
}

// 所有金额以分对齐，点位汇总直接累加各点位结果。
export function costRound(value) {
  return Math.round((costNumber(value) + 1e-9) * 100) / 100;
}

// HesuanNS 是方案唯一试算周期；后两个字段只兼容旧记录。
export function proposalCostYears(plan) {
  plan = plan || {};
  var value = costPresent(plan.HesuanNS) ? plan.HesuanNS
    : costPresent(plan.ShisuanNS) ? plan.ShisuanNS
    : costPresent(plan.ShisuanNSMD) ? plan.ShisuanNSMD : 5;
  return costNumber(value) > 0 ? costNumber(value) : 5;
}

// 保留合作前原公式和主表输入，不使用新点位的设备数量或人数替换现状。
export function calculateCurrentProposalCosts(form) {
  form = form || {};
  var people = costNumber(form.Renshu);
  var waterDeviceCount = costPresent(form.DangqianYSSBSL) ? costNumber(form.DangqianYSSBSL) : 1;
  var method = String(form.DangqianYSFS || '');
  var boiler = method.indexOf('开水机') >= 0;
  var direct = method.indexOf('直饮机') >= 0;
  var kettle = method.indexOf('电水壶') >= 0;
  var bottled = method.indexOf('桶装水') >= 0;
  var water = 0, power = 0, service = 0;
  if (boiler || direct || kettle) {
    water = people * 2.4;
    power = people * (boiler || kettle ? 90 : 30);
    // 现状单台服务费为 500；数量只使用当前饮水设备数量，不读取旧设备方案字段。
    service = boiler ? 500 : 0;
  } else if (bottled) {
    water = costNumber(form.TongzhuangSDJ) * 20 * people;
    power = people * 30;
  }
  var single = costRound(water + power + service);
  var all = costRound(single * waterDeviceCount);
  return {
    DangqianYSCB: costRound(water), DangqianYDCB: costRound(power),
    DangqianFWCB: costRound(service * waterDeviceCount), DangqianYSZCB: single,
    DangqianYSZCBAll: all, DuonianLJCB: costRound(all * proposalCostYears(form))
  };
}

// 点位水电费分摊到单台，服务费展示点位合计；计算单台成本时使用原单台服务单价。
export function calculateInstallationPointCosts(point, years) {
  point = point || {};
  years = proposalCostYears({ HesuanNS: years });
  var qty = costPresent(point.ShebeiSL) ? costNumber(point.ShebeiSL) : 1;
  var people = costNumber(point.Renshu);
  var power = costRound(qty > 0 ? people * 30 / qty : 0);
  var water = costRound(qty > 0 ? people * 2.4 / qty : 0);
  var rent = costPresent(point.ShebeiDJZL) ? costRound(costNumber(point.ShebeiDJZL)) : null;
  var buy = costPresent(point.ShebeiDJ) ? costRound(costNumber(point.ShebeiDJ)) : null;
  var filter = costRound(costNumber(point.GenghuanLXJG));
  var rentSingle = rent === null ? null : costRound(power + water + rent);
  var buySingle = costRound(power + water + filter);
  var rentAnnual = rentSingle === null ? null : costRound(rentSingle * qty);
  var buyAnnual = costRound(buySingle * qty);
  return {
    HezuoHYDCB: power, HezuoHYSCB: water, HezuoHFWCB: rent === null ? null : costRound(rent * qty),
    HezuoHYSZCB: rentSingle,
    HezuoHYSSBSL: qty, HezuoHYSZCBAll: rentAnnual, ShisuanNS: years,
    DuonianLJCBAfter: rentAnnual === null ? null : costRound(rentAnnual * years),
    ShebeiMDCBDT: buy, HezuoHYDCBMD: power, HezuoHYSCBMD: water,
    HezuoHFWCBMD: costRound(filter * qty),
    HezuoHYSZCBMD: buySingle,
    HezuoHYSSBSLMD: qty, HezuoHYSZCBAllMD: buyAnnual, ShisuanNSMD: years,
    // 购置款不混入年饮水成本，多年成本中另加一次。
    DuonianLJCBMD: buy === null ? null : costRound(buy * qty + buyAnnual * years)
  };
}

// 逐字段累加点位结果：空值不抵消其他点位的金额；整列都空时才保留待完善状态。
export function aggregateInstallationPointCosts(points, years) {
  points = points || [];
  years = proposalCostYears({ HesuanNS: years });
  var result = {}, available = {}, i, key;
  for (i = 0; i < PROPOSAL_AFTER_COST_FIELDS.length; i++) result[PROPOSAL_AFTER_COST_FIELDS[i]] = 0;
  result.ChangsuoDWSL = 0;
  for (i = 0; i < points.length; i++) {
    var point = points[i];
    if (costNumber(point.IsDeleted) === 1) continue;
    result.ChangsuoDWSL++;
    var values = calculateInstallationPointCosts(point, years);
    for (var j = 0; j < PROPOSAL_AFTER_COST_FIELDS.length; j++) {
      key = PROPOSAL_AFTER_COST_FIELDS[j];
      if (key === 'ShisuanNS' || key === 'ShisuanNSMD' || key === 'HezuoHYSZCB' || key === 'HezuoHYSZCBMD') continue;
      var value = values[key];
      // 服务费已是点位总额，直接相加；仅单台购置款与水电费在此乘数量。
      if (['ShebeiMDCBDT', 'HezuoHYDCB', 'HezuoHYSCB', 'HezuoHYDCBMD', 'HezuoHYSCBMD'].indexOf(key) >= 0 && value !== null) {
        value = costRound(value * values.HezuoHYSSBSL);
      }
      if (costPresent(value)) {
        result[key] = costRound(result[key] + value);
        available[key] = true;
      }
    }
  }
  if (result.ChangsuoDWSL > 0) {
    for (i = 0; i < PROPOSAL_AFTER_COST_FIELDS.length; i++) {
      key = PROPOSAL_AFTER_COST_FIELDS[i];
      if (!available[key]) result[key] = null;
    }
  }
  result.ShisuanNS = years;
  result.ShisuanNSMD = years;
  // 主表历史单台字段保留兼容，但含义改为全部点位合计，不再计算虚构的平均型号。
  result.HezuoHYSZCB = result.HezuoHYSZCBAll;
  result.HezuoHYSZCBMD = result.HezuoHYSZCBAllMD;
  return result;
}

// 服务端与表单保存前共用输入检查；拒绝负数、非数字、非整数数量与无效周期。
export function validateProposalCostInputs(form, isPoint) {
  form = form || {};
  var fields = isPoint ? ['Renshu', 'ShebeiSL', 'ShebeiDJZL', 'ShebeiDJ', 'GenghuanLXJG']
    : ['Renshu', 'DangqianYSSBSL', 'TongzhuangSDJ', 'HesuanNS'];
  for (var i = 0; i < fields.length; i++) {
    var name = fields[i], value = form[name];
    if (!costPresent(value)) continue;
    var number = Number(value);
    if (!isFinite(number) || number < 0) return '人数、数量、价格和试算年数必须是有效的非负数字';
    if ((name === 'ShebeiSL' || name === 'HesuanNS') && (number < 1 || Math.floor(number) !== number)) {
      return '设备数量和试算年数必须是正整数';
    }
  }
  return '';
}
