# go-view 集成说明

## 概述

本目录将开源数据可视化低代码平台 **go-view** 集成到 microi.web 中，提供大屏数据看板的设计和预览功能。

- **集成时间**：2026-03-10
- **go-view 版本**：1.3.2（基于 2026-01-12 的代码快照）
- **官方仓库**：https://gitee.com/dromara/go-view

## 路由

| 路由 | 说明 |
|------|------|
| `/#/mic/data-dashboard/design/:Id` | 大屏设计器（编辑页） |
| `/#/mic/data-dashboard/preview/:Id` | 大屏预览页 |

## 目录结构

```
src/views/go-view/
├── index.js              # 模块入口，导出 GoViewEditor / GoViewPreview / setupGoView
├── setup.js              # 初始化：NaiveUI 组件、自定义组件、指令、图标、主题、样式
├── editor.vue            # 编辑器宿主页（加载项目数据 → chartEditStore → 渲染设计器）
├── preview.vue           # 预览宿主页（加载项目数据 → sessionStorage → 渲染预览）
├── GoViewMessageInject.vue
├── demo-data.json        # 开发调试用示例数据
└── src/                  # go-view 原始源码（整体嵌入，仅修改 import 路径别名）
    ├── api/              # 接口（集成中未使用，数据通过宿主页加载）
    ├── assets/           # 静态资源
    ├── components/       # 公共组件
    ├── directives/       # 指令
    ├── enums/            # 枚举
    ├── hooks/            # 组合式函数
    ├── i18n/             # 国际化
    ├── layout/           # 布局组件
    ├── packages/         # 图表组件包（Charts / Decorates / Icons / Informations / Photos / Tables / VChart）
    ├── plugins/          # 插件注册（NaiveUI、自定义组件、指令）
    ├── router/           # 路由（集成中未使用，由 microi.web 路由接管）
    ├── settings/         # 全局配置
    ├── store/            # Pinia Store（chartEditStore / chartHistoryStore / chartLayoutStore 等）
    ├── styles/           # SCSS 样式
    ├── utils/            # 工具函数
    └── views/            # 页面（chart 设计器 / preview 预览）
```

## Vite 配置

`vite.config.js` 中的关键配置：

- **路径别名**：`@goview` → `src/views/go-view/src`
- **SCSS 注入**：`src/views/go-view/src/` 下的文件自动注入 `@goview/styles/common/style.scss`

## 后端对接

- **表单引擎 Key**：`mic_data_dashboard`
- **数据字段**：`ContentData`（JSON 字符串，包含 editCanvasConfig、requestGlobalConfig、componentList）
- **项目名称字段**：`ProjectName`
- **API 调用**：`DiyCommon.FormEngine.GetFormData({ FormEngineKey: 'mic_data_dashboard', Id })`

## 集成适配要点

与 go-view 原始代码相比，集成中做了以下适配：

1. **import 路径**：`@/` 全部替换为 `@goview/`
2. **Pinia**：复用 microi.web 的 Pinia 实例（v3），Store 定义已适配 Pinia v3 语法
3. **路由**：go-view 内部路由不使用，由 microi.web 路由 + 宿主页（editor.vue / preview.vue）接管
4. **数据加载**：不走 go-view 原生 API，宿主页通过 FormEngine 加载数据后注入 Store
5. **CSS 隔离**：`.go-view-editor-wrapper` 设置 `--goview-top-offset: 82px` 和 `font-size: 12px` 隔离宿主全局样式
6. **NaiveUI**：共用 microi.web 已安装的 NaiveUI（2.44.x），通过 setup.js 注册全局组件

## 代码同步（与官方仓库保持更新）

后续如需同步 go-view 官方更新，参考以下流程：

1. 查看官方提交日志：https://gitee.com/dromara/go-view/commits/master
2. 筛选自 **2026-01-12** 之后的提交
3. 对照提交内容，在 `src/views/go-view/src/` 下进行**手动差量同步**
4. 同步时注意：
   - import 路径需保持 `@goview/` 别名（不要用 `@/`）
   - Pinia Store 如有变化需适配 v3 语法（`defineStore` 的 `actions` 中 `this` 指向等）
   - 新增的 npm 依赖需在 microi.web 的 `package.json` 中安装
   - 新增的全局组件/指令需在 `setup.js` 中注册
