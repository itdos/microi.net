# Microi吾码 - 前端项目（microi.web）

> 基于 **Vue 3 + Vite + Element Plus + Pinia** 构建的开源低代码平台前端，支持界面引擎、表单引擎、打印引擎、工作流、移动端等核心能力。

---

## 📁 项目结构

```
microi.web/
├── bin/
│   └── Release/               # 编译后产物目录（npm run build 输出）
├── hbuilder-app/               # HBuilderX App 打包项目（用于生成 Android / iOS 应用）
├── public/                     # 静态资源
├── src/
│   ├── assets/                 # 静态资源（图片、图标等）
│   ├── components/             # 全局公共组件
│   ├── config.json             # 后端接口地址配置（本地修改不会被 git 追踪）
│   ├── lang/                   # 国际化语言包（中文 / 英文）
│   ├── layout/                 # 页面布局框架
│   ├── pinia/                  # Pinia 状态管理
│   ├── router/                 # 路由配置
│   ├── styles/                 # 全局样式
│   ├── utils/                  # 工具函数
│   └── views/                  # 页面视图
│       ├── form-engine/        # ⭐ 表单引擎（表单设计、渲染、搜索等）
│       ├── page-engine/        # ⭐ 界面引擎（页面设计与渲染）
│       ├── print-engine/       # ⭐ 打印引擎（打印模板设计与渲染）
│       ├── workflow/           # ⭐ 工作流引擎（流程设计、审批、我的工作等）
│       ├── mobile/             # 📱 移动端页面
│       ├── file-manage/        # 📂 文件管理
│       ├── chat/               # 💬 即时通讯
│       ├── cad-preview/        # CAD 图纸预览
│       ├── fullcalendar/       # 日历组件
│       ├── webos/              # WebOS 桌面系统
│       ├── system/             # 系统管理（用户、角色、部门、日志）
│       ├── login/              # 登录页
│       ├── custom/             # 客户定制组件（可删除，不影响主系统）
│       ├── error-page/         # 错误页面
│       └── redirect/           # 路由重定向
├── index.html                  # 入口 HTML
├── vite.config.js              # Vite 构建配置
└── package.json                # 项目依赖与脚本
```

---

## 使项目跑起来

>* 使用 node.js 18、20
>* nvm use 20。如何安装 nvm：https://blog.csdn.net/qq973702/article/details/143821242
>* npm install nrm -g
>* nrm use taobao (📌 备注：如果 taobao 不行用 nrm use npmMirror)
>* npm install
>* npm run dev

## 若以上步骤出现 timeout 等未知错误，可以尝试下以下步骤：

>* 删除 node_modules
>* 删除 package-lock.json
>* 执行# npm cache clean --force
>* 重新执行# npm install 安装环境步骤

## 📌 切换后端接口地址

>* `src/config.json` 文件已随源码提供默认配置，直接修改该文件即可（修改后刷新浏览器生效，无需重启服务）。
>* 执行 `npm install` 后会自动运行 `git update-index --skip-worktree src/config.json`，**本地对该文件的任何修改都不会被 git 追踪上传**，团队协作互不影响。
>* 若需重新让 git 追踪此文件，执行：`git update-index --no-skip-worktree src/config.json`

默认内容如下：
```json
{
  "ApiBaseDev": "https://api.itdos.com"
}
```

## 访问系统
```
http://localhost:1988/?OsClient=iTdos
```

## 定制组件目录
>* [/src/views/custom/]为所有客户的定制组件，理论上不用上传到仓库，用户可主动删除里面的所有文件。

## 格式化指定文件
```shell
npx prettier --write src/views/index.vue
```