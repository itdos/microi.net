# 安装、升级与同步

适用范围：用户要安装、升级或卸载 CLI / skill，重新同步 skill，或查看宿主如何接入该技能。

**CRITICAL - 用户意图是安装、升级或同步时，先完成本域动作，不要跳到发布流程里“顺手再发一次”验证。**

## 标准安装流程

```bash
npm install -g @yixiaoermail/cli
yxer --version
yxer config init --api-key <apiKey>
yxer update
yxer doctor
```

如果是 SkillHub / skills 市场接入，建议先安装 `skills/yixiaoer-bootstrap`，由它负责：

```bash
npm install -g @yixiaoermail/cli@latest
yxer update --global
yxer config init --api-key <apiKey>
yxer doctor
```

## 升级流程

```bash
yxer update
yxer doctor
```

## 卸载流程

优先先卸载 skill，再卸载 CLI。

```bash
npx skills --help
npm uninstall -g @yixiaoermail/cli
```

如果需要彻底清理本地配置，可按需删除：

```text
%USERPROFILE%\.yxer\config.json
%USERPROFILE%\.yxer\skills.stamp
```

如果不确定 skill 安装位置，先执行：

```bash
yxer skill show
```

## 规则

- 安装 CLI 时优先使用 `npm install -g @yixiaoermail/cli`
- CLI 安装后优先使用 `yxer update`，让 CLI 升级检查与本地随包 skill 同步走同一条路径
- `yxer --version` 升级后，应提示重新同步 skill
- `SKILL.md` 或 `references/` 中影响 Agent 行为的文档更新后，应提示重新同步
- `yxer doctor` 返回 `_notice.skills` 时，优先执行 `yxer update`
- 用户明确说“只想同步 skill / 看安装方法”时，完成本域说明后直接停下
- 不要引导普通用户从源码构建或手动放置 `yxer.exe`；源码构建只用于研发、测试或 npm 成品包制作
