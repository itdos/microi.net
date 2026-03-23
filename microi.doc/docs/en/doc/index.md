# 🚀Open Source AI Low Code Platform-Microi Code

> **Low-code AI development mode, supporting traditional development**
>
> .NET10 Vue3 Redis Cross DatabaseElement-PlusThe platform started in 2014 and will be officially open source in November 2024.

---

## 📖Platform Overview

* * Microi Code * * is an open source AI low-code platform for developers. It adopts * * low-code AI * * dual-drive development mode and perfectly supports traditional development. The platform started in 2014 (based on Avalon.js) and was refactored with Vue in 2018. After years of polishing, it was officially open source in November 2024.

Powerful [**API interface engine**](/doc/v8-engine/api-engine), online use of JavaScript to write back-end API interfaces, support [**online AI programming**](/doc/v8-engine/ai-apiengine) and [**local AI programming (VS Code plug-in)**](/doc/v8-engine/ai-apiengine# mode 2-local-AI-programming vs-code-plug-in),AI automatically obtain V8 engine API knowledge base + your database structure, the interface code generation accuracy rate is as high as 99%, the extreme development efficiency, no need to compile and publish, save and take effect.

| Resources | Address |
|---|---|
| 🌐Official Documentation | [https://microi.net](https://microi.net) |
| 🦞OpenClaw my size crayfish | [https://gitee.com/microi-net/microi.openclaw](https://gitee.com/microi-net/microi.openclaw) |
| 🖥️ Try it online | [https://web.microi.net](https://web.microi.net) |
| 📦Gitee source code | [https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net) |
| 📦GitCode source code | [https://gitcode.com/microi-net/microi.net/overview](https://gitcode.com/microi-net/microi.net/overview) |
| 📝The Official CSDN Blog | [https://microi.blog.csdn.net](https://microi.blog.csdn.net/?type=blog) |
| 📝Technology CSDN Blog | [https://lisaisai.blog.csdn.net](https://lisaisai.blog.csdn.net/?type=blog) |

---

## 📸Preview

<img src="https://static.itdos.com/upload/img/csdn/ee76765ec943d4da0b6f6097c494d8bc.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/microi-apiengine-20260208.jpg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/9989ec6bfdcd6c0fead567bd79012bc4.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/V8引擎本地AI编程连接配置.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/V8引擎本地AI编程运行调试.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/13c2c7a5e0329f6821eddd3f12c8536f.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/表单引擎.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/界面引擎.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/数据大屏.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/打印引擎.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/AI数据分析.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/应用商城.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/ede3b036e9ebbf6de2772bcb3b062790.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<img src="https://static.itdos.com/upload/img/csdn/23ca5070e927a7a7cc3687221fe483dd.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<img src="https://static.itdos.com/upload/img/csdn/6cf3c31ba0e8da4a124cb1bf8c755b74.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<div style="clear:both;"></div>

---

## ✨Platform Highlights

### 🔗Core Engine

| Engine | Explanation |
|---|---|
| 🔗 **[接口引擎](/doc/v8-engine/api-engine)** | Integrate Google V8 engine, use JavaScript to write back-end interfaces online, support Get/Post, and support returning JSON, files, HTML, etc. |
| 📝 **[表单引擎](/doc/form-engine/form-engine-info)** | Support extended components, custom Vue component embedded form, V8 engine event, flexible implementation of complex business logic |
| 📦 **[模块引擎](/doc/system-engine/module-engine)** | Multi-table association, query column, statistical column, dynamic V8 button, complex Where condition, multiple embedding modes |
| 🔄 **[工作流引擎 v4](/doc/system-engine/wf-engine)** | Fully self-developed, driven by the form engine interface engine |
| 🤖 **[AI 编程](/doc/v8-engine/ai-apiengine)** | * * Online AI Local AI Dual Mode * *: Automatically inject V8 API knowledge base and database structure, GitHub Copilot / Claude Code / Cursor out of the box; The platform has built-in AI models such as DeepSeek and supports natural language conversion to SQL and code checking. |
| 🎨 **[界面引擎](/doc/system-engine/page-engine)** | Visual interface custom design, support for ECharts charts |
| 🖨️ **[打印引擎](/doc/system-engine/print-engine)** | Make print templates online and print without exporting |
| 📊 **[报表引擎](/doc/system-engine/report-engine)** | Virtual tables and ECharts reports support custom addition, deletion and modification. |
| ☁️ **[SaaS 引擎](/doc/system-engine/saas-engine)** | Three modes: database isolation multi-tenant, TenantId tenant isolation, and independent organization isolation |

### 🤖AI low-code development model

| Mode | Tool | Explanation |
|---|---|---|
| **Online AI Programming** | DeepSeek / ChatGPT / Kimi etc | Upload V8 document database structure (db.json),AI directly generate interface engine code |
| **Local AI Programming** | VS Code Copilot / Claude Code / Cursor | The plug-in is automatically injected into the knowledge base (V8 API your database structure), writing code → executing → debugging is completed in VS Code. |
| **V8 Code Call AI** | Interface Engine DeepSeek Interface | Directly adjust the AI in the interface engine to realize intelligent question and answer, natural language to SQL, etc. |

> [→ View the full guide to AI programming](/doc/v8-engine/ai-apiengine)

### 🏗Infrastructure

| Ability | Explanation |
|---|---|
| ♾️ **Unlimited** | There is no limit to the number of users, forms, data volume and databases. The front end-mobile end is 100% open source and the back end is 99% open source. |
| 🌐**Cross-platform** | 基于 .NET10，[核心库采用 .Net Standard 开发](https://www.nuget.org/packages/Microi.net#versions-body-tab)，支持 gRPC 跨语言通信 |
| 🗄️ **Cross database** | MySql 5.5 / SqlServer 2016 / Oracle 11g, supports read/write separation/sub-database and sub-table |
| ☁️ **Distributed Deployment** | Docker / K8S / Jenkins / Rancher / CI/CD |
| 💾**Distributed Cache** | Redis Sentinel Mode |
| 📂 **[分布式存储](/doc/hdfs)** | Aliyun OSS/MinIO/Amazon S3, can expand more storage media |
| 📨 **[消息队列](/doc/system-engine/mq)** | RabbitMQ integration |
| 📡 **[IoT 物联网 MQTT](/doc/system-engine/mqtt-engine)** | Integrated MQTT server with 485/ZigBee/Bluetooth/Modbus gateway support |
| 🔍 **[搜索引擎](/doc/system-engine/search-engine)** | ElasticSearch word segmentation search |
| 🍃**MongoDB** | Log system, hundreds of millions of data volume, millisecond paging |

### 🧩More capabilities

| Ability | Explanation |
|---|---|
| 📄**Template Engine** | Forms/tables support online HTML template rendering |
| 📂 **[数据库管理](/doc/system-engine/databases)** | One-click loading of third-party databases, access to any database in the interface engine |
| 📑 **[Office 引擎](/doc/office)** | Integrated OnlyOffice, Local Design Template, Export/Print |
| 🔐**Fine-grained permissions** | Accurate to every table, every field, every menu, every button, every interface |
| 🔑**Single Sign-On** | Support for third-party systems↔Low-code platform bidirectional single sign-on |
| 💬**WeChat public platform** | Multi-public/multi-applet configuration, template message |
| 📱**Mobile (UniApp)** | 100% open source, support applets/H5/Android / iOS |
| 🧩**Microservices** | Vue2 is based on Qiankun,Vue3 is based on MicroApp |
| ⏱️ **[任务调度](/doc/system-engine/job)** | Timed execution of interface engine or custom DLL |
| 💬**Chat system** | Self-developed online chat Tencent IM integration |
| 🕷️ **Acquisition Engine** | Web page acquisition, before and after MVVM rendering, full coverage of interface requests |
| 🌍 **[多语言](/doc/system-engine/translate-engine)** | Front-end and back-end multi-language management, online configuration |
| 📊**goView data screen** | [集成 goView](https://lisaisai.blog.csdn.net/article/details/149858192?spm=1001.2014.3001.5502)，快速实现数据可视化 |
| 🧊**WebGL 3D Renderer** | Based on Three.js, supports. gltf / .obj / .glb / .fbx / .stl format |
| 💬**Tencent IM** | Fast integration of social chat, customer service sessions, live barrage |

---

## 💰Differences between the Open Source Edition, Personal Edition, and Enterprise Edition

| Version | Price | Explanation |
|---|---|---|
| **Open Source Version** | Free | PC traditional interface 100 source code, mobile 100 source code, back-end 99% source code; Can be used commercially, modified at will, distributed and deployed indefinitely. **Only online AI related functions are not available** |
| **Personal Edition** | ¥999 | Additional * * WebOS 100% complete source code * *, function, open source level and enterprise version is completely consistent, * * without any restrictions, unlimited distribution and deployment * * |
| **Enterprise Edition** | $10w (down payment $2.5w) | Provide more training, consulting and other after-sales services, **priority response platform upgrade needs** |

---

## 🏆Success Stories

> 2018~2025 has delivered software * * 200 sets * * based on Microi code platform, and has applied customer * * 500 * *

| Industry | Case study |
|---|---|
| 🏠Real estate | Internet platform (a large number of front-end and back-end microservice customization) |
| 🏭Manufacturing | Large MES(500 table, 500 interface engine), large electrical ERP(300 table, 100 module) |
| 👔Clothing industry | Multiple clothing ERP(100 table, 1 person completed in January), pure low code implementation |
| 📡IoT | IoT smart home (billions of data), plant factory intelligent hardware control |
| 🏢Government and enterprise | Multiple sets of group, state-owned enterprise OA system |
| 🎓Education | Cooperative University Training Courses |
| 📦Other | Parking, tide detection, fixed assets, CRM, etc. |

>📌[More than 100 Cases Continuously Updated](https://microi.blog.csdn.net/category_12828272.html)

---

## 📂Source Code Directory Explanation

```
Microi.net/
├── Microi.Server/     # 🔧 后端 99% 源码（.NET10，自 2014 年一路升级）
├── Microi.Client/     # 🖥️ PC 传统界面 100% 源码（Vue3 + Element-Plus + Vite + Pinia）
├── microi.app/        # 📱 HBuilderX APK/IPA 套壳打包工程（Wap2App）
├── microi.uniapp/     # 📱 UniApp 移动端 100% 源码（小程序 / H5 / App）
└── microi.doc/        # 📝 官方文档（基于 VitePress）
```

---

## 📚Related Documents

| Resources | Address |
|---|---|
| 📖Official Documentation | [https://microi.net](https://microi.net) |
| 📝CSDN Platform Documentation | [https://blog.csdn.net/qq973702/category_12826294.html](https://blog.csdn.net/qq973702/category_12826294.html) |
| 🏆CSDN Success Stories | [https://blog.csdn.net/qq973702/category_12828272.html](https://blog.csdn.net/qq973702/category_12828272.html) |
| 🔗CSDN open source project based on my code | [https://blog.csdn.net/qq973702/category_12828230.html](https://blog.csdn.net/qq973702/category_12828230.html) |
---

## 💬Join the chat group

Welcome to join the official QQ communication group, communicate with the development team and community members in real time, obtain the latest information, answer questions and grow together:

<p align="center">
  <a href="https://qun.qq.com/universal-share/share?ac=1&authKey=kV1duuyq6mvmOdBZHXuwrOAXxmYjdg4ga33HKNefIfjCv4dsPRpi7BbDeS8rPCCd&busi_data=eyJncm91cENvZGUiOiI1MTA1MDA1NSIsInRva2VuIjoiMk52UzB6aWNYdnhJb3pVODdDbmVFQWZLeFhCSEltbkcrcWczcVBSVEFKTjJONlVQcXZvbDQzakhrR01IUEFEZiIsInVpbiI6Ijk3MzcwMiJ9&data=gr7BMtLgNqPpYNpN7ChH4JwREChPjZHlxLGlGm81aCsONvAFCIM3K60QG2l1WZtJQEZghRjFYRlCDHPSUPzkDQ&svctype=4&tempid=h5_group_info" target="_blank">
    <img src="https://img.shields.io/badge/QQ%20交流群-51050055-12B7F5?style=for-the-badge&logo=tencentqq&logoColor=white" alt="点击加入 QQ 交流群" />
  </a>
</p>

<p align="center">
  <a href="https://qun.qq.com/universal-share/share?ac=1&authKey=kV1duuyq6mvmOdBZHXuwrOAXxmYjdg4ga33HKNefIfjCv4dsPRpi7BbDeS8rPCCd&busi_data=eyJncm91cENvZGUiOiI1MTA1MDA1NSIsInRva2VuIjoiMk52UzB6aWNYdnhJb3pVODdDbmVFQWZLeFhCSEltbkcrcWczcVBSVEFKTjJONlVQcXZvbDQzakhrR01IUEFEZiIsInVpbiI6Ijk3MzcwMiJ9&data=gr7BMtLgNqPpYNpN7ChH4JwREChPjZHlxLGlGm81aCsONvAFCIM3K60QG2l1WZtJQEZghRjFYRlCDHPSUPzkDQ&svctype=4&tempid=h5_group_info" target="_blank">
    <img src="https://static.itdos.com/openclaw/preview/qq-qun2.jpg" alt="扫码加入 QQ 交流群" style="max-width: 260px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.18);" />
  </a>
</p>

<p align="center">📌Group number: <B> 51050055</B> click on the badge or scan the two-dimensional code to join </p>
