---
title: AI 创作中心
description: Microi吾码 AI 图片、视频、声音与音乐创作培训，覆盖 29 项图像生成、AI 编辑、人像商品和精确处理能力。
outline: [2, 3]
pageClass: mci-ai-creative-studio-page
---

<div class="mci-ai-capability-doc-page mci-ai-creative-studio-doc-page" aria-hidden="true"></div>

<section class="mci-ai-capability-hero is-creative">
  <div>
    <p class="mci-ai-capability-eyebrow">AI CREATION SPACE · IMAGE · VIDEO · MUSIC</p>
    <h1>从一个想法，<br><em>开始完整创作</em></h1>
    <p class="mci-ai-capability-lead">描述目标、上传参考图片或文件，就能在同一工作台完成 AI 图片与视频视觉创作、声音与音乐创作，以及生成结果的预览、下载和 HDFS 归档。</p>
    <nav class="mci-ai-capability-actions" aria-label="AI 创作中心页面导航">
      <a class="is-primary" href="#29-项图像创作与处理能力">查看 29 项图像能力</a>
      <a href="#ai-视频视觉创作">查看 AI 视频</a>
      <a href="#声音与音乐创作">查看声音与音乐</a>
    </nav>
  </div>
  <div class="mci-ai-capability-signal" aria-label="AI 创作中心能力链">
    <span>IDEA</span><i></i><span>CREATE</span><i></i><span>EDIT</span><i></i><span>DELIVER</span>
    <strong>视觉、声音、视频一站协作</strong>
    <small>Reference · Generate · Preview · HDFS</small>
  </div>
</section>

<section class="mci-ai-capability-metrics" aria-label="AI 创作中心四类能力">
  <article><span>01</span><b>AI 图片</b><p>文生图、图生图、重绘、扩图、人像与商品素材。</p></article>
  <article><span>02</span><b>AI 视频</b><p>文生视频、图生视频、首尾帧与异步任务结果归档。</p></article>
  <article><span>03</span><b>声音 / 音乐</b><p>描述氛围与用途，生成纯音乐并在原页试听、下载。</p></article>
  <article><span>04</span><b>精确处理</b><p>缩放、裁剪、旋转、翻转、格式转换与拼图不走生成模型。</p></article>
</section>

## 创作工作台原图

<figure class="mci-ai-creative-overview">
  <a href="/images/ai-creative-studio/capability-overview.png" data-fancybox="ai-creative-studio-original" aria-label="查看 AI 创作空间完整原图">
    <img src="/images/ai-creative-studio/capability-overview.png" width="1905" height="1233" alt="Microi吾码 AI 创作空间及 29 项图像工具总览" />
  </a>
  <figcaption>AI 创作空间原图：AI 对话、数据分析、AI 图片、AI 视频、AI 音乐与模型扩展共同组成统一入口。</figcaption>
</figure>

工作台按“选择能力 → 填写必要参数 → 预览结果”组织操作。图片页采用工具、参数、结果三栏结构；手机端依次折叠，避免把 29 项能力藏在多层菜单里。

图片生成采用后台任务。任务提交后可以离开页面；在同一浏览器标签页返回图像工作台时，会继续读取当前账号的任务结果。生成完成后，原图先保存到当前租户 HDFS，再展示预览和下载入口。网络短暂中断时会查询同一任务，同一任务的重复提交不会再生成一份。

### 图片任务接口与升级要求

`POST /api/Ai/GenerateMiniMaxImage` 接收稳定的 `RequestId`，快速返回 `Code=2` 和 `Data.TaskId`。随后通过 `GET /api/Ai/GetMiniMaxImageTask?taskId=...` 查询，`Code=1` 且包含 `Images` 才表示图片已保存。相同 `RequestId` 改变提示词或参数会返回冲突；接口不把请求超时、HTTP 524 或 `Uncertain` 当作关键词违规，也不会据此判断 Token Plan 扣费。

配置吾码图片中转站时，节点之间通过 `/v1/microi/image_tasks` 提交和查询持久任务。供应商密钥由服务端保存，查询不再占用生成额度。若供应商明确拒绝，结果保留实际错误码和消息，便于区分参数、鉴权和网络问题。

升级时需要同时更新 **平台后端 v8.1.11 或更高版本**（Microi.Core、Microi.AI 与 API）、平台前端，以及应用商城 **AI助手 v7.6.9 或更高版本**；自建中转的接收节点也需更新。仅安装应用包不会替换运行中的平台程序。图片任务使用平台既有后台任务存储与 Redis，转发等待与真实供应商执行分开调度，不新增租户可编辑的同名 Worker 接口引擎。

