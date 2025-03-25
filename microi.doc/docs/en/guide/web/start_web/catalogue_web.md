<! -- Directory structure -->

# Directory structure

## Microi Code Front-end Directory Description📚

```bash
web
├─ .vscode                # VSCode 推荐配置
├─ build                  # 构建 配置项
├─ dist                   # 发布文件目录
├─ public                 # 静态资源文件（该文件夹不会被打包）
├─ src
│  ├─ api                 # API 接口管理
│  ├─ assets              # 静态资源文件
│  ├─ axios               # 用于HTTP请求封装
│  ├─ components          # 全局组件
│  ├─ directive           # 全局指令文件
│  ├─ filters             # 过滤器
│  ├─ icons               # 图标
│  ├─ lang                # 国际化
│  ├─ layout              # 布局管理
│  ├─ router              # 路由管理
│  ├─ store               # 状态机
│  ├─ styles              # 全局样式文件
│  ├─ utils               # 常用工具库
│  ├─ views               # 项目所有页面
│  ├─ App.vue             # 项目主组件
│  ├─ permission.js       # 权限配置文件
│  ├─ main.js             # 项目入口文件
│  └─ settings.js         # 系统设置文件
├─ .editorconfig          # 统一不同编辑器的编码风格
├─ .babel.config.js       # 浏览器兼容
├─ .default.conf          # Nginx配置文件
├─ .env                   # vite 常用配置
├─ .env.development       # 开发环境配置
├─ .env.production        # 生产环境配置
├─ .env.test              # 测试环境配置
├─ index.html             # 入口 html
├─ LICENSE                # 开源协议文件
├─ package-lock.json      # 依赖包包版本锁
├─ package.json           # 依赖包管理
├─ postcss.config.js      # JavaScript插件对CSS进行转换的工具配置
├─ README.md              # README 介绍
└─ vite.config.ts         # vite 全局配置文件
```
