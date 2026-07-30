# MCI-DESIGN 设计契约

大型项目在根目录维护 `MCI-DESIGN.md`，让设计决策可版本管理、可复用、可被 AI 和人共同读取。它是对 `Microi.UI/src/theme/tokens.css` 的语义说明，不替代真实源码 token。

## 必需章节

1. 产品与用户
2. 视觉性格
3. 颜色
4. 字体
5. 布局与间距
6. 层级与形状
7. 组件契约
8. 页面模式
9. 动效与媒体
10. 响应式与安全区
11. 可访问性
12. 禁止事项

## 最小模板

```markdown
# 项目设计契约

## 产品与用户
- 首要用户：
- 首要任务：
- 关键设备：

## 视觉性格
- 三个关键词：专业、清晰、克制
- 主模式：真实产品流程
- 辅助能力：数据工作台

## 颜色
- `--mci-color-primary`：主动作与选中态
- `--mci-color-success`：已完成、在线
- `--mci-color-warning`：需关注
- `--mci-color-danger`：错误与危险动作
- `--mci-bg-base/card/elevated`：页面、卡片、浮层
- `--mci-text-primary/secondary/tertiary`：正文层级

## 字体
- Display：48/56, 800
- H1：32/40, 750
- H2：24/32, 700
- Body：16/28, 400
- Meta：13/20, 500

## 布局与间距
- Desktop：12 列，最大宽度 1280px
- Mobile：4 列，左右 16px
- 间距：4/8/12/16/24/32/48/64

## 组件契约
### PrimaryButton
- 高度 44px；图标 + 文字居中
- 状态：default/hover/focus/pressed/loading/disabled
- 主按钮每个页面最多一个视觉焦点

### Card
- 使用 `--mci-bg-card`、`--mci-border-color`、`--mci-shape-card`
- 卡片可点击时才有 hover/pressed

## 页面模式
- 首页：品牌叙事 + 产品对象
- 列表：筛选 + 骨架 + 业务卡片 + 分页
- 表单：分段 + 草稿 + 错误摘要 + 固定操作栏

## 动效与媒体
- 入场 320ms；微交互 160ms；仅 transform/opacity
- 复杂媒体提供静态海报与 reduced-motion 降级

## 禁止事项
- 禁止全局泛化 CSS、纯文字底部导航、假按钮、无降级远程资源
```

## AI 使用规则

- 开始实现前读取本契约和 `ui-design` skill。
- 契约缺少的值优先继承 Microi.UI token，不临时发明新色值或圆角。
- 新模式在两个以上页面重复时先更新契约，再抽成 `Mci*` 或项目级 `mci-*` 组件。
- 修改契约后至少截图一张受影响页面的桌面和移动版本。
- 契约与实现冲突时，以当前合法源码和用户最新明确要求为准，并同步修订契约。
