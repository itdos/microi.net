---
title: 自建数字人直播与 AI 换脸
description: Microi吾码自建数字人直播、照片人物与服装动作、视频换脸、本机部署、4K截图和OBS接入。
outline: [2, 3]
---

# 自建数字人直播与 AI 换脸

需要长期播报、并希望避免按 token 或音视频时长支付云端推理费用时，可以使用吾码 AI 应用广场的 **[自建数字人直播](https://microi.net/app-detail.html?app=digital-human-live)**（`digital-human-live`）。吾码管理话术、知识和测试记录；中文语音、文字问答与口型画面在用户自己的电脑上生成。本机 WebRTC 画面页可用于浏览器预览；接入 OBS 时还需在实际安装的 OBS 版本中单独验证音画连接。

这里的“免费”指所选模型在本机推理没有供应商调用账单。电脑、显卡、电费、存储，以及吾码部署本身的授权或托管成本仍然存在。本应用没有修改或绕过吾码内置 AI 引擎的 License 校验，也不消耗 MiniMax、吾码 AI 中转或其它在线试用额度。

## 4K 功能截图

以下十一图均为实际应用页面或本机 OBS 录制帧，原始像素为 **3840 × 2160**，点击可查看原图。这里的 4K 指界面截图或 OBS 输出尺寸，口型及换脸视频源仍为 480 × 640，不应理解成 4K 模型推理。第一张是本机模型生成中文语音和口型后，经浏览器 WebRTC 收到的画面；所用人像由图像生成工具为文档制作，只用作演示素材。第二至第六张是新版照片驱动与换脸工作台，浏览器自动化通过官方接口引擎授权，再调用本机视频生成与两种摄像头实时动作接口；第七张是把实际生成人像与服装动作视频作为媒体源后由 OBS 录制的画面。演示人物均为合成测试素材。其余工作台和本机设置显示未配对状态；话术与知识库以隔离的示例数据渲染，用于展示交互布局，不代表线上租户的业务回读或外部平台真实开播。

<div class="mci-doc-screenshot-grid">
  <figure>
    <a href="/images/digital-human-live/live-preview-4k.png" data-fancybox="digital-human-live-4k" aria-label="查看数字人本机播报预览 4K 原图">
      <img src="/images/digital-human-live/live-preview-4k.png" width="3840" height="2160" loading="lazy" alt="数字人直播本机 WebRTC 播报预览：演示人像、已连接画面、中文话术、生成速度与播报队列" />
    </a>
    <figcaption>本机实测播报：演示人像经 MuseTalk 口型生成后由 WebRTC 送入工作台；不代表 OBS 实时来源或外部平台已开播。</figcaption>
  </figure>
  <figure>
    <a href="/images/digital-human-live/motion-workbench-4k.png" data-fancybox="digital-human-live-4k" aria-label="查看照片驱动与 AI 换脸工作台 4K 原图">
      <img src="/images/digital-human-live/motion-workbench-4k.png" width="3840" height="2160" loading="lazy" alt="照片驱动与 AI 换脸工作台：两种模式、源照片、驱动视频、素材授权和本机生成入口" />
    </a>
    <figcaption>照片驱动工作台：选择已授权照片与视频，在吾码账号和本机配对通过后提交任务。</figcaption>
  </figure>
  <figure>
    <a href="/images/digital-human-live/motion-face-result-4k.png" data-fancybox="digital-human-live-4k" aria-label="查看本机视频换脸结果 4K 原图">
      <img src="/images/digital-human-live/motion-face-result-4k.png" width="3840" height="2160" loading="lazy" alt="视频换脸实际结果：演示女像面部跟随男像驱动视频，男像头发衣服背景保留，页面显示速度与下载入口" />
    </a>
    <figcaption>只换脸实测：保留驱动视频的身体、衣服与背景；面部边缘在当前轻量算法下可见。</figcaption>
  </figure>
  <figure>
    <a href="/images/digital-human-live/motion-body-result-4k.png" data-fancybox="digital-human-live-4k" aria-label="查看照片人物与服装动作结果 4K 原图">
      <img src="/images/digital-human-live/motion-body-result-4k.png" width="3840" height="2160" loading="lazy" alt="照片人物与服装动作实际结果：演示女像及金色服装按驱动视频姿态进行二维形变" />
    </a>
    <figcaption>人像与衣服动作实测：照片中的人像和金色衣服随驱动姿态形变；半身照片无法还原未拍到的下半身。</figcaption>
  </figure>
  <figure>
    <a href="/images/digital-human-live/motion-live-face-4k.png" data-fancybox="digital-human-live-4k" aria-label="查看摄像头实时换脸预览 4K 原图">
      <img src="/images/digital-human-live/motion-live-face-4k.png" width="3840" height="2160" loading="lazy" alt="摄像头实时换脸预览：测试摄像头帧经本机 WebSocket 处理后显示在页面画布" />
    </a>
    <figcaption>摄像头实时预览：自动化使用测试视频作为虚拟摄像头；麦克风和 OBS 窗口采集需分别配置。</figcaption>
  </figure>
  <figure>
    <a href="/images/digital-human-live/motion-live-body-4k.png" data-fancybox="digital-human-live-4k" aria-label="查看摄像头实时人物与服饰动作 4K 原图">
      <img src="/images/digital-human-live/motion-live-body-4k.png" width="3840" height="2160" loading="lazy" alt="摄像头实时人物与衣服动作预览：测试摄像头帧驱动演示照片里的金色礼服人物" />
    </a>
    <figcaption>实时人物与衣服动作：虚拟摄像头逐帧输入，本机返回合成视频帧；服饰形变仍受单张照片视角限制。</figcaption>
  </figure>
  <figure>
    <a href="/images/digital-human-live/obs-recorded-body-4k.png" data-fancybox="digital-human-live-4k" aria-label="查看 OBS 实际录制的人像与服装动作 4K 帧">
      <img src="/images/digital-human-live/obs-recorded-body-4k.png" width="3840" height="2160" loading="lazy" alt="OBS 媒体来源录制的照片人物与金色衣服动作视频实际帧，竖向人物居中，左右为黑色画布" />
    </a>
    <figcaption>OBS 媒体来源实录：本机生成片段循环输入 OBS 后录制，显示人像与衣服动作；不是直播平台推流截图。</figcaption>
  </figure>
  <figure>
    <a href="/images/digital-human-live/studio-workbench-4k.png" data-fancybox="digital-human-live-4k" aria-label="查看数字人直播工作台 4K 原图">
      <img src="/images/digital-human-live/studio-workbench-4k.png" width="3840" height="2160" loading="lazy" alt="数字人直播工作台：话术播报、观众问答、直播队列、模型生成速度与 OBS 输出入口" />
    </a>
    <figcaption>直播工作台：播报控制、队列、模型指标和本机输出入口；截图时尚未配对。</figcaption>
  </figure>
  <figure>
    <a href="/images/digital-human-live/local-setup-4k.png" data-fancybox="digital-human-live-4k" aria-label="查看本机设置 4K 原图">
      <img src="/images/digital-human-live/local-setup-4k.png" width="3840" height="2160" loading="lazy" alt="本机设置：配对码输入、人像授权、OBS 接入说明和 Qwen3、MeloTTS、MuseTalk 模型组合" />
    </a>
    <figcaption>本机设置：配对、人像授权与 OBS 地址；截图没有展示配对码或人像。</figcaption>
  </figure>
  <figure>
    <a href="/images/digital-human-live/script-library-4k.png" data-fancybox="digital-human-live-4k" aria-label="查看直播话术界面演示 4K 原图">
      <img src="/images/digital-human-live/script-library-4k.png" width="3840" height="2160" loading="lazy" alt="直播话术界面演示：开场、产品介绍和收尾三条示例话术卡片，含状态、分类和编辑入口" />
    </a>
    <figcaption>直播话术：状态、分类、搜索与带到工作台；使用隔离的示例数据。</figcaption>
  </figure>
  <figure>
    <a href="/images/digital-human-live/knowledge-library-4k.png" data-fancybox="digital-human-live-4k" aria-label="查看问答知识界面演示 4K 原图">
      <img src="/images/digital-human-live/knowledge-library-4k.png" width="3840" height="2160" loading="lazy" alt="问答知识界面演示：本机推理费用、OBS 接入和直播平台推流三条示例问答" />
    </a>
    <figcaption>问答知识：常见问题、标准答复与启用状态；使用隔离的示例数据。</figcaption>
  </figure>
</div>

## 组成与能力边界

| 层次 | 本版实现 | 负责内容 |
| --- | --- | --- |
| 吾码管理 | MicroService、FormEngine、DiyToken | 话术、问答知识、角色权限、测试记录 |
| 本机推理 | Qwen3 0.6B、MeloTTS、MuseTalk 1.5 | 组织回答、中文语音、口型画面 |
| 本机输出 | WebRTC、MP4、OBS 媒体来源或浏览器来源 | 保存音画片段，并在 OBS 验证捕获与推流配置 |

## 照片人物动作与视频换脸

【AI 换脸与动作】提供两种本机模式。**只换脸**以拍摄视频为主体，使用已授权照片的面部随视频表情与头部位置变化，保留拍摄视频的头发、身体、衣服与背景。**人像与衣服动作**从照片提取人物轮廓、服装与姿态，以二维网格形变跟随驱动视频，并用统一背景填充。它不能推断源照片里不存在的身体或衣服背面，也不是高保真全身生成；遮挡、快速转身和手部交叉会造成明显失真。建议先用正面、清晰、完整拍到所需身体部位的照片与平稳视频试拍。

点击生成时，浏览器先调用吾码接口引擎 `dhl-motion-prepare`；引擎使用当前 DiyToken、当前租户与【直播测试记录】菜单权限核准任务，再调用可由租户扩展的 `dhl-motion-hook`。接口只返回本机执行契约，不接收照片或视频字节。网页随后把素材提交到配对的 `127.0.0.1:17861` 本机服务；完成后在本机预览、下载 MP4，可选择保存不含媒体内容的测试记录。**只换脸和人物服饰动作都支持摄像头实时预览**：浏览器逐帧送到同一回环服务的 WebSocket，再显示处理帧。输出嵌入“AI 生成”标识。源人物和拍摄者都需允许这种用途，不应把合成画面冒充真人身份。

本机程序基于 MediaPipe 关键点、OpenCV 和二维形变实现，新增模式不调用云端模型，不计 MiniMax token。它是低资源可运行的试验性效果，不承诺影视级换脸或稳定的全身直播。输出视频最长 15 秒、最多 450 帧、处理宽度最多 640 像素；超限输入会拒绝。官方演示样例用 RTX 2080 SUPER 所在电脑的合成素材、24 帧、2 秒、480 × 640 进行自动化，HTTP 任务实测只换脸 21.25 fps、人像与衣服动作 20.88 fps；网页侧分别验证了实时只换脸和实时人物服饰动作的 WebSocket 视频帧。帧处理速度并不等于整个直播链路的端到端帧率。

本版采用 **片段先生成、完成后播报** 的缓冲方式。支持话术播报和手动输入观众问题；完成的片段按队列播放，空闲时保持人像。问答延迟包含文字生成、语音生成和口型生成，不能把“输出 25 fps”当成“模型实时生成 25 fps”。工作台展示的口型生成帧率和耗时来自本机实测。

当前不自动采集抖音、视频号等平台弹幕，不代替 OBS 的平台推流配置，也不提供声音克隆。外部平台接收画面与声音后，才算完成对应平台的真实开播验收。

## 本机部署

准备 Windows 10/11、Python 3.12、可用的 NVIDIA CUDA 显卡；建议至少 8 GB 显存和 32 GB 内存。还应检查其它程序已经占用的资源。首次模型下载约 4.6 GB，CUDA 安装 wheel 约 2.45 GB，磁盘另需预留解压、Python 依赖和生成视频空间。

从应用私有源码取得 `runtime` 目录后，在应用目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File runtime/Install.ps1
powershell -ExecutionPolicy Bypass -File runtime/Start.ps1
```

安装脚本按固定版本下载公开权重、验证大文件 SHA-256，并建立应用自己的 Python 环境。模型下载与推理是两个步骤；安装需要网络，推理只读取本地文件。本机服务启动后检查显存余量，并限制同时生成的请求数量。

打开吾码【数字人直播 → 数字人工作台 → 本机设置】，使用 `runtime/.local/pairing-code.txt` 中的配对码连接本机。上传一张本人或已获授权的清晰正面单人照片，再进入工作台连接预览、生成第一段话术。人像和生成片段保存在这台电脑，默认不上传到吾码文件服务器。

## 话术、知识与权限

【直播话术】保存名称、内容、分类、状态和顺序；工作台可从“可播报”话术中选取内容。【问答知识】保存常见问题、标准答复和检索关键词；本版按关键词选取最多五条启用知识，交给本机模型组织简短回答。小模型可能回答不准确，知识匹配不到时不应承诺其会理解全部业务。

【直播测试记录】保存设备、版本、输出方式、片段时长与实测生成帧率。上述数据使用当前租户的 FormEngine 和实际模块权限；“数字人直播运营”角色的菜单由应用包交付，账号仍需由管理员分配角色。工作台从授权菜单中解析实际菜单 Id，再传入 `_SysMenuId`，不固化官方租户 Id；后端继续校验权限与数据范围。

本机配对只授权这台电脑的媒体服务，不是另一套吾码用户或权限系统。DiyToken 只用于吾码数据请求，不发送给本机模型；本机配对码、临时会话和模型内部密钥也不写入云端表。

## 接入 OBS

实时接入可尝试在 OBS 添加“浏览器”来源，地址填写：

```text
http://127.0.0.1:17861/output
```

通过该来源的“交互”窗口输入本机配对码；必须确认连接面板消失、服务状态中的 `peers` 大于 0，并录制回读音画，才能认定浏览器来源接入成功。启用来源音频，工作台预览保持静音，以避免重复播放。若浏览器来源停在配对面板，可先用 OBS“媒体来源”选择本机 `runtime/.local/outputs/<任务 Id>/clip.mp4` 验证片段捕获；循环播放 MP4 只证明已生成片段能被 OBS 接收，不能算实时连接。直播平台的推流地址和密钥在 OBS 中配置，不需要写入吾码话术表。

独立输出页可持续播放，切换吾码菜单会关闭工作台预览。停止播报会清空待播队列，并在当前推理批次完成后取消生成；已经下载的 MP4 不会删除。

## 连接失败与交付验收

- 连接超时：检查本机服务是否启动、浏览器是否允许页面访问本地网络。
- 域名被拒绝：在本机 `runtime/.local/config.json` 的 `allowedOrigins` 中配置实际页面的完整 Origin，包括协议和端口，不使用 `*`。服务只监听回环地址，不应直接暴露到公网。
- 模型加载失败：查看 `runtime/.local/gateway-error.log`，检查权重校验、CUDA 与可用显存；服务不会自动回退到收费云端。
- 出现配对失效：重新配对。本机配对会话有有效期并绑定浏览器 Origin，服务重启后需重新配对。

验收应分别记录：吾码数据与权限、真实中文音频、口型帧变化、媒体音画时长、本机 WebRTC 接收、OBS 捕获，以及直播平台的实际接收情况。HTTP 200、任务入队、模型成功加载和本机预览可见都不能单独证明已经对外开播。

2026-09-26 的首版本机样例使用 RTX 2080 SUPER、480 × 640 画面：1.669 秒中文片段总生成耗时 12.495 秒，口型阶段 4.98 fps；2.601 秒知识问答片段总耗时 15.058 秒，口型阶段 9.10 fps。输出文件为 H.264 + AAC、25 fps，音画时长差约 29 毫秒；本机浏览器 WebRTC 测试实际收到两条媒体轨道，统计丢包为 0。这些是短样例，不能代表长时直播性能。

2026-09-27 在 OBS 32.2.2 中用“媒体来源”循环播放上述 2.601 秒片段，并建立独立的 720 × 1280 竖屏配置。将 480 × 640 原片左右各裁剪 60 像素后适配画布，OBS 本地录制得到 26.23 秒 H.264 + AAC 双声道 MP4，音频峰值 −17.2 dB。该测试仅使用研究人像素材验证本机捕获。相同 OBS 的“浏览器”来源停在配对面板，服务端 `peers=0`，未通过实时 WebRTC 接入；也未验证外部平台推流。不得把这段循环录制称为真实开播。

2026-10-04 新增“人物与衣服动作”后，使用本机实际生成的 `api-body.mp4` 作为 OBS“媒体来源”，独立验收场景通过 OBS WebSocket 回读了当前场景、来源路径与录制状态，录制约 9 秒。回读的 MP4 可解码为 **3840 × 2160、30 fps、288 帧**，上方第七张图是该录像中间帧。此项证明 OBS 能接收并录制生成片段；摄像头实时换脸及人物服饰动作已在应用页面及本机 WebSocket 自动化验证，尚未验证 OBS 对其实时窗口的捕获、平台推流或观众端接收。

应用源码同步使用 `.microi-micro-app.json` 的 `SourceExcludes` 排除 `runtime/.local`、`.venv`、缓存和测试产物；不能只依赖 `.gitignore`。模型权重、人像、配对码与生成视频不进入公开应用包。上游研究测试素材的使用范围与模型代码许可不同，不能将其默认作为商业主播素材。

组件来源与许可：[MuseTalk](https://github.com/TMElyralab/MuseTalk)、[MeloTTS ONNX](https://huggingface.co/csukuangfj/vits-melo-tts-zh_en)、[Qwen3 GGUF](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF)、[llama.cpp](https://github.com/ggml-org/llama.cpp)。各模型 revision 和文件校验值由应用源码中的 `runtime/model-lock.json` 固定；硬件性能以自己的机器实测为准。
