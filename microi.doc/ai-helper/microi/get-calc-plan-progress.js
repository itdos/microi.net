/**
 * 【生产主计划】计算进度查询接口
 * 功能：查询计算任务的执行进度
 * 
 * 调用方式：GET /apiengine/get-calc-plan-progress
 */

var progressCacheKey = 'Microi:' + V8.OsClient + ':CalcPlan:Progress';
var lockCacheKey = 'Microi:' + V8.OsClient + ':CalcPlan:Lock';

try {
    // 获取进度信息
    var progressStr = V8.Cache.Get(progressCacheKey);
    var lockStatus = V8.Cache.Get(lockCacheKey);

    if (!progressStr) {
        return {
            Code: 1,
            Data: {
                status: 'idle',
                message: '暂无计算任务',
                isRunning: !!lockStatus
            }
        };
    }

    var progress = JSON.parse(progressStr);
    progress.isRunning = !!lockStatus;

    return {
        Code: 1,
        Data: progress
    };

} catch (error) {
    return {
        Code: 0,
        Msg: '获取进度失败：' + (error.message || error.toString())
    };
}
