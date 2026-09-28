# 🧊 3D、CAD 与数据大屏

Microi吾码提供多条可视化路线。界面引擎、报表引擎、go-view 大屏、Three.js 3D 场景和 CAD 预览各有边界，不需要把所有需求都做成一套重型设计器。

## 📸 预览图

<div class="mci-doc-screenshot-grid mci-doc-screenshot-grid--single">
  <figure>
    <img src="/images/product-screenshots/visualization-engine-unity-dashboard.jpg" alt="Microi吾码数据大屏设计器，展示可视化组件库、图层、Unity 3D 场景和属性配置" data-fancybox="visualization-engine-preview">
    <figcaption>数据大屏设计器：将图表、图片、数据组件与 Unity WebGL 场景组合到同一块可视化画布。</figcaption>
  </figure>
</div>

## 能力选择

| 需求 | 推荐能力 | 数据来源 |
|---|---|---|
| 表单页中的指标、图表与布局 | [界面引擎](/doc/system-engine/page-engine) | 表单、数据源、接口引擎 |
| 常规统计表、ECharts 报表 | [报表引擎](/doc/system-engine/report-engine) | 模块、SQL/接口数据源 |
| 驾驶舱、监控大屏、自由拖拽图表 | go-view 数据大屏 | `mic_data_dashboard.ContentData` |
| 产品/设备模型、灯光、材质与镜头 | 3D 引擎 | `.glb` / `.gltf` 或场景 JSON |
| 可操控游戏、沉浸展厅、复杂数字孪生 | [Unity WebGL](/doc/system-engine/unity-integration) | Unity 场景 + V8 接口引擎 |
| DWG、DXF、STEP/STP、STL 文件预览 | CAD 预览与 HDFS 转换 | 原文件与 `_preview` 转换文件 |

## go-view 数据大屏

源码位于 `Microi.Client/src/views/go-view/`，入口包括：

- `/mic/data-dashboard/design/:Id`：大屏设计；
- `/mic/data-dashboard/preview/:Id`：大屏预览。

集成版复用 Microi 的 Vue、Pinia 与鉴权上下文，不使用 go-view 原项目自己的登录和后端接口。项目名称保存在 `mic_data_dashboard.ProjectName`，设计 JSON 保存在 `ContentData`，其中包含画布、全局请求配置和组件列表。

保存或发布前应检查数据源权限、刷新频率、首屏资源体积、字体与图片跨域。大屏页面能打开，不代表每个图表的数据范围都符合当前用户权限。

## 3D 引擎

通用 3D 引擎由官方 `Platform` 应用 `app.microi.3d-engine` 拥有，并内含独立微服务 `microi-3d-engine`。它包含设计器、渲染器、场景树、属性面板、材质、灯光、后处理、模型爆炸和相机路径；源码与编译产物分别进入私有源码区和不可变运行资产。批量“安装/更新全部平台应用”只选择 `Platform` 包，因而安装的是通用引擎，不会附带某个客户的楼宇模型或演示数据。

通用微服务运行版本为 `v1.9.0`，官方平台包装应用版本为 `v1.1.2`。安装后的“3D引擎”设计器通过统一宿主页打开 `/micro-app/microi-3d-engine/designer`；独立入口 `https://api.itdos.com/micro-app/v3/tenants/itdos/kinds/runtime/apps/microi-3d-engine/assets/index.html` 默认进入设计器，需登录使用。渲染页 `/renderer` 是内部路由，由设计器或业务页面传入配置后复用。历史 `v1.8.1` 及更早版本曾将城市摩尔项目错误混入该微服务与商城包；更新到拆分后的版本时，不应再从通用引擎取得城市摩尔页面。旧版本应用安装到目标租户后，平台包升级不会自动删除该租户原有的城市摩尔业务表、数据或旧菜单；须另做目标租户库存盘点及用户授权的数据迁移/清理。

版本库中的 `Microi.Client/src/views/3d-engine/` 保留 Three.js 实现与回归测试来源；线上运行和跨租户安装以 AI 应用的私有源码、v3 committed runtime 与商城不可变安装快照为准。

当前公开设计器的上传控件接受 `.glb` 与 `.gltf`，加载器基于 `GLTFLoader` 并支持 Draco。场景配置可以保存模型位置、旋转、缩放、材质、灯光、环境、后处理和镜头路径。若业务需要 OBJ/FBX 等格式，应先确认当前分支是否已有对应 Loader，不要仅根据旧宣传文字判断已支持。

### 3D 数字孪生 · 城市摩尔示范

“3D 数字孪生 · 城市摩尔”现由独立 `MicroService` AI 应用 `microi-ningbo-city-mall` 承载，菜单 `/micro-app/microi-ningbo-city-mall/digital-twin`，免登录公开入口为 `https://api.itdos.com/micro-app/v3/tenants/itdos/kinds/runtime/apps/microi-ningbo-city-mall/assets/index.html`。它**不是**通用引擎的子页面，也不随“全部更新平台应用”安装；需要在应用商城单独安装。`/digital-twin` 使用 Three.js 程序化场景重建红褐色公寓高楼、连续低层商业街与中央拱门，场景包含蓝天白云、道路、树木、32 名循环步态行人和 7 辆双向循环的曲面车体。造型参考用户提供的多角度照片与现场沙盘照片，另附 AI 生成的概念参考图；它是可交互的演示模型，不是实测 BIM/CAD、汽车厂商数字样车或精确施工图复刻。