参考图先写入当前租户私有 HDFS，再以经过校验的原图字节传给 MiniMax，避免供应商二次访问私有短效链接。参考图请求关闭提示词自动扩写。`image-01` 只接受一张人物参考图；消除、扩图、上色、修复、商品图与多图合成等操作必须选择图像编辑模型。前端按操作过滤模型，后端在调用供应商之前再次验证，缺少编辑模型时给出配置提示，不能把一张重绘结果当作编辑成功。

媒体运行时以真实用户身份执行上传开关、文件校验与配额检查；参考图片进入固定私有目录，生成结果进入固定公有媒体目录。目录授权仅由可信后端创建，普通上传请求无法通过填写相同目录或复制参数获得该授权。

### 从 AI 引擎选择媒体模型

图片、音乐与视频工作台，以及对话设置中的绘图、配乐选项，都从当前租户 `mic_ai` 读取媒体目录。`AiModelId` 指定引擎记录，`Model` 指定实际媒体模型；例如 M3 是聊天模型，图片生成应选择 `image-01` 等图片模型。明确选择的记录不可用时不会自动调用另一条账号。

在 AI 模型管理的“高级配置”中，`MediaProtocol` 设置默认协议，`MediaModels` 使用 JSON 数组配置实际模型：

```json
[{ "Id": "image-01", "Name": "图片生成", "Capability": "image", "Protocol": "minimax-image" }]
```

`Capability` 支持 `image/music/video/speech`。MiniMax 图片、音乐、视频、配音与 GPT Image 兼容图片协议分别由后端适配器处理；新增模型可复用已实现的协议，新供应商协议需要对应后端适配器，不能仅修改模型名称冒充接入。中转站通过 `/v1/microi/media_models` 公布安全目录，登录用户通过 `/api/Ai/GetMediaModels` 获取当前租户可选项；两个目录均不返回供应商密钥。

MiniMax 人物参考重绘适合创意再生成，可能改变原图构图和局部细节；GPT Image 兼容编辑使用图片编辑协议。生成式工具仍须检查实际输出，不能仅以请求成功判定精准消除或主体保持成功。加载面板显示预览扫描、真实等待时间和队列状态，并适配窄屏与减少动态效果设置。

### MiniMax Code 图像编辑连接

MiniMax Code 中的 M3 可以调用图像工具完成消除。该工具是 `connector__matrix__generate_image`，通过 `input_urls` 接收原图，与开放平台 `image-01` 的人物参考接口不同。供应商没有在此工具协议中公开底层图片模型名称，吾码以 `minimax-code-image` 标识这条工具路由。

在 AI 引擎新增独立记录，默认媒体协议选择 `minimax-connector-image`，Endpoint 填写 `https://agent.minimaxi.com`（国内）或 `https://agent.minimax.io`，媒体目录配置为：

```json
[{ "Id": "minimax-code-image", "Name": "MiniMax Code 图像编辑", "Capability": "image", "Protocol": "minimax-connector-image" }]
```

管理员在图片模型选择区域点击“连接账户”，打开 MiniMax 官方页面并确认授权码。Token Plan API Key 不能替代该 OAuth 授权。独立连接不会与桌面客户端共用刷新凭据；后端将凭据加密保存到该引擎的 ApiKey，自动续期时使用共享锁和条件更新。运维导入只接受独立授权，不接收桌面 `electron` 登录态。调用生成仍需满足吾码中转鉴权、当前用户额度和文件存储权限。

此协议支持 `1K / 2K / 4K` 分辨率与 `1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 21:9` 比例。服务端上传原图后调用生成工具，先持久保存返回的文件节点，再兑换下载地址并写入当前租户 HDFS。图片下载失败时保留节点用于恢复，不自动再次生图。生成式编辑可能改变姿势、构图或局部细节，仍应根据实际目标检查输出。

失败任务若返回 `CanRecoverResult=true`，页面显示“恢复原图”。调用 `POST /api/Ai/RecoverMiniMaxImageTask?taskId=...`，或中转协议的 `POST /v1/microi/image_tasks/{taskId}/recover`，会恢复原 TaskId。服务端重新核对所有者、冻结参数及共享文件节点，恢复 Worker 只取已有结果；节点不存在时拒绝恢复。文件下载支持最大 64 MiB，仍受租户 HDFS 限额约束。任务跨过授权有效期时，后续工具请求会回读或续期 OAuth；只有明确 401 会刷新后重试一次，生成超时不会自动重发。

