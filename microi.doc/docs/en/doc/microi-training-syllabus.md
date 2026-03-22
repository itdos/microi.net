# 🎓Microi Woma AI Platform Training Outline

> **Fully master the engines and AI capabilities of Microi's low-code platform.**

---

## 1.📌Platform Introduction
- Platform Positioning: Open Source AI Low Code Platform (. NET10 Vue3Element-PlusRedis cross-database)
- Core concept: **"Everything is a form engine"**
- Architecture Overview: PC/Mobile UniApp / WebOS
- Version Comparison: Open Source Edition/Personal Edition/Enterprise Edition

---

## 2.🛠Environment construction and deployment
- Docker deployment
- Windows deployment
- Local development: backend (.NET SDK) frontend (Node.js pnpm)
- SaaS three parameters: OsClient, OsClientType, OsClientNetwork

---

## 3.⚡Quick Start
- Core process: **Create a physical table → Design a form → Create a module → Configure permissions**
- Two table building methods: creating in-platform/loading after Navicat creation
- One table for multiple purposes: one table → multiple modules/multiple processes/multiple reports

---

## 4.📝Form Engine
- Drag and drop design form, introduction to all form components
- Field properties and events (explicit, mandatory, validation, value change)
- V8 event system (front-end and back-end events, execution sequence)
- Custom components, dynamic association forms, template engines

---

## 5.⚙️ V8 engine and interface engine
- Write a backend API for online JavaScript, and save it to take effect.
- V8 Functions-Backends: FormEngine, Db, Cache, Http, CurrentUser, etc.
- V8 function-front end: Form, FormSet, Tips, Post, Result, etc.
- V8 debugging: online local bidirectional synchronization, full path breakpoint debugging
- Extended interface engine (V8EngineExtend custom backend functions)

---

## 6.📦Module Engine
- Five ways to open: Diy / Component / Iframe / SecondMenu / Report
- Data source configuration: associated table, query column, sort, search, where permission condition
- Interface Replacement, Dynamic Button, Module Copy

---

## 7.🔄Process Engine (Workflow v4)
- Process design: drawing flowcharts, node attributes, conditional branches
- Process V8 events (12-step execution sequence)
- Process Operation: Initiate, Agree, Reject Return, Withdraw, Copy

---

## 8.🧩Other system engines
- **Report engine**：Data source interface form module combination implementation
- **Data Source Engine**：SQL / V8 / JSON
- **Interface Engine**：Custom interface design, ECharts charts
- **Print Engine**：Online production print template
- **SaaS Engine**：Multi-tenant independent configuration, a set of programs to drive N tenants
- **Translation Engine**：Multilingual Management
- **Search engine**：ElasticSearch integration
- **MQTT Engine**：IoT IoT device access
- **Task Scheduling**：Scheduled Tasks, Execute Interface Engines, or DLLs
- **Message queue**：RabbitMQ
- **App Store**：Module upload, download, install

---

## 9.🤖AI engine
- **AI online programming**：Online AI to write V8 interface engine code (natural language → V8 code)
- **AI Local Programming**：Local IDE integration AI, bidirectional incremental synchronization V8 code, support breakpoint debugging
- **AI data analysis**：Natural language to SQL, intelligent data query and report generation
- **AI code check**：V8 code quality detection and optimization suggestions
- **Vector database**：Automatic differential synchronization to improve AI accuracy
- **AI training and fine-tuning**：Prompt word management, model customization
- **Multi-model support**：Access DeepSeek/OpenAI/Local deployment model

---

## 10.🎨AI-assisted design
- **AI-aided database design**：The AI automatically recommends table structures, field types, and associations based on business requirements.
- **AI-assisted form design**：The AI automatically recommends control types, layout schemes, and field validation rules based on the table structure.
- **AI-aided process design**：AI recommend process nodes, conditional branches, and approval rules based on the business description.
- **AI-assisted large screen design**：AI recommended goView chart combination scheme and data source binding
- **AI Aided Interface Design**：AI automatically generate interface engine code templates based on functional descriptions
- **AI cue design**：Design and optimize AI prompt words to improve the quality of AI output in various scenarios

---

## Eleven,🦞OpenClaw Woma Crayfish
- **Introduction**：AI Content Automation and Remote Cluster Management System Based on Microi Code
- **Dashboard**：Global situation awareness, node status monitoring, and trend charts
- **Task Center**：Complete process (crawling → AI writing → publishing → mutual evaluation), support for single-step execution
- **Article Management**：AI generation of article review, edit, and publish records
- **Platform account**：Multi-platform account management (CSDN, etc.)
- **Mutual evaluation management**：Automatic mutual evaluation and praise
- **Node Management**：Remote cluster node deployment, status monitoring, and command delivery
- **AI Model Configuration**：AI large models for OpenClaw configuration
- **System Settings**：Crawling, writing, publishing and mutual evaluation global configuration

---

## Eleven,📂Storage/Office/Visualization
- Distributed storage: Alibaba Cloud OSS/MinIO/Amazon S3
- Office Online Editor (OnlyOffice)
- goView data big screen design

---

## Twelve,🔒Permissions and Secondary Development
- Permission system: role, user, department, fine-grained control to table/field/menu/interface
- Front-end secondary development: customized Vue components, Component pages, microservices
- Backend secondary development: V8EngineExtend extension, gRPC cross-language

---

## Thirteen,📱Mobile (App H5 applet)
- **Project Structure**：microi.uniapp directory introduction, basic configuration (manifest.json, pages.json)
- **Operating mode**：Table list, form page to WebView load adaptive H5 interface
- **Package Publishing**：Android App / iOS App/WeChat applet/Alipay applet/H5
- **Mobile Form**：Call platform form engine to realize mobile terminal addition, deletion and modification check
- **Mobile terminal interface docking**：Unified mobile data interface through interface engine
- **UniApp secondary development**：Custom pages, custom components, and integration with the platform permission system
- **H5 Independent Deployment**：WeChat/Alipay Online Payment Mall H5 Project Structure and Packaging

---

## XIV,🛠Actual combat exercise
- **AI quickly build a complete business system**：AI-assisted table building → AI generation of V8 interface code → form design → module configuration → permission allocation, full process demonstration
- Build CRUD module from zero (including search, sorting and permission)
- The interface engine implements complex business logic (multi-table transactions, external API calls)
- Build a complete approval process (conditional branch, multi-level approval, V8 notification)
- Report data large screen production
- Industry Case Sharing: MES / ERP / OA / CRM / IoT