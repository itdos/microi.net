# ui-design 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=ui-design-007 sha256=b32dac5c75835929c6c55607807cad0cd14a013ddc1a41e307263549f2047867 -->
## 颜色体系（CSS Variables — 支持主题切换）

所有颜色必须通过 CSS 变量引用，禁止硬编码色值。变量定义放在全局样式入口（PC 端 `src/styles/mci-design.scss`，移动端 `<style>` 内或独立 CSS 文件）。

### 暗黑主题（可选切换 — `data-theme="dark"`）

```css
:root[data-theme="dark"] {
  /* 主色 — 科技紫蓝 */
  --mci-color-primary: #722BFF;
  --mci-color-primary-light: #9B5FFF;
  --mci-color-primary-dark: #5A1FCC;
  --mci-color-primary-glow: rgba(114, 43, 255, 0.35);

  /* 辅助色 */
  --mci-color-accent-red: #FF2E63;
  --mci-color-accent-blue: #29B8FF;
  --mci-color-accent-gold: #FFD100;
  --mci-color-accent-cyan: #00F5D4;
  --mci-color-accent-pink: #FF6EC7;

  /* 语义色（成功/警告/错误/信息） */
  --mci-color-success: #00F5D4;
  --mci-color-warning: #FFD100;
  --mci-color-danger: #FF2E63;
  --mci-color-info: #29B8FF;

  /* 背景 */
  --mci-bg-base: #0A0A0F;
  --mci-bg-elevated: #121218;
  --mci-bg-surface: #1A1A24;
  --mci-bg-card: rgba(255, 255, 255, 0.04);
  --mci-bg-card-hover: rgba(255, 255, 255, 0.08);
  --mci-bg-glass: rgba(255, 255, 255, 0.06);
  --mci-bg-glass-border: rgba(255, 255, 255, 0.1);
  --mci-bg-mask: rgba(0, 0, 0, 0.6);

  /* 文字 */
  --mci-text-primary: #FFFFFF;
  --mci-text-secondary: #A0A0B8;
  --mci-text-tertiary: #6B6B80;
  --mci-text-disabled: #4A4A5A;
  --mci-text-on-primary: #FFFFFF;

  /* 边框 */
  --mci-border-color: rgba(255, 255, 255, 0.08);
  --mci-border-color-hover: rgba(255, 255, 255, 0.15);
  --mci-border-glow: rgba(114, 43, 255, 0.3);

  /* 渐变 */
  --mci-gradient-primary: linear-gradient(135deg, #722BFF 0%, #29B8FF 100%);
  --mci-gradient-hot: linear-gradient(135deg, #FF2E63 0%, #FF6EC7 100%);
  --mci-gradient-gold: linear-gradient(135deg, #FFD100 0%, #FF8C00 100%);
  --mci-gradient-cyber: linear-gradient(135deg, #00F5D4 0%, #722BFF 50%, #FF2E63 100%);
  --mci-gradient-bg: radial-gradient(ellipse at 20% 50%, rgba(114, 43, 255, 0.08) 0%, transparent 60%);
}
```

### 亮色主题（默认）

```css
:root[data-theme="light"], :root {
  --mci-color-primary: #6C2BD9;
  --mci-color-primary-light: #8B5CF6;
  --mci-color-primary-dark: #5521B5;
  --mci-color-primary-glow: rgba(108, 43, 217, 0.15);

  --mci-color-accent-red: #E8294A;
  --mci-color-accent-blue: #2196F3;
  --mci-color-accent-gold: #F59E0B;
  --mci-color-accent-cyan: #06B6D4;
  --mci-color-accent-pink: #EC4899;

  --mci-color-success: #06B6D4;
  --mci-color-warning: #F59E0B;
  --mci-color-danger: #E8294A;
  --mci-color-info: #2196F3;

  --mci-bg-base: #F5F5FA;
  --mci-bg-elevated: #FFFFFF;
  --mci-bg-surface: #F0F0F8;
  --mci-bg-card: rgba(255, 255, 255, 0.9);
  --mci-bg-card-hover: rgba(255, 255, 255, 1);
  --mci-bg-glass: rgba(255, 255, 255, 0.7);
  --mci-bg-glass-border: rgba(0, 0, 0, 0.08);
  --mci-bg-mask: rgba(0, 0, 0, 0.4);

  --mci-text-primary: #1A1A2E;
  --mci-text-secondary: #64648C;
  --mci-text-tertiary: #9898B0;
  --mci-text-disabled: #C0C0D0;
  --mci-text-on-primary: #FFFFFF;

  --mci-border-color: rgba(0, 0, 0, 0.06);
  --mci-border-color-hover: rgba(0, 0, 0, 0.12);
  --mci-border-glow: rgba(108, 43, 217, 0.2);

  --mci-gradient-primary: linear-gradient(135deg, #6C2BD9 0%, #2196F3 100%);
  --mci-gradient-hot: linear-gradient(135deg, #E8294A 0%, #EC4899 100%);
  --mci-gradient-gold: linear-gradient(135deg, #F59E0B 0%, #EA580C 100%);
  --mci-gradient-cyber: linear-gradient(135deg, #06B6D4 0%, #6C2BD9 50%, #E8294A 100%);
  --mci-gradient-bg: radial-gradient(ellipse at 20% 50%, rgba(108, 43, 217, 0.04) 0%, transparent 60%);
}
```