AI 抠图使用专门的纯色抠像背景，再进行边缘连通区域透明化，避免把白色衣服按白背景一起清除。这仍是生成式主体隔离，精细发丝、主体同色区域及封闭空隙需检查实际 PNG；供应商生成标识不等于可以任意移除的装饰文字。

配置行和应用字段不会自动更新运行中的中转程序。使用该连接需要运行包含 Connector 适配器的前后端；原版 v8.1.11 的图片后台任务能力并不包含此后新增的 Connector 适配器。图片、音乐、视频和配音可分别选择不同引擎与模型；新供应商使用已有兼容协议时配置目录即可，新的协议仍需添加服务端适配器。

## 29 项图像创作与处理能力

这 29 项入口与产品当前工具目录保持一致。生成式能力负责理解意图与重构画面，精确处理则由服务端图像原子按确定规则执行，两者不能混为一谈。

<section class="mci-ai-creative-tool-groups" aria-label="29 项 AI 图像工具">
  <article>
    <header><span>CREATE · 4</span><h3>创意生成</h3></header>
    <ul>
      <li><b>文生图</b><small>用文字生成完整画面</small></li>
      <li><b>草图成图</b><small>把线稿和构图变成成品</small></li>
      <li><b>海报设计</b><small>生成营销主视觉方向</small></li>
      <li><b>Logo 灵感</b><small>快速探索品牌方向稿</small></li>
    </ul>
  </article>
  <article>
    <header><span>AI EDIT · 11</span><h3>AI 编辑</h3></header>
    <ul>
      <li><b>图生图</b><small>根据参考图继续创作</small></li>
      <li><b>AI 重绘</b><small>重做风格、质感与细节</small></li>
      <li><b>AI 高清放大</b><small>智能补充画面细节</small></li>
      <li><b>AI 消除</b><small>移除指定对象并补全背景</small></li>
      <li><b>AI 扩图</b><small>向外补全画面边界</small></li>
      <li><b>AI 去水印</b><small>仅处理有权使用的素材</small></li>
      <li><b>AI 换背景</b><small>让主体自然融入新场景</small></li>
      <li><b>风格迁移</b><small>转换画面的艺术风格</small></li>
      <li><b>黑白上色</b><small>为旧照片自然着色</small></li>
      <li><b>老照片修复</b><small>补损、降噪并改善清晰度</small></li>
      <li><b>AI 抠图</b><small>理解复杂背景并透明化</small></li>
    </ul>
  </article>
  <article>
    <header><span>PORTRAIT · 6</span><h3>人像商品</h3></header>
    <ul>
      <li><b>AI 证件照</b><small>生成规范人像与底色</small></li>
      <li><b>人像精修</b><small>改善自然肤质与光线</small></li>
      <li><b>AI 头像</b><small>探索多风格个人头像</small></li>
      <li><b>商品场景图</b><small>生成商业布景与氛围</small></li>
      <li><b>多图合成</b><small>将多个主体融入统一画面</small></li>
      <li><b>AI 布光</b><small>重新设计光线和氛围</small></li>
    </ul>
  </article>
  <article>
    <header><span>EXACT · 8</span><h3>精确处理</h3></header>
    <ul>
      <li><b>精确放大</b><small>不重绘，只改变尺寸</small></li>
      <li><b>彩色转黑白</b><small>按强度转换灰度</small></li>
      <li><b>纯色背景抠图</b><small>快速输出透明 PNG</small></li>
      <li><b>居中裁剪</b><small>按目标比例安全裁切</small></li>
      <li><b>旋转图片</b><small>旋转并自动扩展画布</small></li>
      <li><b>镜像翻转</b><small>水平或垂直翻转</small></li>
      <li><b>格式转换</b><small>PNG、JPEG 与 WebP 转换</small></li>
      <li><b>多图拼接</b><small>宫格、横向与纵向拼图</small></li>
    </ul>
  </article>
</section>

::: warning 生成式编辑与精确处理的边界
AI 消除、AI 扩图、AI 去水印、AI 抠图等当前采用“参考图 + 提示词”重新生成画面，并非逐像素蒙版修复。必须保持尺寸、位置或像素规则确定时，应选择标记为“精确”的处理工具。AI 去水印只能用于企业自有或已获授权素材。
:::

