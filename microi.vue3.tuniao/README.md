
## 介绍

`吾码标准版`是一款基于`uniapp`、`vue3`、`Typescript`、`TuniaoUI`提供丰富的组件进行快速开发，支持`微信小程序`、`APP`和`H5`，包含我的工作处理、表单动态生成增删改查功能。

## 目录结构

src
|——config --接口相关
|——demo-pages --图鸟相关UI
|——pages --主页面
|——router --路由拦截
|——stores --数据存储
|——utils --相关工具

## 安装环境

node 版本 v18
在运行npm install命令时，添加--legacy-peer-deps选项，以接受可能存在的冲突依赖解析。

打包apk时 pinia不兼容，弃用
由于uniapp的pinia版本与vue3不兼容，所以需要安装pinia@2.0.3版本
npm install pinia@2.0.3 --legacy-peer-deps
