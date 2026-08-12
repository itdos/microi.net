# 既有 Unity 工具箱提取

## 先建立清单

按目录和程序集记录：

- Runtime 通用脚本；
- Editor 菜单、导入器和构建工具；
- WebGL `.jslib`、模板和 JavaScript；
- 相机、路径、触发区、设备协议与客户业务脚本；
- Prefab、模型、动作、材质、贴图、字体、音频；
- 第三方 Package 与其许可证。

同时记录 Unity 版本、渲染管线、API Compatibility Level、Scripting Backend、目标平台和程序集依赖图。

## 分类规则

| 类型 | 去向 |
|---|---|
| 与业务无关的 API 客户端、宿主桥、构建基础能力 | `Microi.Unity/Runtime` 或 `Editor` |
| 可展示的最小使用方式 | `Microi.Unity/Samples~` |
| 场景、客户模型、设备字段、项目配置 | 原项目或独立业务项目 |
| 来源不明或限制再分发的素材 | 不进入公共包；替换或取得授权 |
| 只为旧项目兼容的适配代码 | 原项目 Adapter，不污染公共 API |

## 安全迁移顺序

1. 只读盘点并记录基线；不先移动文件。
2. 复制候选公共代码到 UPM，移除业务命名和硬编码配置。
3. 建 asmdef，限制 Runtime/Editor 引用方向。
4. 在独立 Sample 编译并运行最小场景。
5. 让旧项目通过 `Packages/manifest.json` 引用新 UPM。
6. 替换旧项目调用并执行 Editor、目标平台和 WebGL 回归。
7. 比较导出接口、序列化字段、Prefab GUID 和运行行为。
8. 只有用户明确要求且回归通过，才考虑删除旧副本；否则保留来源并标注镜像关系。

## 兼容性注意

- 移动脚本可能改变 `.meta` GUID，导致 Prefab/Scene 引用丢失；公共提取优先新 API + Adapter，不直接搬走序列化脚本。
- Editor-only 命名空间必须放 Editor asmdef 或 `#if UNITY_EDITOR`。
- WebGL 不支持所有线程、Socket、反射和文件系统用法；公共 API 要明确平台条件。
- Unity 内置 JSON 对字典、多态和顶层数组有限制，不能在提取时默默改变协议。
- 不把客户服务器地址、OsClient、Token、设备密钥或私有证书写入 Sample。

## 提取验收

- UPM `package.json` 可解析，Runtime/Editor asmdef 引用无环。
- Sample 编译与 Play 通过。
- 原项目改用 UPM 后功能等价。
- WebGL 插件实际链接，无 `EntryPointNotFound`。
- 公共包扫描不含客户品牌、秘密、本机路径与未授权二进制素材。
- README 说明支持版本、安装、最小示例、平台限制和升级策略。

## 当前官方包已提取能力

`Microi.Unity` 已从既有数字孪生项目重构以下公共能力：

- WebGL 宿主事件桥、V8/DiyToken 客户端和构建入口；
- 相机点按层级路径导入导出，导入支持 Undo；
- 选中根节点范围内的 Mesh 合并，使用精确 Renderer 引用恢复；
- 选中资源目录范围内的贴图优化，执行前保存完整 importer JSON；
- 场景结构统计、Camera 深度精度诊断和选中 Camera 的 Undo 调整；
- Balanced / High Definition WebGL 质量预设和 JSON 恢复；
- 选中层级内多余 `CameraPoint_` Camera 组件的安全清理。

旧项目的镜头路径、位置触发区、设备字段和业务 GameManager 仍属于项目 Adapter，不进入公共包。不要把这类保留项误报为“遗漏”；只有出现两个以上无业务字段的复用项目时，再抽取新的 Runtime 模块。
