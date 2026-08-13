# ui-design 详细参考 4

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=ui-design-014 sha256=abc0a2e1f26a1cfbfa5d73399e09479b7b71314a727bec8b0bf4258a5a3733dc -->
## 组件风格速查

### 卡片（通用）

```scss
.mci-card {
  background: var(--mci-bg-card);
  border: 1px solid var(--mci-border-color);
  border-radius: var(--mci-radius-xl);
  padding: var(--mci-space-6);
  box-shadow: var(--mci-shadow-card);
}
```

### 渐变按钮（主要操作）

```scss
.mci-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--mci-space-2);
  min-height: var(--mci-touch-target);
  padding: 0 var(--mci-space-6);
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
  border: none;
  border-radius: var(--mci-radius-md);
  font-size: var(--mci-text-base);
  font-weight: var(--mci-font-semibold);
  cursor: pointer;
  box-shadow: var(--mci-shadow-button);
  transition: transform var(--mci-duration-fast) var(--mci-ease-out);

  &:active { transform: scale(0.97); }
  @media (hover: hover) {
    &:hover { transform: translateY(-2px); box-shadow: var(--mci-shadow-button-hover); }
  }

  &--outline {
    background: transparent;
    color: var(--mci-color-primary-light);
    border: 1.5px solid var(--mci-color-primary);
    box-shadow: none;
  }

  &--ghost {
    background: var(--mci-bg-card);
    color: var(--mci-text-primary);
    box-shadow: none;
  }
}
```

### 标签 / Badge

```scss
.mci-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--mci-radius-full);
  font-size: var(--mci-text-xs);
  font-weight: var(--mci-font-medium);

  &--hot {
    background: linear-gradient(135deg, rgba(255,46,99,0.15), rgba(255,110,199,0.15));
    color: var(--mci-color-accent-red);
    border: 1px solid rgba(255, 46, 99, 0.2);
  }
  &--new {
    background: linear-gradient(135deg, rgba(0,245,212,0.1), rgba(41,184,255,0.1));
    color: var(--mci-color-accent-cyan);
    border: 1px solid rgba(0, 245, 212, 0.2);
  }
  &--vip {
    background: var(--mci-gradient-gold);
    color: #1A1A2E;
    font-weight: var(--mci-font-bold);
  }
}
```

### 输入框

```scss
.mci-input {
  display: block;
  width: 100%;
  min-height: var(--mci-touch-target);
  background: var(--mci-bg-surface);
  border: 1px solid var(--mci-border-color);
  border-radius: var(--mci-radius-md);
  padding: 0 var(--mci-space-4);
  color: var(--mci-text-primary);
  font-size: var(--mci-text-base);
  transition: border-color var(--mci-duration-fast) var(--mci-ease-out),
              box-shadow var(--mci-duration-fast) var(--mci-ease-out);

  &:focus {
    border-color: var(--mci-color-primary);
    box-shadow: 0 0 0 3px var(--mci-color-primary-glow);
    outline: none;
  }
  &::placeholder { color: var(--mci-text-tertiary); }
}
```

### Element Plus 主题整合（PC）

```scss
:root {
  --el-color-primary: var(--mci-color-primary);
  --el-color-success: var(--mci-color-success);
  --el-color-warning: var(--mci-color-warning);
  --el-color-danger: var(--mci-color-danger);
  --el-color-info: var(--mci-color-info);

  --el-bg-color: var(--mci-bg-elevated);
  --el-bg-color-overlay: var(--mci-bg-surface);
  --el-text-color-primary: var(--mci-text-primary);
  --el-text-color-regular: var(--mci-text-secondary);
  --el-text-color-secondary: var(--mci-text-tertiary);
  --el-text-color-placeholder: var(--mci-text-disabled);

  --el-border-color: var(--mci-border-color);
  --el-border-color-light: var(--mci-border-color);
  --el-border-color-lighter: var(--mci-border-color);
  --el-border-radius-base: var(--mci-radius-md);

  --el-box-shadow: var(--mci-shadow-md);
  --el-box-shadow-light: var(--mci-shadow-sm);
  --el-font-family: var(--mci-font-family);
}

.el-dialog {
  border-radius: var(--mci-radius-2xl) !important;
  background: var(--mci-bg-elevated) !important;
  box-shadow: var(--mci-shadow-dialog) !important;
  border: 1px solid var(--mci-border-color) !important;
  overflow: hidden;
}
```

---

<!-- /microi-progressive:chunk -->
