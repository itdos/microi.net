# 🧊 3D、CAD 与数据大屏

Microi吾码提供多条可视化路线。界面引擎、报表引擎、go-view 大屏、Three.js 3D 场景和 CAD 预览各有边界，不需要把所有需求都做成一套重型设计器。

## 能力选择

| 需求 | 推荐能力 | 数据来源 |
|---|---|---|
| 表单页中的指标、图表与布局 | [界面引擎](/doc/system-engine/page-engine) | 表单、数据源、接口引擎 |
| 常规统计表、ECharts 报表 | [报表引擎](/doc/system-engine/report-engine) | 模块、SQL/接口数据源 |
| 驾驶舱、监控大屏、自由拖拽图表 | go-view 数据大屏 | `mic_data_dashboard.ContentData` |
| 产品/设备模型、灯光、材质与镜头 | 3D 引擎 | `.glb` / `.gltf` 或场景 JSON |
| DWG、DXF、STEP/STP、STL 文件预览 | CAD 预览与 HDFS 转换 | 原文件与 `_preview` 转换文件 |

## go-view 数据大屏

源码位于 `Microi.Client/src/views/go-view/`，入口包括：

- `/mic/data-dashboard/design/:Id`：大屏设计；
- `/mic/data-dashboard/preview/:Id`：大屏预览。

集成版复用 Microi 的 Vue、Pinia 与鉴权上下文，不使用 go-view 原项目自己的登录和后端接口。项目名称保存在 `mic_data_dashboard.ProjectName`，设计 JSON 保存在 `ContentData`，其中包含画布、全局请求配置和组件列表。

保存或发布前应检查数据源权限、刷新频率、首屏资源体积、字体与图片跨域。大屏页面能打开，不代表每个图表的数据范围都符合当前用户权限。

## 3D 引擎

源码位于 `Microi.Client/src/views/3d-engine/`，包含设计器、渲染器、场景树、属性面板、材质、灯光、后处理、模型爆炸和相机路径。

- `/3d-engine/designer`：编辑场景；
- `/3d-engine/renderer`：运行时渲染，可从查询参数或配置读取模型。

当前公开设计器的上传控件接受 `.glb` 与 `.gltf`，加载器基于 `GLTFLoader` 并支持 Draco。场景配置可以保存模型位置、旋转、缩放、材质、灯光、环境、后处理和镜头路径。若业务需要 OBJ/FBX 等格式，应先确认当前分支是否已有对应 Loader，不要仅根据旧宣传文字判断已支持。

3D 页面应限制模型大小、贴图分辨率和同时加载数量；移动设备还需要测试 GPU 内存、弱网加载、页面离开后的资源释放与低性能降级。

## CAD 与工程文件预览

CAD 入口位于文件管理、上传控件和 `/mic/cad-preview`。当前链路按格式区分：

- DWG 在后端转换为 `_preview.dxf`，前端使用 DXF 预览；
- STEP/STP 通过可用的 FreeCAD/Python OCC 转换链生成 `_preview.stl`；
- STL 由 Three.js `STLLoader` 渲染；
- 已有 DXF/STL 可直接进入对应查看器。

后端转换实现在 `Microi.Server/Microi.HDFS/CadFileConverter.cs`。FreeCAD 是可选外部依赖；服务器没有可执行文件、权限不足或转换失败时，原文件仍可保留，但不能把“上传成功”报告成“CAD 预览成功”。

## 文件与租户边界

1. 原文件、转换文件与预览 URL 都必须绑定当前 OsClient、桶和对象路径。
2. 私有文件通过后端签名/代理能力获取，不把对象存储密钥交给前端。
3. 外部 MinIO 迁移先探测源/目标，再按相对路径复制并做对象回读。
4. 后台转换适合进入可恢复任务；多节点环境同时扫描时需要分布式租约与幂等键。
5. 文件上传 HTTP 200、任务记录成功、对象存在和浏览器真实渲染是四项不同证据。

## 验收清单

- 大屏：桌面与移动视口、全屏、刷新、数据源失败、长时间运行内存。
- 3D：本地文件与远程 URL、Draco 模型、材质/灯光、相机路径、页面退出释放。
- CAD：DWG→DXF、STEP/STP→STL、转换器缺失、中文文件名、大文件与私有 URL。
- 权限：普通角色不能通过直接路由或对象 URL 读取未授权数据/文件。
- 部署：两节点并发转换不重复写对象，节点中断后任务可恢复。
