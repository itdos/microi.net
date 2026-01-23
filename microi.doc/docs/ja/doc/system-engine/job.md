# タスクスケジューリング
## 紹介
> * プラットフォームは定時タスクをサポートしており、インターフェイスエンジンまたはカスタム開発された.net dllファイルを定時実行することができます

## すべてのタスクを停止
```sql
-- 执行sql语句
update diy_schedule_job set Status='暂停';
update microi_job_triggers set TRIGGER_STATE='PAUSED';
-- 然后重启microi-api容器
```

## 異常タスクの削除
```sql
-- 假设任务名为：dnsSync
update from diy_schedule_job set IsDelete = 1 where JobName='dnsSync';
delete from microi_job_cron_triggers where TRIGGER_NAME = 'dnsSync';
delete from microi_job_triggers where JOB_NAME = 'dnsSync';
delete from microi_job_job_details where JOB_NAME = 'dnsSync';
```

## タスク重複結果ログの自動削除
```js
// 比如说定时任务执行的是一个接口引擎，我们在接口引擎最后增加以下代码：
// 假设任务名为：dnsSync，我们只保留最近N条重复的相同结果日志
// 只保留定时任务每天最近几条数据相同数据
var saveCount = 10;
var taskName = 'dnsSync';
V8.Db.FromSql(`
DELETE FROM diy_schedule_job_log 
WHERE Message = '${JSON.stringify(result)}' 
  AND JobName = '${taskName}'
  -- 只删除当天的
  AND CreateTime >= '${DateNow('yyyy-MM-dd')} 00:00:00'
  AND Id NOT IN (
    -- 选择创建时间最近的N条记录的ID
    SELECT Id FROM (
      SELECT Id 
      FROM diy_schedule_job_log 
      WHERE Message = '${JSON.stringify(result)}' 
        AND JobName = '${taskName}' 
      ORDER BY CreateTime DESC 
      LIMIT ${saveCount}
    ) AS keep_ids
  );
`).ExecuteNonQuery();
return result;
```