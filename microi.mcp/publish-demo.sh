#!/bin/bash
# Microi MCP Server Docker 镜像发布脚本（开源版模板）
# 请修改脚本中的 Docker 帐号、密码、地域、命名空间
# macos若遇权限问题无法运行此脚本，请执行命令：chmod +x publish-demo.sh

echo "请输入本次要发布的版本号："
read version

docker login --username=阿里云docker帐号 --password=阿里云docker密码 registry.cn-地域.aliyuncs.com
docker build -t microi-mcp .

docker tag microi-mcp registry.cn-地域.aliyuncs.com/命名空间/microi-mcp:latest
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-mcp:latest

docker tag microi-mcp registry.cn-地域.aliyuncs.com/命名空间/microi-mcp:$version
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-mcp:$version

echo "发布完成：microi-mcp:$version"
