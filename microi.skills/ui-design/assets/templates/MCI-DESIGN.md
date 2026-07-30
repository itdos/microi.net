# MCI-DESIGN

## 1. 产品目标

- 页面服务的用户：
- 用户进入页面后的首要任务：
- 首屏必须回答的问题：
- 成功衡量方式：

## 2. 设计模式

- 主模式：品牌叙事 / 真实产品流程 / 趋势构图 / 沉浸互动 / 动态首屏 / 数据工作台
- 辅助能力（最多两项）：
- 明确不采用的视觉手法：

## 3. 信息架构

1. 首屏：
2. 核心任务：
3. 证据或数据：
4. 辅助内容：
5. 最终行动：

## 4. Design Tokens

```yaml
color:
  background: var(--mci-bg)
  surface: var(--mci-surface)
  text: var(--mci-text)
  muted: var(--mci-text-muted)
  primary: var(--mci-primary)
  success: var(--mci-success)
  warning: var(--mci-warning)
  danger: var(--mci-danger)
spacing: [4, 8, 12, 16, 24, 32, 48, 64]
radius:
  input: var(--mci-shape-input)
  panel: var(--mci-shape-panel)
  card: var(--mci-shape-card)
  button: var(--mci-shape-button)
shadow:
  card: var(--mci-shadow-card)
  float: var(--mci-shadow-float)
```

## 5. 字体层级

| 用途 | 桌面 | 移动 | 字重 | 行高 |
| --- | ---: | ---: | ---: | ---: |
| Display | 64 | 40 | 700 | 1.05 |
| H1 | 40 | 32 | 700 | 1.15 |
| H2 | 28 | 24 | 650 | 1.25 |
| Body | 16 | 15 | 400 | 1.7 |
| Meta | 13 | 12 | 500 | 1.5 |

## 6. 组件与状态

| 组件 | 默认 | Hover / Pressed | Loading | Empty | Error | Disabled | Success |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 主按钮 |  |  |  | - |  |  |  |
| 搜索 / 筛选 |  |  |  |  |  |  |  |
| 列表 / 卡片 |  |  |  |  |  | - |  |
| 表单 |  |  |  | - |  |  |  |

## 7. 动效时间线

- 0—120ms：
- 120—360ms：
- 360—800ms：
- 循环动效：
- `prefers-reduced-motion` 降级：

## 8. 响应式

| 宽度 | 栅格 | 导航 | 主操作 | 内容重排 |
| --- | --- | --- | --- | --- |
| 390 | 4 列 |  |  |  |
| 768 | 8 列 |  |  |  |
| 1440 | 12 列 |  |  |  |

## 9. 媒体与性能

- 图片格式、尺寸与 `object-fit`：
- 视频 / Canvas / WebGL 的存在理由：
- 静态降级资源：
- 首屏资源预算：
- 失败与超时处理：

## 10. 验收清单

- [ ] 首屏在 3 秒内说清产品、对象和主操作。
- [ ] 默认、加载、空、错误、禁用、权限、成功状态可验证。
- [ ] 390 / 768 / 1440 无横向滚动、遮挡和错位。
- [ ] 明亮、暗黑主题均有足够对比度。
- [ ] 所有可点击元素有 hover/focus/pressed 和真实结果。
- [ ] 动效尊重 `prefers-reduced-motion`。
- [ ] 所有图片、字体、模型和代码资产来源合法且可离线构建。
