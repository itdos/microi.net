# 文件柜

<div class="mci-file-manage-page" aria-hidden="true"></div>

<section class="file-cabinet-hero">
  <div class="file-cabinet-hero__copy">
    <p class="file-cabinet-eyebrow">MICROI FILE CABINET · OBJECT STORAGE WORKSPACE</p>
    <h2>把对象存储，变成人人看得懂的文件工作台</h2>
    <p>吾码文件柜将租户的私有桶、公有桶、目录、文件预览、回收站与跨平台同步集中到一个界面。管理员不需要直接登录 MinIO、OSS 或 S3 控制台，也能完成日常文件治理。</p>
    <div class="file-cabinet-hero__actions">
      <a href="#日常管理能力">查看管理能力</a>
      <a class="is-secondary" href="#跨平台文件同步">了解文件同步</a>
    </div>
    <div class="file-cabinet-chip-row" aria-label="文件柜核心能力">
      <span>私有 / 公有桶</span><span>多格式预览</span><span>逻辑回收站</span><span>同步审计</span>
    </div>
  </div>
  <div class="file-cabinet-window" aria-label="文件柜界面结构示意图">
    <div class="file-cabinet-window__bar">
      <i></i><i></i><i></i><strong>文件柜</strong><span>私有桶 ▾</span>
    </div>
    <div class="file-cabinet-window__body">
      <aside>
        <small>目录</small>
        <b class="is-active">▾ 项目资料</b>
        <b>　▸ 设计稿</b>
        <b>　▸ 合同</b>
        <b>▸ 媒体资源</b>
        <b>♲ 回收站</b>
      </aside>
      <main>
        <div class="file-cabinet-window__tools"><span>上传</span><span>新建文件夹</span><span>同步</span><em>搜索文件</em></div>
        <div class="file-cabinet-window__crumb">全部文件　/　项目资料</div>
        <div class="file-cabinet-window__files">
          <article><i>▰</i><strong>设计稿</strong><small>文件夹</small></article>
          <article><i class="is-pdf">PDF</i><strong>项目方案.pdf</strong><small>2.8 MB</small></article>
          <article><i class="is-image">IMG</i><strong>首页效果图.png</strong><small>1.4 MB</small></article>
          <article><i class="is-model">3D</i><strong>设备模型.step</strong><small>18 MB</small></article>
        </div>
      </main>
    </div>
  </div>
</section>

::: tip 入口与定位
登录吾码后台后，通过系统菜单进入 `/#/mci-file-manage`。源码内置组件路由为 `/#/file-manage`；实际项目应以管理员配置并授权的“文件柜”菜单为准。
:::

## 一分钟认识文件柜

<div class="file-cabinet-value-grid">
  <article><span>01</span><strong>看得见</strong><p>目录树、面包屑、网格 / 列表视图，让对象存储像桌面文件管理器一样直观。</p></article>
  <article><span>02</span><strong>管得住</strong><p>按租户区分公有桶和私有桶，上传、移动、重命名、回收与恢复都有明确边界。</p></article>
  <article><span>03</span><strong>预览快</strong><p>图片、PDF、音视频、文本代码和部分 CAD 文件可直接在线查看。</p></article>
  <article><span>04</span><strong>迁得动</strong><p>当前平台、远程吾码平台和 MinIO 之间可以按目录选择文件并保留同步记录。</p></article>
</div>

文件柜服务于**平台级文件治理**。普通业务用户上传的附件仍应通过表单、业务记录和字段权限访问，不应为了“方便找文件”而直接开放整个文件柜。

## 公有桶与私有桶怎么选

文件柜左侧可随时切换桶类型。两类桶目录彼此独立，同步时还可以分别选择源桶和目标桶。

| 对比项 | 私有桶 | 公有桶 |
|---|---|---|
| 典型内容 | 合同、证件、内部文档、业务附件 | 官网图片、公开下载包、前端静态资源 |
| 访问方式 | 通过后端鉴权和短时访问地址读取 | 可由公开地址或 CDN 直接读取 |
| 管理建议 | 默认选择；按业务记录继续做权限控制 | 仅放确认可以公开传播的内容 |
| 主要风险 | 临时地址被转发、业务权限设计不完整 | 一旦公开就不能依赖“路径难猜”保护内容 |

::: warning 公有桶不等于“已授权公开”
切换到公有桶只是改变存储访问范围，不会自动判断文件是否含个人信息、合同或商业秘密。敏感文件不要放入公有桶。
:::