### 颜色使用规则

- **主题模型分两层**：`data-theme="light|dark"` 控制明暗底色，`data-mci-palette="black|white|red|orange|yellow|green|cyan|blue|purple"` 控制品牌主色。
- **所有移动端与 PC 网站项目必须支持主流主色切换**：黑、白、红、橙、黄、绿、青、蓝、紫至少 9 个 palette。后台管理系统可由 Element Plus 主题承载，但也必须映射到 `--mci-*` token。
- **palette 不得只换按钮底色**：必须同步覆盖 `--mci-color-primary`、`--mci-color-primary-strong`、`--mci-text-on-primary`、`--mci-border-glow`、`--mci-gradient-primary`、`--mci-shadow-button`、`--mci-shadow-button-hover`。
- **白色/黄色主题必须单独处理文字颜色**：主按钮文字使用 `--mci-text-on-primary`，白色主题用深色字，黄色主题用深棕/深灰字，禁止固定白字。
- **主色**用于核心交互元素（按钮、链接、选中态）
- **Accent Red / Danger** 用于危险操作、错误、热门标记
- **Accent Blue / Info** 用于信息提示、次要按钮
- **Accent Gold / Warning** 用于重要强调、VIP 标签、价格、警告
- **Accent Cyan / Success** 用于成功状态、在线标识
- 默认主题为亮色 + 红色 palette；暗黑主题和主色 palette 都作为用户可选项。
- 用户主题偏好持久化到 `mci-theme`、`mci-palette`、`mci-shape`，初次访问可跟随系统 `prefers-color-scheme`。

### 主色 Palette 必备定义

```css
:root[data-mci-palette="black"]  { --mci-color-primary:#111827; --mci-text-on-primary:#fff; }
:root[data-mci-palette="white"]  { --mci-color-primary:#F8FAFC; --mci-text-on-primary:#111827; }
:root[data-mci-palette="red"]    { --mci-color-primary:#B51220; --mci-text-on-primary:#fff; }
:root[data-mci-palette="orange"] { --mci-color-primary:#EA580C; --mci-text-on-primary:#fff; }
:root[data-mci-palette="yellow"] { --mci-color-primary:#D9A23A; --mci-text-on-primary:#3A2500; }
:root[data-mci-palette="green"]  { --mci-color-primary:#16A34A; --mci-text-on-primary:#fff; }
:root[data-mci-palette="cyan"]   { --mci-color-primary:#0891B2; --mci-text-on-primary:#fff; }
:root[data-mci-palette="blue"]   { --mci-color-primary:#2563EB; --mci-text-on-primary:#fff; }
:root[data-mci-palette="purple"] { --mci-color-primary:#7C3AED; --mci-text-on-primary:#fff; }
```

实际项目优先直接使用 `Microi.UI/src/theme/tokens.css`，不要复制这段最小示例；新增 palette 时必须补充悬浮阴影、边框高光和渐变。

### 移动端可读性底线

