/**
 * 生产主计划引入接口引擎
 * 
 * 功能：从【生产需求订单】批量引入数据到【APS生产总计划】
 * 
 * 业务逻辑：
 * 1. 检查Redis缓存，防止重复引入（并发控制）
 * 2. 全量更新【生产主计划】的未派工数（从【生产需求订单】同步）
 * 3. 查询符合条件的【生产需求订单】：
 *    - 未派工数 > 0
 *    - 物料编码分类 = '成品'（通过存货档案关联）
 *    - ERP是否关闭 = 0
 *    - 合并ID为空
 * 4. 根据生产订单号判断是否已存在：
 *    - 已存在且未派工数不同：更新
 *    - 不存在：插入
 * 5. 插入【任务栈列表】子表（从【APS工艺路线-任务栈列表】复制）
 * 6. 插入【用料清单】子表（从【生产需求订单-生产物料清单】复制）
 * 7. 使用Redis缓存记录处理进度
 * 
 * 接口配置：
 * - ApiEngineKey: import_production_plan
 * - ApiAddress: /apiengine/import-production-plan
 * - 允许匿名调用: 否
 * - 分布式锁: 是（防止并发操作）
 * 
 * 前端调用示例：
 * V8.ApiEngine.Run('import_production_plan', {})
 * 
 * 返回格式：
 * {
 *   Code: 1,
 *   Data: {
 *     insertCount: 10,     // 新增记录数
 *     updateCount: 5,      // 更新记录数
 *     skipCount: 3,        // 跳过记录数
 *     taskStackCount: 15,  // 任务栈记录数
 *     materialCount: 50    // 用料清单记录数
 *   },
 *   Msg: '引入成功'
 * }
 */

// ==================== 参数接收与校验 ====================

// 定义调试模式和进度缓存Key
var isDebug = true;
var debugLog = {};
var progressCacheKey = 'Microi:' + V8.OsClient + ':ImportProductionPlan:Progress:' + V8.CurrentUser.Id;
var lockCacheKey = 'Microi:' + V8.OsClient + ':ImportProductionPlan:Lock';