## 日常管理能力

<div class="file-cabinet-feature-grid">
  <article>
    <span class="file-cabinet-feature-icon">⌘</span>
    <h3>目录导航</h3>
    <p>可调宽度目录树、懒加载展开、面包屑跳转和双击进入，深层目录也能快速定位。</p>
  </article>
  <article>
    <span class="file-cabinet-feature-icon">⇧</span>
    <h3>上传与建目录</h3>
    <p>支持多文件上传与逐项进度；可在当前路径新建文件夹，并校验非法目录名称。</p>
  </article>
  <article>
    <span class="file-cabinet-feature-icon">▦</span>
    <h3>网格 / 列表视图</h3>
    <p>两种视图一键切换。网格图标大小可调，图片缩略图可按需开启或关闭。</p>
  </article>
  <article>
    <span class="file-cabinet-feature-icon">⌕</span>
    <h3>搜索与排序</h3>
    <p>按文件名筛选；按名称、大小、类型、创建时间或更新时间升降序排列。</p>
  </article>
  <article>
    <span class="file-cabinet-feature-icon">✓</span>
    <h3>选择与批量操作</h3>
    <p>复选框和 Ctrl / Cmd 多选配合批量移动、删除、恢复，减少重复操作。</p>
  </article>
  <article>
    <span class="file-cabinet-feature-icon">⋯</span>
    <h3>快捷菜单</h3>
    <p>文件、文件夹和空白区域均有右键菜单；常用动作也会直接出现在列表工具栏。</p>
  </article>
</div>

### 文件与文件夹操作表

| 操作 | 文件 | 文件夹 | 批量 | 说明 |
|---|:---:|:---:|:---:|---|
| 上传 | ✓ | — | ✓ | 多文件上传到当前目录，随后显示进度和结果。 |
| 新建文件夹 | — | ✓ | — | 可从顶部工具栏、目录树或空白区域创建。 |
| 打开 / 预览 | ✓ | ✓ | — | 双击文件夹进入；双击可预览类型打开预览窗口。 |
| 下载 | ✓ | — | — | 私有文件先获取短时地址，再由浏览器下载。 |
| 重命名 | ✓ | ✓ | — | 保留所在目录，仅更新对象名称。 |
| 移动 | ✓ | ✓ | ✓ | 选择目标目录后移动，路径始终限制在当前租户范围。 |
| 属性 | ✓ | ✓ | — | 查看名称、类型、大小、创建时间和更新时间。 |
| 删除到回收站 | ✓ | ✓ | ✓ | 默认是逻辑删除，不立即物理移除源对象。 |
| 从回收站恢复 | ✓ | ✓ | ✓ | 回到删除前路径；可单条或批量恢复。 |

文件很多时，列表会分段加载，底部显示当前已加载数量与总量。刷新按钮会重新读取当前目录；目录树右键也可直接上传、新建、刷新或从该目录发起同步。

## 在线预览矩阵

<div class="file-cabinet-preview-grid">
  <article class="is-image"><span>IMAGE</span><strong>图片</strong><p><code>jpg</code>、<code>jpeg</code>、<code>png</code>、<code>gif</code>、<code>bmp</code>、<code>svg</code>、<code>webp</code>、<code>ico</code></p><small>适配容器显示，可放大查看并下载原文件。</small></article>
  <article class="is-doc"><span>PDF</span><strong>PDF 文档</strong><p><code>pdf</code></p><small>在文件柜弹窗内嵌浏览器 PDF 阅读器。</small></article>
  <article class="is-media"><span>MEDIA</span><strong>音视频</strong><p><code>mp4</code>、<code>webm</code>、<code>ogg</code>；<code>mp3</code>、<code>wav</code>、<code>flac</code>、<code>aac</code>、<code>m4a</code></p><small>使用浏览器原生播放控件，实际解码能力取决于浏览器。</small></article>
  <article class="is-code"><span>TEXT</span><strong>文本与代码</strong><p><code>txt</code>、<code>md</code>、<code>json</code>、<code>xml</code>、<code>csv</code>、<code>log</code>、配置与常见源码文件</p><small>只读显示文本内容，不会在预览中执行脚本。</small></article>
  <article class="is-cad"><span>CAD</span><strong>CAD / 3D</strong><p><code>dwg</code>、<code>step</code>、<code>stp</code></p><small>读取同目录转换得到的 DXF / STL 预览文件，支持缩放、重置、旋转 / 俯视和全屏。</small></article>
  <article class="is-other"><span>FILE</span><strong>其他格式</strong><p>DOCX、XLSX、PPTX、压缩包及未识别格式</p><small>显示文件信息并提供下载，不会伪装成已支持在线预览。</small></article>
