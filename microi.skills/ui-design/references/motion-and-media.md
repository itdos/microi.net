# Microi 动效与媒体规范

## 预算先行

| 项目 | 桌面建议 | 移动端建议 |
| --- | --- | --- |
| 首屏可读内容 | 尽快出现，不等待装饰资源 | 同左 |
| 主转场 | 260-420ms | 220-340ms |
| 微交互 | 140-220ms | 120-180ms |
| 列表交错 | 30-60ms/项，最多前 8 项 | 20-40ms/项，最多前 6 项 |
| Canvas/WebGL 像素比 | 上限 1.5-2 | 上限 1-1.5 |
| 持续装饰动画 | 至少 4s/循环 | 默认减弱或关闭 |

动画只使用 `transform`、`opacity` 和必要的 `background-position`。禁止持续动画布局属性、滤镜和阴影。

## 首屏动效状态机

```text
idle -> entering -> settled -> interacting -> paused -> reduced
```

- `entering` 只运行一次，不能因局部数据更新整页重播。
- `settled` 保留低振幅状态，主 CTA 始终可点击。
- 页面隐藏、离开视口或系统省电时进入 `paused`。
- `prefers-reduced-motion` 或低性能策略进入 `reduced`，直接显示最终布局。

## 滚动叙事

- 先把内容按无 JS 的普通页面排好，再增强 sticky 和进度。
- 每个滚动段只映射一个明确状态；使用离散段落而非无限连续参数。
- 粘性舞台不能捕获滚轮或阻止浏览器返回。
- 移动端内容高度过长时取消 sticky，按图文段落顺序展示。

## Canvas / WebGL

- Canvas 仅负责展示；标题、按钮、表单和可访问文本保留在 DOM。
- 初始化前显示同尺寸静态海报或骨架，失败时继续保留海报。
- 使用 `IntersectionObserver` 控制启停，标签页隐藏时暂停 requestAnimationFrame。
- 组件卸载时释放纹理、几何体、材质、事件和动画帧。
- 纹理使用本地合法资源，压缩尺寸；禁止把远程大图直接作为不可控依赖。
- 指针交互必须限定在容器，手机端改为陀螺仪前必须获得权限，否则使用静态视差。

## 图片

- 预览卡片先确定固定比例和 `object-fit`：人物/环境/商品通常 `cover`，完整界面/海报/移动端截图通常 `contain`。
- 首屏关键图片提供 width/height 或 aspect-ratio，防止布局偏移。
- 非首屏图片 `loading="lazy"`；首屏主图按需 preload，但不能一次 preload 多张大图。
- 远程资源必须下载为本地合法资产或提供稳定降级；404 时显示有品牌感的空图，不显示破图图标。

## 视频

- 视频必须静音、可暂停、有海报；默认不在移动端自动播放背景视频。
- 有声内容必须由用户主动触发，提供字幕或文字摘要。
- 背景视频不承担唯一信息；失败后页面仍能理解和操作。

## 可访问与低性能降级

```css
@media (prefers-reduced-motion: reduce) {
  [data-mci-ui-root] *,
  [data-mci-ui-root] *::before,
  [data-mci-ui-root] *::after {
    scroll-behavior: auto !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

同时检查低端 Android、后台标签页、弱网、资源失败、浏览器缩放 200% 和高对比模式。视觉效果不能成为业务完成事实源。