此类浏览器内楼层/住户点选采用 Three.js：可直接嵌入 MicroService，且能与吾码菜单、主题和接口引擎共用宿主能力。Blender 可用于日后制作替换用的 GLB 美术资产；当前演示不依赖 Unity WebGL 或外部 BIM 文件。

页面可从整栋进入楼层，再选中楼层内住户或商铺；三维空间气泡、右侧设备列表和运行指标同步更新。每层至少 20 户公寓；重复点击同一楼层或空间不重建整个场景。浅色及深色宿主主题的楼层、工具栏、图例和聊天输入保持可读，窄视口可纵向滚动。建筑空间智能体“小吾”提供文字问答，不提供方言语音服务。

整栋视图的车流、车轮与行人步态默认循环播放，包括系统或浏览器开启“减少动态效果”时；该设置只抑制装饰性过渡，不隐式关闭演示所需的动态街景。需要静止画面时点击场景工具栏“暂停”，或按 `P`；再次点击“播放”或按 `P` 恢复。页面隐藏、切换楼层及返回整栋时会冻结并校正动画时钟，避免恢复后车辆或行人瞬移。

独立项目 `v1.1.0` 增加有厚度的半透明三维 IoT 标牌、边缘高光、空间锚点和连线；标牌保留键盘可操作的 DOM 命中区及读屏文本，窄屏分栏避让。通过“街景”按钮或 `G` 键近看车辆的轮拱、弧面玻璃、座舱和轮毂，以及人物的服饰、肘膝关节与落脚步态。人物使用共享几何的 GPU 实例化降低绘制开销，近景与整栋切换不重建车流。新增模型由免费 Three.js 自制，属于更细化的原创演示资产，不是品牌厂商精确样车或照片扫描人物。普通和减少动态效果两种浏览器设置均须做时间序列回归，不能只凭截图宣称动画正常。

独立项目 `v1.2.0` 将近景 28 棵交叉照片贴片树替换为共享几何的真实 GLB 树，并按实际周长修正远景树带贴图比例，避免山/树林被横向拉伸。树木来自 Poly Haven 的 [Tree Small 02](https://polyhaven.com/a/tree_small_02)（[CC0 许可](https://polyhaven.com/license)），经 glTF-Transform 简化并转 WebP 后约 3.68 MB；原始资产和处理工具不进入公开运行包。树木失载有本地几何降级，首次加载、街景、移动端及切换楼层后返回整栋均需在真实浏览器验证。本次并未让户内 2.5D 材质变为完整可漫游室内，也未获得概念图相似度的美术签收。

楼栋、楼层、空间、设备及问答记录分别保存在 `mci_twin_building`、`mci_twin_floor`、`mci_twin_space`、`mci_twin_device`、`mci_twin_query_log`；`mci_twin_bootstrap` 与 `mci_twin_ask` 接口引擎允许匿名读取/问答，匿名问答不写日志。独立城市摩尔应用 `v1.3.0` 安装包含前四张表的 828 条演示种子记录（1 栋、12 层、280 个空间、535 台设备），问答日志不作为种子。这些业务资源只属于城市摩尔包，不属于 `app.microi.3d-engine`。商业街东西短侧墙避免照片立面与墙体共面造成 z-fighting：外露侧墙保留独立纹理面并拉开深度，内部相交的侧面不另画；多视角视觉回归不能只看正面。天空改用真正 2:1 经纬球的 [Rustig Koppie Pure Sky](https://polyhaven.com/a/rustig_koppie_puresky)（[Poly Haven CC0](https://polyhaven.com/license)），正面及两侧观察确认蓝天、自然云层与远景树带相接，避免普通横图的拼缝、摄影树冠或草地被投到天空。设备运行值与用能值为模拟数据，不代表实时 BMS/IoT 接入。当前混合实模与原创园区资产可演示交互，但尚未达到概念图 90%–95% 的商业级视觉相似度。

需要 Unity 物理、角色控制、复杂交互或现有 Unity 工程时，使用独立的 [Unity 3D 与 WebGL 集成](/doc/system-engine/unity-integration)。Unity 客户端通过 UPM SDK 与宿主桥接，业务通讯继续进入 V8 接口引擎，不需要为每个项目新增专用 Server Controller。

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
   上传字段的派生预览必须使用 `FormFieldDerivedPreview` 权威上下文：服务端先确认业务字段精确引用原 DWG/STEP/STP，再按转换器同源规则重算同目录 `_preview.dxf/_preview.stl` 并确认对象存在；任意后缀、跨目录或只传派生路径都会失败关闭。
3. 外部 MinIO 迁移先探测源/目标，再按相对路径复制并做对象回读。
4. 后台转换适合进入可恢复任务；多节点环境同时扫描时需要分布式租约与幂等键。
5. 文件上传 HTTP 200、任务记录成功、对象存在和浏览器真实渲染是四项不同证据。

## 验收清单

- 大屏：桌面与移动视口、全屏、刷新、数据源失败、长时间运行内存。
- 3D：本地文件与远程 URL、Draco 模型、材质/灯光、相机路径、页面退出释放。
- CAD：DWG→DXF、STEP/STP→STL、转换器缺失、中文文件名、大文件与私有 URL。
- 权限：普通角色不能通过直接路由或对象 URL 读取未授权数据/文件。
- 部署：两节点并发转换不重复写对象，节点中断后任务可恢复。