</div>

::: info CAD 预览有前置条件
DWG 需要同名的 `_preview.dxf`，STEP / STP 需要同名的 `_preview.stl`。转换链路、格式限制和生产验收方法见 [3D、CAD 与数据大屏](/doc/system-engine/visualization-engine)。
:::

Office 在线编辑属于独立集成能力，不等同于文件柜的内置预览。需要 Word、Excel、PowerPoint 在线编辑时，请查看 [Office 在线编辑](/doc/more/office)。

## 回收站：给误操作留一次反悔机会

<div class="file-cabinet-flow" aria-label="文件从正常目录进入回收站再恢复的流程">
  <article><span>1</span><strong>选择对象</strong><small>单个文件、文件夹或批量选择</small></article>
  <i aria-hidden="true">→</i>
  <article><span>2</span><strong>删除到回收站</strong><small>记录原路径并从正常列表隐藏</small></article>
  <i aria-hidden="true">→</i>
  <article><span>3</span><strong>查看回收站</strong><small>集中核对已删除对象</small></article>
  <i aria-hidden="true">→</i>
  <article><span>4</span><strong>恢复</strong><small>单条或批量回到原路径</small></article>
</div>

当前文件柜的“删除”采用逻辑回收流程，目的是降低误删风险；它不等于存储服务上的立即物理删除。需要执行保留期、彻底清理或合规销毁时，应另行建立经授权、可审计的后台策略。

## 跨平台文件同步

文件柜内置同步工作台，可把选定文件或文件夹从一个存储端迁移到另一个存储端。源端和目标端都能独立选择公有桶或私有桶。

<div class="file-cabinet-sync-map" aria-label="文件同步支持的三类存储端">
  <article class="is-current"><span>当前平台</span><strong>本次登录的吾码租户</strong><small>复用当前 Token、OsClient 和 SaaS 存储配置</small></article>
  <i aria-hidden="true">⇄</i>
  <article class="is-remote"><span>远程吾码</span><strong>另一套吾码平台 / 租户</strong><small>输入 ApiBase、OsClient、帐号密码并完成动态登录</small></article>
  <i aria-hidden="true">⇄</i>
  <article class="is-minio"><span>MinIO 直连</span><strong>指定对象存储端点</strong><small>配置 Endpoint、AccessKey、SecretKey、桶和根路径</small></article>
</div>

### 组合兼容性

| 源端 → 目标端 | 是否支持 | 执行方式 |
|---|:---:|---|
| 当前平台 → 当前平台 | ✓ | 服务端对象同步，可跨公有 / 私有桶。 |
| 当前平台 ⇄ 远程吾码 | ✓ | 获取源文件短时地址，再上传到目标平台并落到目标目录。 |
| 当前平台 ⇄ MinIO 直连 | ✓ | 服务端 MinIO 同步；目标端可检查并创建缺失桶。 |
| MinIO 直连 → MinIO 直连 | ✓ | 服务端在受限根路径之间同步。 |
| 远程吾码 ⇄ MinIO 直连 | — | 当前不直接组合；请把吾码一侧改为“当前平台”后分步同步。 |

### 一次同步怎么完成

<ol class="file-cabinet-steps">
  <li><span>01</span><div><strong>选择源端与目标端</strong><p>分别确定平台类型、公有 / 私有桶和连接信息。</p></div></li>
  <li><span>02</span><div><strong>连接并加载目录树</strong><p>远程吾码先登录并检查同步能力；MinIO 先测试连接。</p></div></li>
  <li><span>03</span><div><strong>勾选源文件</strong><p>文件和文件夹均可选择；选择父文件夹后会自动去重其子项。</p></div></li>
  <li><span>04</span><div><strong>指定目标位置</strong><p>在目标树中明确落点，原有无关文件保持不变。</p></div></li>
  <li><span>05</span><div><strong>设置重名规则</strong><p>选择“重名忽略”或“文件重名覆盖”。</p></div></li>
  <li><span>06</span><div><strong>执行并核对记录</strong><p>逐项更新进度；完成、忽略、失败和待同步都有明细。</p></div></li>
