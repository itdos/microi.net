# 吾码宿主磁盘维护协议 1

独立 Linux root 服务 `microi-disk-guard.service`，控制 socket 固定为
`/run/microi-disk-guard/control.sock`。无需业务 API、数据库或服务器面板保持在线。
状态、策略、闲置基线、任务保护与回执持久化在 `/var/lib/microi-disk-guard`。

新安装默认开启：15 分钟监测、北京时间 03:00 常规清理，空间/inode 85% 预警、90% 暂停新下载，
可用空间另保留 5 GiB；镜像连续闲置满 7 天，保护当前与两个不同历史版本、已验证回滚版本及活动任务。
首次登记保守保留存量历史候选，未知验证状态不冒充业务健康。策略关闭只关闭自动删除，监测继续。

仅 root 明确登记的 API/Web 仓库参与候选；`data` 登记只监测其真实数据盘，不回收数据库镜像。
所有容器（包括停止容器）引用、共享/多标签镜像、未知来源镜像与维护任务保护均保留。
实现没有卷删除、容器删除、全局 prune、构建缓存删除或 Docker 日志截断动作。
删除使用同一 Unix 连接复核 Engine ID、所有容器引用、精确镜像标签/摘要，再非强制删除与回读。

安装使用发行包 `install.sh --python /root控制的Python3.9+/bin/python3`；原策略和账本幂等保留。
源码/运行时/目录必须由 root 控制，旧 systemd 219 使用受支持的只读目录隔离。
代码版本按 SHA-256 保存在 `/opt/microi-disk-guard/releases`，激活失败尝试恢复原服务，保留运行数据。

宿主 CLI：

```bash
python3 /opt/microi-disk-guard/current/daemon.py status
python3 /opt/microi-disk-guard/current/daemon.py preview
python3 /opt/microi-disk-guard/current/daemon.py enroll --name microi-install-api --role api
python3 /opt/microi-disk-guard/current/daemon.py enroll --name microi-install-client --role web
```

本机 `guarded --operation 唯一任务号 --images '镜像引用JSON数组' --required-bytes 字节数 -- 命令 参数`
在同一宿主锁内先校验空间并登记保护，再执行明确的本机维护命令。该命令入口不由 HTTP 暴露。
失败任务的镜像保护不自动超时删除；处理原任务后才完成保护，避免把恢复现场当成闲置镜像。

预估镜像大小与实际回收字节分别记录；空间腾出不表示数据库或文件系统已恢复正常。
保护仍占满磁盘、业务数据增长或文件系统故障时，保留服务现场、暂停新增下载并提示扩容/排查。
