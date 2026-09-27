---
title: 自建数字人直播
description: Microi吾码自建数字人直播的本机部署、4K功能截图、话术与知识管理、OBS接入和实测验收边界。
outline: [2, 3]
---

# 自建数字人直播

需要长期播报、并希望避免按 token 或音视频时长支付云端推理费用时，可以使用吾码 AI 应用广场的 **[自建数字人直播](https://microi.net/app-detail.html?app=digital-human-live)**（`digital-human-live`）。吾码管理话术、知识和测试记录；中文语音、文字问答与口型画面在用户自己的电脑上生成。本机 WebRTC 画面页可用于浏览器预览；接入 OBS 时还需在实际安装的 OBS 版本中单独验证音画连接。

这里的“免费”指所选模型在本机推理没有供应商调用账单。电脑、显卡、电费、存储，以及吾码部署本身的授权或托管成本仍然存在。本应用没有修改或绕过吾码内置 AI 引擎的 License 校验，也不消耗 MiniMax、吾码 AI 中转或其它在线试用额度。

## 4K 功能截图

以下五图均从数字人直播应用实际页面组件采集，原始像素为 **3840 × 2160**，点击可查看原图。这里的 4K 指界面截图尺寸，口型视频源仍为 480 × 640、25 fps，不应理解成 4K 模型推理。第一张是本机模型生成中文语音和口型后，经浏览器 WebRTC 收到的画面；所用人像由图像生成工具为文档制作，只用作演示素材。其余工作台和本机设置显示未配对状态；话术与知识库以隔离的示例数据渲染，用于展示交互布局，不代表线上租户的业务回读或外部平台真实开播。

<div class="mci-doc-screenshot-grid">
  <figure>
    <a href="/images/digital-human-live/live-preview-4k.png" data-fancybox="digital-human-live-4k" aria-label="查看数字人本机播报预览 4K 原图">
      <img src="/images/digital-human-live/live-preview-4k.png" width="3840" height="2160" loading="lazy" alt="数字人直播本机 WebRTC 播报预览：演示人像、已连接画面、中文话术、生成速度与播报队列" />
    </a>
    <figcaption>本机实测播报：演示人像经 MuseTalk 口型生成后由 WebRTC 送入工作台；不代表 OBS 实时来源或外部平台已开播。</figcaption>
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

应用源码同步使用 `.microi-micro-app.json` 的 `SourceExcludes` 排除 `runtime/.local`、`.venv`、缓存和测试产物；不能只依赖 `.gitignore`。模型权重、人像、配对码与生成视频不进入公开应用包。上游研究测试素材的使用范围与模型代码许可不同，不能将其默认作为商业主播素材。

组件来源与许可：[MuseTalk](https://github.com/TMElyralab/MuseTalk)、[MeloTTS ONNX](https://huggingface.co/csukuangfj/vits-melo-tts-zh_en)、[Qwen3 GGUF](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF)、[llama.cpp](https://github.com/ggml-org/llama.cpp)。各模型 revision 和文件校验值由应用源码中的 `runtime/model-lock.json` 固定；硬件性能以自己的机器实测为准。