</ol>

### 远程连接与 MinIO 连接

<div class="file-cabinet-connection-grid">
  <article>
    <p class="file-cabinet-eyebrow">REMOTE MICROI</p>
    <h3>远程吾码平台</h3>
    <ul>
      <li>自动读取远程登录配置，按需显示验证码并使用远端登录协议。</li>
      <li>登录后先检查 `mci_file_sync_capability`，旧端能力不足时会明确提示升级。</li>
      <li>支持选择、删除历史连接，也可主动退出当前远程登录。</li>
      <li>远程 Token 失效时会终止本次操作并要求重新登录。</li>
    </ul>
  </article>
  <article>
    <p class="file-cabinet-eyebrow">DIRECT MINIO</p>
    <h3>MinIO 直连</h3>
    <ul>
      <li>配置端点、访问帐号、SecretKey、可选 Region，以及公有 / 私有桶。</li>
      <li>根路径必填，用于约束本次可见与可同步的对象范围。</li>
      <li>连接测试通过后再加载文件树；目标端可创建缺失桶。</li>
      <li>访问凭据只用于当前会话，不写入同步任务记录。</li>
    </ul>
  </article>
</div>

超大目录会分页读取并设防护上限：单次树构建最多展示前 `10,000` 个节点，超过时界面会提示截断。大规模迁移建议按业务目录拆成多次任务，而不是一次勾选整个存储桶。

## 同步记录与审计

同步配置旁的“同步记录”页签保存最近任务，任务归属**发起同步的当前租户**，不散落到源端或目标端。

| 记录层级 | 可查看内容 |
|---|---|
| 任务摘要 | 任务编号、源 / 目标类型、平台地址与租户、源 / 目标桶范围、冲突规则、开始结束时间。 |
| 进度统计 | 总数、成功数、失败数、已完成数和整体进度。 |
| 文件明细 | 文件名、源路径、目标路径、大小、结果和错误消息。 |
| 状态 | 任务：同步中、已完成、失败；条目：成功、忽略、待同步、失败。 |

同步按文件逐项执行。即使部分文件失败，已完成项和失败原因仍会写入明细，方便重试前核对；任务记录写入失败时，同步流程也会中止，避免出现“文件已经迁移但平台没有审计记录”的静默状态。

## 权限与安全边界

<div class="file-cabinet-guard-grid">
  <article><span>ADMIN</span><strong>仅平台超级管理员</strong><p>当前内置文件管理与同步接口会校验租户 Token，并拒绝普通用户及访问密钥会话。</p></article>
  <article><span>TENANT</span><strong>路径按租户隔离</strong><p>目录、移动和同步路径限制在当前 OsClient 或显式 MinIO 根路径内，不能把任意服务器路径当作对象路径。</p></article>
  <article><span>URL</span><strong>私有地址短时有效</strong><p>预览、下载和跨平台同步先由后端签发短时地址，不把对象存储长期凭据交给浏览器。</p></article>
  <article><span>AUDIT</span><strong>任务与明细留痕</strong><p>同步任务、冲突规则、进度、单文件结果和错误消息保存在当前租户的任务记录中。</p></article>
</div>

更底层的存储后端、SaaS 配置、上传限制、私有文件 URL 与安全建议，请继续阅读 [分布式存储](/doc/more/hdfs)。

## 当前版本边界

::: warning 请按已实现能力验收
- 右键菜单中的“分享、复制、剪切”目前是预留交互入口，不应把提示消息当成已完成的权限分享或跨目录剪贴板能力。
- 文件柜不内置 DOCX、XLSX、PPTX 在线预览；这些格式默认下载，在线编辑走 Office 集成。
- 远程吾码与 MinIO 直连不能直接组合，需要以当前平台为中转分步执行。
- 树上限、网络带宽、浏览器内存、对象存储策略和目标平台版本都会影响一次同步规模。
:::

## 管理员使用清单

1. 确认当前租户已正确配置公有、私有存储及文件服务地址。
2. 仅向平台超级管理员开放文件柜菜单，不用它替代业务表单的附件权限。
3. 上传前先判断内容应进入私有桶还是公有桶。
4. 大批量删除先进入回收站核对；物理清理另走受控流程。
5. 跨平台同步先用少量文件验证登录、桶、根路径、目标目录和重名规则。
6. 同步结束后同时核对目标文件、任务汇总和失败明细，不能只看进度条。
