# 任务调度
## 介绍
>* 平台支持定时任务，可定时执行接口引擎或定制开发的.net dll文件

## 停止所有任务
```sql
//执行sql语句
update diy_schedule_job set Status='暂停';
update microi_job_triggers set TRIGGER_STATE='PAUSED';
//然后重启microi-api容器
```