## AI 视频视觉创作

AI 视频通过受控的异步任务链完成：创建任务、查询状态、下载供应商临时结果，再转存到当前租户 HDFS。浏览器只获得绑定当前用户的安全句柄，不直接接触供应商密钥、原始任务 Id 或临时下载地址。

| 创作方式 | 适合场景 | 当前训练重点 |
|---|---|---|
| 文生视频 | 从脚本、镜头说明或产品创意直接生成短片 | 提示词要写清主体、动作、镜头、光线与场景连续性 |
| 图生视频 | 让已经确认的人物、商品或首帧开始运动 | 首帧必须经过检查，避免人物与品牌资产漂移 |
| 首尾帧 | 明确镜头开始与结束状态 | 关注转场合理性、时长、分辨率和供应商模型边界 |
| 连续内容 | 多段视频组成同一故事或产品演示 | 人物设定、服装、场景、音轨和字幕要单独做一致性验收 |

生成成功只代表媒体文件可取，不代表内容、版权、人物一致性、字幕、音轨或发布平台审核已经通过。正式交付仍需逐段预览并保存最终母版。

## 声音与音乐创作

当前工作台已经提供 AI 音乐入口：用文字描述情绪、节奏、配器和用途，生成纯音乐，在原页面试听并下载。托管模型与开源回退的格式可能不同，但成功结果都会校验后写入当前租户公有 HDFS。

音乐提交后在后台执行。可以停止等待或刷新页面，再回到音乐工作台继续查询原任务；这不会重新生成。遇到可恢复的文件读取中断时，使用“恢复原配乐结果”。若供应商明确拒绝或没有可查询的原回执，工作台会保留错误原因，避免一直等待或重复消耗额度。此功能需要同步升级平台前后端和所使用的吾码中转节点。

<div class="mci-doc-grid">
  <article class="mci-doc-card"><h3>灵感描述</h3><p>例如“轻快、克制、适合产品演示的科技感纯音乐”，而不是只写一个模糊风格词。</p></article>
  <article class="mci-doc-card"><h3>试听筛选</h3><p>生成后使用原生播放器核对真实时长、开头结尾、节奏和情绪，再决定是否下载。</p></article>
  <article class="mci-doc-card"><h3>业务归档</h3><p>结果进入租户 HDFS，以稳定文件地址供微服务、文章、视频或其它业务流程继续使用。</p></article>
</div>

::: info 声音能力现状
“声音创作”当前公开工作台的可用入口是纯音乐生成与试听。旁白、对白、语音克隆或完整歌曲人声不能只凭模型文案宣称已经交付；接入后也应单独说明授权、声音权利与真实音轨验收。
:::

## 一次完整创作如何交付

<section class="mci-ai-capability-flow is-creative" aria-label="AI 创作交付流程">
  <article><span>01</span><h3>确定用途</h3><p>先明确海报、商品图、短视频、配乐或多端素材的目标尺寸与受众。</p></article>
  <article><span>02</span><h3>准备参考</h3><p>上传已检查、可授权使用的图片或文件，必要时固定人物与品牌设定。</p></article>
  <article><span>03</span><h3>选择能力</h3><p>判断应走生成模型、AI 编辑，还是确定性的精确图像处理。</p></article>
  <article><span>04</span><h3>生成与预览</h3><p>使用稳定 RequestId，等待真实媒体结果并在原页面查看或试听。</p></article>
  <article><span>05</span><h3>检查边界</h3><p>核对内容安全、版权、人物一致性、画质、声音与文件元数据。</p></article>
  <article><span>06</span><h3>归档与复用</h3><p>把通过验收的结果写入 HDFS，再交给业务页面或发布流程。</p></article>
</section>

## 独立培训建议

一节 45～60 分钟的 AI 创作培训可以现场完成四组练习：

1. 从一段产品描述生成横版主视觉，比较两种提示词的差异。
2. 上传参考图，依次演示图生图、AI 重绘、扩图、换背景与授权素材去水印。
3. 用同一素材演示精确裁剪、旋转、格式转换和多图拼接，说明“不重绘”的价值。
4. 创建一段图生视频和一段纯音乐，检查异步状态、原页预览、下载与 HDFS 归档。

模型路由、图片/音乐接口、视频任务句柄、幂等和安全参数以 [AI 引擎与 Microi.AI 中转站](./ai-engine) 为技术事实源；经营数据相关课程请进入 [AI 数据分析](./ai-data-analysis)。
