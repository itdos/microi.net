// Synthetic tasks only. No tenant data or executable model output.
export const protocolVersion = '1.1.0';
export const platformContext = `Microi 开发事实：FormEngine._Where 使用条件数组并参数化查询；用户和租户由可信宿主身份确定，不能采用请求体用户或租户。接口引擎返回 Code=1 自动提交，非1回滚，不手动提交。客户端校验不能代替服务端校验。普通业务复用表单/接口引擎，应用资源通过应用商城升级。`;
export const cases = [
  {
    id: 'query-plan',
    question: '只返回JSON，不输出代码块。为订单查询给出计划：状态等于已确认，金额大于1000，按创建时间降序，第1页20条。格式 {"table":"Diy_Order","where":[],"orderBy":"CreateTime","order":"DESC","pageIndex":1,"pageSize":20}。where每项是[字段,运算符,值]，字段为Status和Amount。',
    validate: x => ({ table: x.table === 'Diy_Order', predicates: Array.isArray(x.where) && x.where.length === 2 && [['Status','=','已确认'],['Amount','>',1000]].every(expected => x.where.some(actual => JSON.stringify(actual) === JSON.stringify(expected))), paging: x.pageIndex === 1 && x.pageSize === 20, order: x.orderBy === 'CreateTime' && x.order === 'DESC' })
  },
  {
    id: 'trust-boundary',
    question: '只返回JSON：{"identitySource":"...","tenantSource":"...","serverValidation":true或false,"clientValidationSufficient":true或false}。接口接收客户端UserId/OsClient和订单金额。描述安全方案，可信宿主用字符串trustedHost，客户端请求体用requestBody。',
    validate: x => ({ identity: x.identitySource === 'trustedHost', tenant: x.tenantSource === 'trustedHost', validation: x.serverValidation === true && x.clientValidationSufficient === false })
  },
  {
    id: 'transaction-plan',
    question: '只返回JSON：{"engine":"...","successCode":数字,"manualCommit":true或false,"failureRollsBack":true或false,"invalidInputWrites":true或false}。在吾码中批量新增库存记录，必须先校验所有记录的数量非负，任意一条无效时整批不写入。engine使用ApiEngine或CustomController，给出事务方案。',
    validate: x => ({ engine: x.engine === 'ApiEngine', commit: x.successCode === 1 && x.manualCommit === false, rollback: x.failureRollsBack === true, validation: x.invalidInputWrites === false })
  }
];