- 移动端首页、商城、分享海报、资产页必须优先保证阅读清楚。浅色背景上的正文、占位文字、标签、金额、按钮文字不得使用低透明度浅灰或低对比金色。
- 移动端底部导航、首页快捷入口、个人中心快捷入口的图标对比度与文字同等重要。彩色圆底图标必须显式设定内部图标色，并在每个主题截图确认可见。
- 关键正文与背景对比度建议不低于 4.5:1；大标题、海报大字、促销卡标题不低于 3:1。金色渐变按钮默认使用深红/深棕文字，不使用白字。
- 在渐变、图片、红金背景上放文字时，文字必须是实色且有足够字重；不要依赖 `opacity: .6` 这类弱化文字承载业务信息。
- 完成移动端风格改造后，必须配合 Playwright、浏览器 DevTools、微信开发者工具自动化或项目已有 E2E 工具进行截图和关键文字对比度检查，复核首页第一屏、列表页、登录页、分享海报、空态/未登录态和关键按钮。
- 用户要求“全自动化测试”“自动化验收”“跑完整测试”等时，如果本次涉及 UI/前端改动，自动化链路必须包含截图验证或视觉断言；只运行构建、lint、静态检查不能宣称已完成全自动化 UI 验收。若当前环境无法启动浏览器/小程序开发者工具，必须明确说明未完成截图验证。

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-008 sha256=80df5bdb440dea278d96692425780d40232b8ab4bbb604ee1b3f9727679ea65a -->
## 阴影体系（层次与质感）

阴影是塑造层次感、可点击性和高级质感的关键。采用多层阴影叠加，但不要做脏、糊、重的阴影。

```css
:root {
  /* 基础层级阴影 */
  --mci-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.25);
  --mci-shadow-md: 0 4px 16px rgba(0, 0, 0, 0.3),
                   0 0 12px var(--mci-color-primary-glow);
  --mci-shadow-lg: 0 8px 30px rgba(0, 0, 0, 0.35),
                   0 0 20px var(--mci-color-primary-glow);
  --mci-shadow-xl: 0 20px 60px rgba(0, 0, 0, 0.5),
                   0 0 40px var(--mci-color-primary-glow);

  /* 专用阴影 */
  --mci-shadow-card: 0 4px 20px rgba(0, 0, 0, 0.3),
                     0 0 15px rgba(114, 43, 255, 0.08);
  --mci-shadow-card-hover: 0 8px 30px rgba(0, 0, 0, 0.4),
                           0 0 25px rgba(114, 43, 255, 0.15),
                           0 0 60px rgba(114, 43, 255, 0.05);
  --mci-shadow-button: 0 4px 15px var(--mci-color-primary-glow);
  --mci-shadow-button-hover: 0 8px 25px var(--mci-color-primary-glow);
  --mci-shadow-dialog: 0 25px 80px rgba(0, 0, 0, 0.6),
                       0 0 50px rgba(114, 43, 255, 0.1);
  --mci-shadow-dropdown: 0 10px 40px rgba(0, 0, 0, 0.45),
                         0 0 20px rgba(114, 43, 255, 0.08);

  /* 强调发光 */
  --mci-glow-primary: 0 0 15px var(--mci-color-primary-glow),
                      0 0 45px rgba(114, 43, 255, 0.1);
  --mci-glow-red: 0 0 15px rgba(255, 46, 99, 0.3),
                  0 0 45px rgba(255, 46, 99, 0.1);
  --mci-glow-cyan: 0 0 15px rgba(0, 245, 212, 0.3),
                   0 0 45px rgba(0, 245, 212, 0.1);
}

/* 移动端阴影减半 — 移动端 GPU 较弱，且小屏幕不需要过强阴影 */
@media (max-width: 768px) {
  :root {
    --mci-shadow-card: 0 2px 12px rgba(0, 0, 0, 0.3),
                       0 0 8px rgba(114, 43, 255, 0.06);
    --mci-shadow-card-hover: 0 4px 18px rgba(0, 0, 0, 0.4),
                             0 0 12px rgba(114, 43, 255, 0.1);
    --mci-shadow-button: 0 2px 10px var(--mci-color-primary-glow);
    --mci-shadow-dialog: 0 12px 40px rgba(0, 0, 0, 0.6);
  }
}
```

### 阴影使用规则

| 场景 | 使用阴影 |
|------|---------|
| 卡片默认态 | `--mci-shadow-card` |
| 卡片悬浮态（PC） | `--mci-shadow-card-hover` |
| 按钮默认态 | `--mci-shadow-button` |
| 按钮按下态 | `--mci-shadow-button-hover`（移动端无 hover，只用按下/默认） |
| 弹窗/抽屉 | `--mci-shadow-dialog` |
| 下拉菜单 | `--mci-shadow-dropdown` |
| 强调元素 | `--mci-glow-*` |

---

<!-- /microi-progressive:chunk -->
