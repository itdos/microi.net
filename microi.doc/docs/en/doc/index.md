# Open Source Low Code Platform-Microi Code

## Platform Profile
> * Official documentation:[https://microi.net](https://microi.net)
> * technical framework:[__<font color="red">**low code AI**</font>__] development mode, supported`传统开发`,. NET10 Vue2/3 Redis MySql/SqlServer/Oracle Element-UI/Element-PlusUniApp
> * The platform started in 2014 (based on Avalon.js), used Vue refactoring in 2018, and opened in November 2024
> * Powerful [[API Interface Engine]](https://microi.net/doc/v8-engine/api-engine.html) for online use`JavaScript`Preparation`后端api接口`, support [[AI to write V8 engine code]](https://microi.net/doc/v8-engine/ai-apiengine.html), support`[Get、Post]`request, support return`[JSON、字符串、文件、HTML]`Wait, support`[自定义接口地址、分布式锁、权限、自定义扩展函数]`Wait. Arbitrarily complex business scenarios can be implemented. Extreme performance and development efficiency, no need to compile and publish, save and take effect.
> * WebOS trial address:[https://webos.microi.net](https://webos.microi.net)
> * Traditional interface trial address:[https://web.microi.net](https://web.microi.net)
> * Gitee open source address:[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
> * GitCode open source address:[https://gitcode.com/microi-net/microi.net/overview](https://gitcode.com/microi-net/microi.net/overview)
> * Official CSDN Blog:[https://microi.blog.csdn.net](https://microi.blog.csdn.net/?type=blog)
> * Technical CSDN Blog:[https://lisaisai.blog.csdn.net/?type=blog](https://lisaisai.blog.csdn.net/?type=blog)


## Preview
<img src="https://static.itdos.com/upload/img/csdn/ee76765ec943d4da0b6f6097c494d8bc.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/Microi20260122.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/9989ec6bfdcd6c0fead567bd79012bc4.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/13c2c7a5e0329f6821eddd3f12c8536f.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/e7cc9aee7486409a40a4a0b72cf5d916.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/ede3b036e9ebbf6de2772bcb3b062790.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<img src="https://static.itdos.com/upload/img/csdn/23ca5070e927a7a7cc3687221fe483dd.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<img src="https://static.itdos.com/upload/img/csdn/6cf3c31ba0e8da4a124cb1bf8c755b74.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<div style="clear:both;"></div>

## Platform Highlights
* **Unlimited**：There is no limit on the number of users, forms, data volume, database volume, etc. Front-end-mobile 100% open source, back-end 99% open source
* **Interface Engine**：[Integrate Google V8 engine, support using JavaScript to write back-end interfaces online, support get and post requests, support response files, read files, etc.](/doc/v8-engine/api-engine)
* **Cross-platform**：Currently based on. NET10 (upgraded from. Net Framework/Core 2.0),[core library developed in. Net Standard](https://www.nuget.org/packages/Microi.net#versions-body-tab), supports gRPC to realize cross-development language communication
* **Cross database**：Support MySql5.5, SqlServer2016, Oracle11g, support read/write separation/sub-database and sub-table, can be extended to more database types
* **distributed**：Support distributed deployment, support Docker, K8S, Jenkins, Rancher, CICD
* **distributed cache**：Support Redis Sentinel
* **distributed storage**：[Support Aliyun OSS, MinIO, Amazon S3, can expand more storage media](https://microi.blog.csdn.net/article/details/143763937)
* **MQ Message Queue**：Integrated RabbitMQ
* **IoT MQTT**：Integrated MQTT server, support 485, zigbee, Bluetooth, Modbus Internet of things device MQTT gateway, interface engine online write business logic code, so that the IoT Internet of things development efficiency increased by 10 times
* **Search Engine (ES)**：Integrated ES search engine, easy to achieve large Internet applications word segmentation search
* **MongoDB**：Integrated MongoDB, the interface engine can directly access the MongoDB, the log system uses MongoDB, hundreds of millions of data volume millisecond paging.
* **Interface Engine**：[Interface Customization](https://microi.blog.csdn.net/article/details/143972924) [<span color = "red">Tips: This module is not open source yet, and the function is unlimited </span>]]
* **Print Engine**：[Online Print Template Production](https://microi.blog.csdn.net/article/details/143973593) [<span color = "red">Tips: This module is not open source yet, and its functions are unlimited </span>]]
* **SaaS Engine**：Three SAAS modes, supporting database-level isolation, multi-tenant isolation, TenantId tenant isolation, and independent organization data isolation
* **Form Engine**：[Support extended components, support custom vue components to embed forms, support secondary development to call form engines, support V8 engine events, and flexibly implement complex business logic](https://microi.blog.csdn.net/article/details/143671179)

* **Module Engine**：[Support multi-table association, query column,; Fixed column, non-display column, statistical column, searchable column, sortable column, dynamic V8 button, complex where condition, interface address replacement, support for multiple embedding modes: iframe, microservice, component, built-in interface template, etc.](https://microi.blog.csdn.net/article/details/143775484)
* **Template Engine**：Form/table support online html template rendering
* **AI engine**：Integrate AI models (DeepSeek, etc.) to check AI code and generate interface engine V8 code.
* **Database Management**：Supports one-click loading of third-party databases and accessing any database in the interface engine
* **Office Engine**：Local design office template, export and print according to the template
* **Workflow Engine v4**：[v1 based on Microsoft WWF, v2 based on ccflow, v3 based on Microsoft's latest WWF, v4 completely independent research and development, driven by form engine and interface engine](https://microi.blog.csdn.net/article/details/143742635)
* **fine-grained permission control**：Permission control to every table, every field, every menu, every V8 button, every interface
* **Single Sign-On**：Support hidden left, top. Supports single sign-on to third-party systems for low-code platforms and single sign-on to third-party systems for low-code platforms.
* **WeChat public platform**：Multi-public number configuration (users of different group branches bind different public numbers to send template messages), multi-applet configuration, and template message configuration
* **Mobile end (uni-app)**：Open 100% source code, can package small programs, h5, Android app, ios
* **Report Engine**：Virtual tables and echarts reports are supported. You can add, delete, and modify reports.
* **Microservices**：Support front-end microservices (currently vue2 is based on qiankun,vue3 is based on MicroApp)
* **Task Scheduling**：Custom timing tasks that can execute interface engines and custom development dlls.
* **chat system**：Support self-developed online chat, message notification, and integrate Tencent IM chat system
* **Acquisition Engine**：all-purpose collection engine, which can collect web pages, before mvvm rendering, after mvm rendering, and all interface requests in the interface engine.
* **Flying Book**：Use the interface engine to open the fly book interface, support message notification, etc.
* **Multilingual**：Both front and back end support multi-language management, online configuration of multi-language
* **Integrated goView data big screen**：Integrated goView data large screen, can quickly realize data visualization, detailed introduction: https://lisaisai.blog.csdn.net/article/details/149858192?spm=1001.2014.3001.5502
* **Built-in WebGL 3D model renderer**： Built-in WebGL 3D model renderer for fast 3D model visualization. Based on Three.js, the model. gltf, obj, glb, fbx, and stl formats are supported. Experience address: https://www.nbweixin.cn/three/
* **Tencent IM**: Integrating Tencent IM requires simple configuration to quickly integrate social chat, customer service session, live barrage and other capabilities using rich UI components.

## The difference between open source edition, personal edition and enterprise edition
>* **Open source version**：PC traditional interface 100 complete source code, mobile 100 complete source code, back-end 99% source code, can be commercial, free to modify. <font color = "red"> You can only design and save processes, not initiate workflows. </font>
>* **Personal Edition**：$999; Additional <font color = "red"> [WebOS 100% full source code] </font> is included, and the function and open source level are exactly the same as the' enterprise edition'; There is License one permanent developer at the back end, and there is no limit to the License of permanent runtime at the back end. <font color = "red"> You can initiate a workflow without any restrictions </font>
>* **Enterprise Edition**：$10w (down payment $2.5w); Provide more after-sales services such as training and consulting; Give priority to responding to platform upgrade requirements; There are License 10 permanent back-end developers, with unlimited License when the back-end is running permanently.

## Successful Cases
* 2018~2025 200 sets of software delivered based on Microi code platform have been applied to customer 500.
* Real estate Internet platform (a large number of front-end and back-end micro-service customization)
* Large MES(500 table, 500 interface engine)
* Large electrical ERP(300 table, 100 module)
* Multiple clothing ERP(100 table, 1 person completed in 1 month) (clothing ERP system realized by pure low code platform)
* Internet of Things smart home (billion-level data processing), plant factory intelligent hardware control.
* Multiple sets of group, state-owned enterprise OA system
* Parking, tide detection, fixed assets, CRM and other platforms
* Cooperative University Training Courses
* [More than 100 Cases Continuously Updated](https://microi.blog.csdn.net/category_12828272.html)

## Source directory description
* **microi.doc**：Official website source code (official document)
* **Microi.Server**：Backend 99% source code (.NET10)
* **microi.uniapp.uni-ui**：Mobile 100% full source code (uniapp + uni-ui + vue3)
* **microi.web**：PC traditional interface 100 complete source code (vue2 + element-ui + webpack + vuex)
* **microi.webos.build**：WebOS compiled (deployable to run)
* **microi.webos**：[Personal Edition] WebOS 100% complete source code (vue3 + element-plus + vite + pinia)

## Microi Code-Related Documents
>* **Official Documents**：[https://microi.net](https://microi.net)
>* **CSDN Platform Documentation**：[https://blog.csdn.net/qq973702/category_12826294.html](https://blog.csdn.net/qq973702/category_12826294.html)
>* **CSDN Success Stories**：[https://blog.csdn.net/qq973702/category_12828272.html](https://blog.csdn.net/qq973702/category_12828272.html)
>* **CSDN open source project based on my code**：[https://blog.csdn.net/qq973702/category_12828230.html](https://blog.csdn.net/qq973702/category_12828230.html)