try {
    // ==================== 辅助函数：格式化日期时间为ISO格式 ====================
    var formatDateTime = function(date) {
        var year = date.getFullYear();
        var month = date.getMonth() + 1;
        var day = date.getDate();
        var hours = date.getHours();
        var minutes = date.getMinutes();
        var seconds = date.getSeconds();
        
        var monthStr = month < 10 ? '0' + month : '' + month;
        var dayStr = day < 10 ? '0' + day : '' + day;
        var hoursStr = hours < 10 ? '0' + hours : '' + hours;
        var minutesStr = minutes < 10 ? '0' + minutes : '' + minutes;
        var secondsStr = seconds < 10 ? '0' + seconds : '' + seconds;
        
        return year + '-' + monthStr + '-' + dayStr + ' ' + hoursStr + ':' + minutesStr + ':' + secondsStr;
    };

    // ==================== 步骤1：检查是否正在引入（并发控制） ====================
    var lockCache = V8.Cache.Get(lockCacheKey);
    if (lockCache) {
        return {
            Code: 0,
            Msg: '当前正在执行引入操作，请稍后再试！您可以通过进度查询接口查看当前进度。'
        };
    }

    // 设置锁标记（10分钟有效期，防止异常情况下锁一直存在）
    V8.Cache.Set(lockCacheKey, 'locked');//, '0.00:10:00'

    // 初始化进度
    V8.Cache.Set(progressCacheKey, JSON.stringify({
        status: 'processing',
        step: '开始引入',
        progress: 0,
        total: 100,
        startTime: formatDateTime(new Date())
    }));

    debugLog.startTime = formatDateTime(new Date());

    // ==================== 步骤2：全量更新【生产主计划】的未派工数 ====================
    V8.Cache.Set(progressCacheKey, JSON.stringify({
        status: 'processing',
        step: '全量更新未派工数',
        progress: 5,
        total: 100
    }));

    var updateWeipaiSql = 
        "UPDATE diy_scxqdd1766715873794 AS main " +
        "INNER JOIN diy_scxqdd AS req ON main.XuqiuDDH = req.XuqiuDDH " +
        "SET main.WeipaiCS = req.WeipaiCS " +
        "WHERE req.WeipaiCS IS NOT NULL";
    
    var updateCount = V8.DbTrans.FromSql(updateWeipaiSql).ExecuteNonQuery();
    
    debugLog.updateWeipaiCount = updateCount;

    // ==================== 步骤3：查询符合条件的【生产需求订单】 ====================
    V8.Cache.Set(progressCacheKey, JSON.stringify({
        status: 'processing',
        step: '查询符合条件的生产需求订单',
        progress: 10,
        total: 100
    }));

    // 查询条件：
    // 1. WeipaiCS > 0
    // 2. stock_type = '成品' (通过存货档案关联)
    // 3. ShifouGB = 0
    // 4. HebingID IS NULL or HebingID = ''
    var querySql = 
        "SELECT req.* " +
        "FROM diy_scxqdd AS req " +
        "LEFT JOIN diy_chda_new AS stock ON req.CunhuoBM = stock.CunhuoBM " +
        "WHERE req.WeipaiCS > 0 " +
        "AND stock.stock_type = '成品' " +
        "AND req.ShifouGB = 0 " +
        "AND (req.HebingID IS NULL OR req.HebingID = '')";
    
    var requirementOrders = V8.DbTrans.FromSql(querySql).ToArray();
    
    if (!requirementOrders || requirementOrders.length === 0) {
        // 清理锁
        V8.Cache.Remove(lockCacheKey);
        V8.Cache.Set(progressCacheKey, JSON.stringify({
            status: 'completed',
            step: '没有符合条件的数据',
            progress: 100,
            total: 100
        }));
        
        return {
            Code: 0,
            Data: {
                insertCount: 0,
                updateCount: 0,
                skipCount: 0
            },
            Msg: '没有符合条件的生产需求订单需要引入',
            DataAppend: {
                DebugLog: isDebug ? debugLog : null
            }
        };
    }

    debugLog.requirementOrderCount = requirementOrders.length;

    // ==================== 步骤4：查询已存在的【生产主计划】记录 ====================
    V8.Cache.Set(progressCacheKey, JSON.stringify({
        status: 'processing',
        step: '查询已存在的生产主计划',
        progress: 15,
        total: 100
    }));

    var existingPlans = V8.FormEngine.GetTableData('diy_scxqdd1766715873794', {
        _Where: [],
        _PageSize: 10000,
        _SelectFields: ['Id', 'XuqiuDDH', 'WeipaiCS']
    }, V8.DbTrans);

    if (existingPlans.Code != 1) {
        V8.Cache.Remove(lockCacheKey);
        return {
            Code: 0,
            Msg: '查询已存在的生产主计划失败：' + existingPlans.Msg,
            DataAppend: {
                DebugLog: isDebug ? debugLog : null
            }
        };
    }

    // 构建已存在记录的映射（Key: XuqiuDDH, Value: {Id, WeipaiCS}）
    var existingPlanMap = {};
    var existingPlanList = existingPlans.Data || [];
    for (var i = 0; i < existingPlanList.length; i++) {
        var plan = existingPlanList[i];
        existingPlanMap[plan.XuqiuDDH] = {
            Id: plan.Id,
            WeipaiCS: plan.WeipaiCS
        };
    }

    debugLog.existingPlanCount = existingPlanList.length;

    // ==================== 步骤5：批量插入/更新主表记录 ====================
    V8.Cache.Set(progressCacheKey, JSON.stringify({
        status: 'processing',
        step: '处理主表数据',
        progress: 20,
        total: 100
    }));

    var insertList = [];
    var updateList = [];
    var skipList = [];
    var newPlanIds = []; // 存储新插入记录的订单号，用于后续插入子表

    for (var i = 0; i < requirementOrders.length; i++) {
        var order = requirementOrders[i];
        var existingPlan = existingPlanMap[order.XuqiuDDH];

        if (existingPlan) {
            // 已存在，判断是否需要更新
            if (existingPlan.WeipaiCS != order.WeipaiCS) {
                updateList.push({
                    FormEngineKey: 'diy_scxqdd1766715873794',
                    Id: existingPlan.Id,
                    // 【生产需求订单】-> 【APS生产总计划】字段映射
                    WeipaiCS: order.WeipaiCS,                          // 未派工数 -> 未派工数
                    XuqiuDDH: order.XuqiuDDH,                          // 订单号 -> 生产订单号
                    ERPxqddh: order.ERPxqddh,                          // ERP订单号 -> ERP生产订单号
                    XuQiuDJ: order.XuQiuDJ,                            // 需求单据 -> 需求单据
                    ShengchanLX: order.ShengchanLX,                    // 生产类型 -> 生产类型
                    ShengchanBMID: order.ShengchanBMID,                // ShengchanBMID -> ShengchanBMID
                    PaichanZT: order.PaichanZT,                        // 排产状态 -> 排产状态
                    ShifouGB: order.ShifouGB,                          // ERP是否关闭 -> ERP是否关闭
                    ShiyongZZBM: order.ShiyongZZBM,                    // 使用组织编码 -> 使用组织编码
                    ShengchanYLQDFLNM: order.ShengchanYLQDFLNM,        // 生产用料清单分录内码 -> 生产用料清单分录内码
                    CunhuoBM: order.CunhuoBM,                          // 物料编码 -> 产成品编码
                    Cunhuo: order.Cunhuo,                              // 存货 -> 产成品
                    CunhuoID: order.CunhuoID,                          // CunhuoID -> CunhuoID
                    KehuMC: order.KehuMC,                              // 客户名称 -> 客户名称
                    XiaoshouDDID: order.XiaoshouDDID,                  // 销售订单Id -> 销售订单Id
                    Beizhu: order.Beizhu                               // 备注 -> 备注
                });
            } else {
                skipList.push(order.XuqiuDDH);
            }
        } else {
            // 不存在，插入新记录
            insertList.push({
                FormEngineKey: 'diy_scxqdd1766715873794',
                // 【生产需求订单】-> 【APS生产总计划】字段映射
                XuqiuDDH: order.XuqiuDDH,                          // 订单号 -> 生产订单号
                ERPxqddh: order.ERPxqddh,                          // ERP订单号 -> ERP生产订单号
                Cunhuo: order.Cunhuo,                              // 存货 -> 产成品
                CunhuoBM: order.CunhuoBM,                          // 物料编码 -> 产成品编码
                CunhuoID: order.CunhuoID,                          // CunhuoID -> CunhuoID
                // 注意：以下字段在【生产需求订单】中不存在，从关联表或默认值获取
                // CunhuoMC: null,                                 // 产成品名称（从存货档案获取）
                // GuigeXH: null,                                  // 规格型号（从存货档案获取）
                Kehu: null,                                        // 客户（生产需求订单无此字段）
                // KehuBM: null,                                   // 客户编码（生产需求订单无此字段）
                KehuMC: order.KehuMC,                              // 客户名称 -> 客户名称
                KehuID: null,                                      // 客户ID（生产需求订单无此字段）
                ShengchanLX: order.ShengchanLX,                    // 生产类型 -> 生产类型
                ShengchanBM: null,                                 // 生产部门（生产需求订单无此字段）
                ShengchanBMID: order.ShengchanBMID,                // ShengchanBMID -> ShengchanBMID
                PaichanKSSJ: null,                                 // 排产开始时间（默认空）
                PaichanJSSJ: null,                                 // 排产结束时间（默认空）
                PaichanZT: order.PaichanZT,                        // 排产状态 -> 排产状态
                ZhoujiHZT: null,                                   // 周计划状态（默认空）
                QitaoS: 0,                                         // 齐套数（默认0）
                WeipaiCS: order.WeipaiCS,                          // 未派工数 -> 未派工数
                XiugaiXSCN: null,                                  // 修改小时产能（默认空）
                XiugaiKSSJ: null,                                  // 修改开始时间（默认空）
                XiugaiJSSJ: null,                                  // 修改结束时间（默认空）
                XuQiuDJ: order.XuQiuDJ,                            // 需求单据 -> 需求单据
                ShifouGB: order.ShifouGB,                          // ERP是否关闭 -> ERP是否关闭
                priority: 0,                                       // 优先级（默认0）
                HebingID: null,                                    // 合并Id（默认空）
                ShengchanYLQDFLNM: order.ShengchanYLQDFLNM,        // 生产用料清单分录内码 -> 生产用料清单分录内码
                // XuqiuLY: null,                                  // 需求来源（生产需求订单无此字段）
                // KehuHTH: null,                                  // 客户合同号（生产需求订单无此字段）
                XiaoshouDDID: order.XiaoshouDDID,                  // 销售订单Id -> 销售订单Id
                // ShiyongZZ: null,                                // 使用组织（生产需求订单无此字段）
                // XuqiuLX: null,                                  // 需求类型（生产需求订单无此字段）
                ShiyongZZBM: order.ShiyongZZBM,                    // 使用组织编码 -> 使用组织编码
                PaichanS: null,                                    // 排产数（默认空）
                due_date: null,                                    // 订单交付时间（默认空）
                Beizhu: order.Beizhu,                              // 备注 -> 备注
                YaoqiuQTSJ: null,                                  // 要求齐套时间（默认空）
                DingdanSL: null,                                   // 订单数量（默认空）
                JiliangDW: null,                                   // 计量单位（默认空）
                XiugaiQTYQSJ: null                                 // 修改齐套要求时间（默认空）
            });
            newPlanIds.push(order.XuqiuDDH);
        }

        // 更新进度
        if (i % 10 === 0) {
            var progress = 20 + Math.floor((i / requirementOrders.length) * 20);
            V8.Cache.Set(progressCacheKey, JSON.stringify({
                status: 'processing',
                step: '处理主表数据 (' + (i + 1) + '/' + requirementOrders.length + ')',
                progress: progress,
                total: 100
            }));
        }
    }

    debugLog.insertListCount = insertList.length;
    debugLog.updateListCount = updateList.length;
    debugLog.skipListCount = skipList.length;

    // 执行批量插入
    var insertResult = null;
    if (insertList.length > 0) {
        V8.Cache.Set(progressCacheKey, JSON.stringify({
            status: 'processing',
            step: '批量插入新记录',
            progress: 40,
            total: 100
        }));

        insertResult = V8.FormEngine.AddTableData(insertList, V8.DbTrans);
        if (insertResult.Code != 1) {
            V8.Cache.Remove(lockCacheKey);
            return {
                Code: 0,
                Msg: '批量插入生产主计划失败：' + insertResult.Msg,
                DataAppend: {
                    DebugLog: isDebug ? debugLog : null
                }
            };
        }
    }

    // 执行批量更新
    var updateResult = null;
    if (updateList.length > 0) {
        V8.Cache.Set(progressCacheKey, JSON.stringify({
            status: 'processing',
            step: '批量更新已存在记录',
            progress: 45,
            total: 100
        }));

        updateResult = V8.FormEngine.UptTableData(updateList, V8.DbTrans);
        if (updateResult.Code != 1) {
            V8.Cache.Remove(lockCacheKey);
            return {
                Code: 0,
                Msg: '批量更新生产主计划失败：' + updateResult.Msg,
                DataAppend: {
                    DebugLog: isDebug ? debugLog : null
                }
            };
        }
    }

    // ==================== 步骤6：查询并插入【任务栈列表】子表 ====================
    V8.Cache.Set(progressCacheKey, JSON.stringify({
        status: 'processing',
        step: '查询APS工艺路线',
        progress: 50,
        total: 100
    }));

    // 查询所有新插入的【生产主计划】记录（需要获取Id）
    var newPlanRecords = V8.FormEngine.GetTableData('diy_scxqdd1766715873794', {
        _Where: [
            ['XuqiuDDH', 'In', newPlanIds]
        ],
        _PageSize: 10000,
        _SelectFields: ['Id', 'XuqiuDDH', 'CunhuoBM']
    }, V8.DbTrans);

    if (newPlanRecords.Code != 1) {
        V8.Cache.Remove(lockCacheKey);
        return {
            Code: 0,
            Msg: '查询新插入的生产主计划记录失败：' + newPlanRecords.Msg,
            DataAppend: {
                DebugLog: isDebug ? debugLog : null
            }
        };
    }

    var newPlanList = newPlanRecords.Data || [];
    var taskStackInsertCount = 0;
    var materialInsertCount = 0;
    var noGongyiCount = 0; // 没有找到工艺路线的记录数

    for (var i = 0; i < newPlanList.length; i++) {
        var planRecord = newPlanList[i];
        
        // 更新进度
        if (i % 5 === 0) {
            var progress = 50 + Math.floor((i / newPlanList.length) * 40);
            V8.Cache.Set(progressCacheKey, JSON.stringify({
                status: 'processing',
                step: '插入子表数据 (' + (i + 1) + '/' + newPlanList.length + ')',
                progress: progress,
                total: 100
            }));
        }

        // 查询【APS工艺路线】（优先取ShifouMR=1，否则取第一条，且ShifouTY<>1）
        var gongyiQuery = V8.FormEngine.GetTableData('diy_gylx1766652316974', {
            _Where: [
                ['CunhuoBM', '=', planRecord.CunhuoBM],
                ['ShifouTY', '<>', 1]
            ],
            _OrderBy: 'ShifouMR',
            _OrderByType: 'DESC',
            _PageSize: 1
        }, V8.DbTrans);

        if (gongyiQuery.Code != 1 || !gongyiQuery.Data || gongyiQuery.Data.length === 0) {
            // 没有找到工艺路线，记录日志，继续处理下一条
            noGongyiCount++;
            if (!debugLog.noGongyiRecords) {
                debugLog.noGongyiRecords = [];
            }
            debugLog.noGongyiRecords.push({
                XuqiuDDH: planRecord.XuqiuDDH,
                CunhuoBM: planRecord.CunhuoBM
            });
            continue;
        }

        var gongyiRecord = gongyiQuery.Data[0];

        // 查询【APS工艺路线-任务栈列表】
        var taskStackQuery = V8.FormEngine.GetTableData('diy_APSgylxsczx', {
            _Where: [
                ['GongyiLCID', '=', gongyiRecord.Id]
            ],
            _PageSize: 1000
        }, V8.DbTrans);

        if (taskStackQuery.Code != 1) {
            V8.Cache.Remove(lockCacheKey);
            return {
                Code: 0,
                Msg: '查询APS工艺路线-任务栈列表失败：' + taskStackQuery.Msg,
                DataAppend: {
                    DebugLog: isDebug ? debugLog : null
                }
            };
        }

        var taskStackList = taskStackQuery.Data || [];
        
        // 复制任务栈列表到【APS生产主计划-任务栈列表】
        var taskStackInsertList = [];
        for (var j = 0; j < taskStackList.length; j++) {
            var sourceTask = taskStackList[j];
            
            taskStackInsertList.push({
                FormEngineKey: 'diy_APSgylxsczx1766717760801',
                RequirementOrderId: planRecord.Id,             // 关联到生产主计划Id
                
                // ========== 字段名和说明完全相同的字段（直接复制） ==========
                ShifouMD: sourceTask.ShifouMD,                 // 是否末道 -> 是否末道
                XiaoshiCN: sourceTask.XiaoshiCN,               // 小时产能 -> 小时产能
                // GongxuLB: sourceTask.GongxuLB,              // 产线列表 -> 产线列表（子表的子表，暂不处理）
                QianzhiTS: sourceTask.QianzhiTS,               // 前置天数 -> 前置天数
                XiadaoRWZ: sourceTask.XiadaoRWZ,               // 下道任务栈 -> 下道任务栈
                SuoshuZZ: sourceTask.SuoshuZZ,                 // 所属组织 -> 所属组织
                // YongliaoQD: sourceTask.YongliaoQD,          // 用料清单 -> 用料清单（子表的子表，暂不处理）
                RenwuZLX: sourceTask.RenwuZLX,                 // 任务栈类型 -> 任务栈类型
                ShengchanZXBM: sourceTask.ShengchanZXBM,       // 任务栈编码 -> 任务栈编码
                Fujian: sourceTask.Fujian,                     // 附件 -> 附件
                PaixuM: sourceTask.PaixuM,                     // 排序码 -> 排序码
                ShifouTY: sourceTask.ShifouTY,                 // 是否停用 -> 是否停用
                SuoshuBM: sourceTask.SuoshuBM,                 // 所属部门 -> 所属部门
                ShengchanXS: sourceTask.ShengchanXS,           // 生产系数 -> 生产系数
                JiaoqiFDBL: sourceTask.JiaoqiFDBL,             // 交期放大比例 -> 交期放大比例
                DiejiaTS: sourceTask.DiejiaTS,                 // 叠加天数 -> 叠加天数
                ShengchanZXMC: sourceTask.ShengchanZXMC,       // 任务栈名称 -> 任务栈名称
                ShifouSD: sourceTask.ShifouSD,                 // 是否首道 -> 是否首道
                Beizhu: sourceTask.Beizhu,                     // 备注 -> 备注
                SuozaiCJ: sourceTask.SuozaiCJ,                 // 所在车间 -> 所在车间
                
                // ========== 目标表独有字段（默认值） ==========
                XiugaiXSCN: null,                              // 修改小时产能（目标表独有）
                XiugaiJSSJ: null,                              // 修改结束时间（目标表独有）
                ShengchanSL: null,                             // 生产数量（目标表独有）
                XiugaiQTSJ: null,                              // 修改齐套时间（目标表独有）
                YaoqiuQTSJ: null,                              // 要求齐套时间（目标表独有）
                PaichanKSSJ: null,                             // 排产开始时间（目标表独有）
                XiugaiKSSJ: null,                              // 修改开始时间（目标表独有）
                YaoqiuDLSJ: null,                              // 要求到料时间（目标表独有）
                QitaoS: null,                                  // 齐套数（目标表独有）
                PaichanJSSJ: null,                             // 排产结束时间（目标表独有）
                JiagongSC: null,                               // 加工时长（目标表独有）
                // ShangdaoRWZ: sourceTask.ShangdaoRWZ,        // 【注意】源表为int，目标表为varchar(100)，类型不同
                ShangdaoRWZ: sourceTask.ShangdaoRWZ ? String(sourceTask.ShangdaoRWZ) : null,  // 上道任务栈（int -> varchar）
                QitaoWLSD: null                                // 齐套物料锁定（目标表独有）
                
                // ========== 源表独有字段（不复制） ==========
                // GongyiLCID: sourceTask.GongyiLCID,          // 工艺流程Id（源表独有，不复制）
                // RenwuZID: sourceTask.RenwuZID,              // 任务栈Id（源表独有，不复制）
                // ChanchuP: sourceTask.ChanchuP,              // 产成品（源表独有，不复制）
                // ChanxianSL: sourceTask.ChanxianSL           // 产线条数（源表独有，不复制）
            });
        }

        if (taskStackInsertList.length > 0) {
            var taskStackInsertResult = V8.FormEngine.AddTableData(taskStackInsertList, V8.DbTrans);
            if (taskStackInsertResult.Code != 1) {
                V8.Cache.Remove(lockCacheKey);
                return {
                    Code: 0,
                    Msg: '插入任务栈列表失败：' + taskStackInsertResult.Msg,
                    DataAppend: {
                        planRecord: planRecord,
                        DebugLog: isDebug ? debugLog : null
                    }
                };
            }
            taskStackInsertCount += taskStackInsertList.length;
        }

        // ==================== 步骤7：插入【用料清单】子表 ====================
        
        // 查找对应的【生产需求订单】记录（根据XuqiuDDH）
        var orderRecord = null;
        for (var k = 0; k < requirementOrders.length; k++) {
            if (requirementOrders[k].XuqiuDDH === planRecord.XuqiuDDH) {
                orderRecord = requirementOrders[k];
                break;
            }
        }

        if (!orderRecord) {
            continue;
        }

        // 查询【生产需求订单-生产物料清单】
        var materialQuery = V8.FormEngine.GetTableData('diy_scwlqd', {
            _Where: [
                ['RequirementOrderId', '=', orderRecord.Id]
            ],
            _PageSize: 1000
        }, V8.DbTrans);

        if (materialQuery.Code != 1) {
            V8.Cache.Remove(lockCacheKey);
            return {
                Code: 0,
                Msg: '查询生产物料清单失败：' + materialQuery.Msg,
                DataAppend: {
                    DebugLog: isDebug ? debugLog : null
                }
            };
        }

        var materialList = materialQuery.Data || [];
        
        // 复制物料清单到【APS生产主计划_用料清单】
        var materialInsertList = [];
        for (var m = 0; m < materialList.length; m++) {
            var sourceMaterial = materialList[m];
            
            materialInsertList.push({
                FormEngineKey: 'diy_materialInput17666524183101766720999968',
                RequirementOrderId: planRecord.Id,             // 关联到生产主计划Id
                
                // ========== 字段映射 ==========
                // Cunhuo: sourceMaterial.Zijian,              // 【源】子件 -> 【目标】存货
                Cunhuo: sourceMaterial.Zijian,                 // 子件 -> 存货
                // CunhuoID: sourceMaterial.ZijianID,          // 【源】ZijianID -> 【目标】存货Id
                CunhuoID: sourceMaterial.ZijianID,             // ZijianID -> 存货Id
                // CunhuoGG: sourceMaterial.ZijianGG,          // 【源】子件规格 -> 【目标】存货规格
                CunhuoGG: sourceMaterial.ZijianGG,             // 子件规格 -> 存货规格
                DanweiSYL: sourceMaterial.DanweiSYL,           // 单位使用量 -> 单位使用量（字段名相同）
                JiliangDW: sourceMaterial.JiliangDW,           // 计量单位 -> 计量单位（字段名相同）
                // SunhaoL: sourceMaterial.ZijianSHL,          // 【源】子件损耗率 -> 【目标】损耗率
                SunhaoL: sourceMaterial.ZijianSHL,             // 子件损耗率 -> 损耗率
                
                // ========== 源表独有字段（无法映射，不复制或特殊处理） ==========
                // 【源】ZijianBM: sourceMaterial.ZijianBM,    // 子件编码（目标表无此字段）
                // 【源】ZijianMC: sourceMaterial.ZijianMC,    // 子件名称（目标表无此字段）
                // 【源】ZijianLX: sourceMaterial.ZijianLX,    // 子件类型（目标表无此字段）
                // 【源】YinglingSL: sourceMaterial.YinglingSL, // 应领数量（目标表无此字段）
                // 【源】ShengchanYLQDFLNM: sourceMaterial.ShengchanYLQDFLNM, // 生产用料清单内码（目标表无此字段）
                // 【源】ZijianSX: sourceMaterial.ZijianSX,    // 子件属性（目标表无此字段）
                // 【源】ShifouDC: sourceMaterial.ShifouDC,    // 是否倒冲（目标表无此字段）
                // 【源】JibenYL: sourceMaterial.JibenYL,      // 基本用量（目标表无此字段）
                // 【源】FApproveDate: sourceMaterial.FApproveDate, // 金蝶审核时间（目标表无此字段）
                // 【源】FREPLACEGROUP: sourceMaterial.FREPLACEGROUP, // 项次（目标表无此字段）
                // 【源】JichuSL: sourceMaterial.JichuSL,      // 基础用量（目标表无此字段）
                
                // ========== 特殊处理：类型不同的字段 ==========
                // 【源】ShifouGDYL (int) vs 【目标】GudingYL (decimal)
                // GudingYL: sourceMaterial.ShifouGDYL ? 1 : 0, // 是否固定用量 -> 固定用量（int转decimal）
                GudingYL: sourceMaterial.ShifouGDYL,           // 是否固定用量 -> 固定用量（待人工确认）
                
                // ========== 目标表独有字段（默认值） ==========
                DantiKZ: null,                                 // 单体克重（目标表独有）
                GongyiLXID: gongyiRecord.Id,                   // 工艺路线Id（目标表独有，使用当前工艺路线Id）
                GongxuID: null,                                // 工序Id（目标表独有）
                ZhucaiBZ: null                                 // 主材标志（目标表独有）
            });
        }

        if (materialInsertList.length > 0) {
            var materialInsertResult = V8.FormEngine.AddTableData(materialInsertList, V8.DbTrans);
            if (materialInsertResult.Code != 1) {
                V8.Cache.Remove(lockCacheKey);
                return {
                    Code: 0,
                    Msg: '插入用料清单失败：' + materialInsertResult.Msg,
                    DataAppend: {
                        planRecord: planRecord,
                        DebugLog: isDebug ? debugLog : null
                    }
                };
            }
            materialInsertCount += materialInsertList.length;
        }
    }

    debugLog.taskStackInsertCount = taskStackInsertCount;
    debugLog.materialInsertCount = materialInsertCount;
    debugLog.noGongyiCount = noGongyiCount;

    // ==================== 步骤8：完成处理 ====================
    V8.Cache.Set(progressCacheKey, JSON.stringify({
        status: 'completed',
        step: '引入完成',
        progress: 100,
        total: 100,
        insertCount: insertList.length,
        updateCount: updateList.length,
        skipCount: skipList.length,
        endTime: formatDateTime(new Date())
    }));

    // 清理锁
    V8.Cache.Remove(lockCacheKey);

    debugLog.endTime = formatDateTime(new Date());

    // ==================== 返回结果 ====================
    return {
        Code: 1,
        Data: {
            insertCount: insertList.length,
            updateCount: updateList.length,
            skipCount: skipList.length,
            taskStackCount: taskStackInsertCount,
            materialCount: materialInsertCount,
            noGongyiCount: noGongyiCount
        },
        Msg: '引入成功！新增 ' + insertList.length + ' 条，更新 ' + updateList.length + ' 条，跳过 ' + skipList.length + ' 条。' +
             '插入任务栈 ' + taskStackInsertCount + ' 条，用料清单 ' + materialInsertCount + ' 条。',
        DataAppend: {
            DebugLog: isDebug ? debugLog : null
        }
    };

} catch (error) {
    // 清理锁和进度缓存
    V8.Cache.Remove(lockCacheKey);
    V8.Cache.Remove(progressCacheKey);
    
    // 收集详细的错误信息，兼容Jint引擎
    debugLog.errorDetails = {
        message: error.message || '',
        toString: error.toString ? error.toString() : '',
        stack: error.stack || '',
        lineNumber: error.lineNumber || '',
        columnNumber: error.columnNumber || '',
        fileName: error.fileName || '',
        name: error.name || '',
        description: error.description || ''
    };
    
    var errorMsg = '引入生产主计划发生异常：' + (error.message || error.toString());
    if (error.lineNumber) {
        errorMsg += ' (行号: ' + error.lineNumber + ')';
    }
    if (error.stack) {
        errorMsg += '\n堆栈: ' + error.stack;
    }
    
    return {
        Code: 0,
        Msg: errorMsg,
        DataAppend: {
            DebugLog: isDebug ? debugLog : null
        }
    };
}
