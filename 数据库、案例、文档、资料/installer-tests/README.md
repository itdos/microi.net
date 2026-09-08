# 一键安装器回归

在 Linux / Bash 中执行：

```bash
bash '数据库、案例、文档、资料/installer-tests/install-microi-network.test.sh'
```

测试直接读取安装器函数，使用有状态的 Docker / firewalld 替身验证网桥恢复、重复执行、运行与持久配置、失败回读、Alibaba Cloud Linux / Anolis 识别以及中断安装的容器保护。不会运行安装主流程或修改宿主机防火墙，也不需要真实 Docker daemon。

这些测试不能代替真实网络验收。真实环境还应使用官方 `minio-mc` 镜像从 `microi` 网络验证 readiness、密钥认证、公私桶创建与权限回读，并确认网络失败和认证失败均不会继续写入 SaaS 配置。客户现场完整安装还需 API liveness / readiness 与文件上传下载通过。
