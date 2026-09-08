# 一键安装器回归

在 Linux / Bash 中执行：

```bash
bash '数据库、案例、文档、资料/installer-tests/install-microi-network.test.sh'
bash '数据库、案例、文档、资料/installer-tests/install-microi-mysql-root.test.sh'
```

测试直接读取安装器函数，使用有状态的 Docker / firewalld 替身验证网桥恢复、重复执行、运行与持久配置、失败回读、Alibaba Cloud Linux / Anolis 识别以及中断安装的容器保护。不会运行安装主流程或修改宿主机防火墙，也不需要真实 Docker daemon。

这些测试不能代替真实网络验收。真实环境还应使用官方 `minio-mc` 镜像从 `microi` 网络验证 readiness、密钥认证、公私桶创建与权限回读，并确认网络失败和认证失败均不会继续写入 SaaS 配置。客户现场完整安装还需 API liveness / readiness 与文件上传下载通过。

MySQL 回归覆盖新装/已有服务的 root 同源凭据、特殊密码、Docker host-gateway、权限不足/部分撤权/只读/认证失败关闭及日志脱敏。真实数据库验收应分别在隔离的 MySQL 5.7 和 8.0 容器中运行安装器权限函数，并完成跨库创建、独立帐号创建与授权、子帐号登录读写和重启后的复查；检查失败时不得继续数据库导入或 API 部署。不要把仅能在数据库容器内通过 socket 登录 root 视为 API 网络登录已通过。
