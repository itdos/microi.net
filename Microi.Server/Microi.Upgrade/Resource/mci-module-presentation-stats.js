/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：mci-module-presentation-stats
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: mci-module-presentation-stats
 * Version: v1.0.7
 * Function:
 * - 为模块顶部指标、菜单与页签角标提供权限感知的批量只读统计；任务调度启用数按真实“正常”状态统计。
 */

/* mci-module-presentation-stats v1.0.0
 * Read-only, permission-aware statistics for audited system modules.
 * Security: table names and predicates come only from this server-side whitelist.
 * Client supplied TableName/Where values are intentionally ignored.
 */
var CONFIG = {"61b7faee-35b2-4571-add2-5231a355f368":{"Table":"sys_microistore","MenuWhere":[["Status","=","Offline"]],"Tabs":{"01KMARKETPLACEPLATFORM001":{"Table":"sys_microistore","Where":[["ApplicationType","=","Platform"]]},"01KMICROISTOREINSTALLED001":{"Table":"sys_microistoreversion","Where":[]},"01KMICROISTOREPUBLISHED001":{"Table":"sys_microistore","Where":[]},"01KMARKETPLACEUNIAPP0001":{"Table":"sys_microistore","Where":[["ApplicationType","=","UniApp"]]},"01KMARKETPLACEWEB0000001":{"Table":"sys_microistore","Where":[["ApplicationType","=","Web"]]},"01KMARKETPLACEMICROSVC001":{"Table":"sys_microistore","Where":[["ApplicationType","=","MicroService"]]}},"Metrics":{"Metric_0_LATFORM001":{"Table":"sys_microistore","Where":[["ApplicationType","=","Platform"]]},"Metric_1_UNIAPP0001":{"Table":"sys_microistore","Where":[["ApplicationType","=","UniApp"]]}}},"01KXFSG7MZ40CY8KCWCZZZJH2M":{"Table":"sys_microistore","MenuWhere":[["Status","=","Offline"]],"Tabs":{"01KMARKETPLACEPLATFORM001":{"Table":"sys_microistore","Where":[["ApplicationType","=","Platform"]]},"01KMICROISTOREINSTALLED001":{"Table":"sys_microistoreversion","Where":[]},"01KMICROISTOREPUBLISHED001":{"Table":"sys_microistore","Where":[]},"01KMARKETPLACEUNIAPP0001":{"Table":"sys_microistore","Where":[["ApplicationType","=","UniApp"]]},"01KMARKETPLACEWEB0000001":{"Table":"sys_microistore","Where":[["ApplicationType","=","Web"]]},"01KMARKETPLACEMICROSVC001":{"Table":"sys_microistore","Where":[["ApplicationType","=","MicroService"]]}},"Metrics":{"Metric_0_LATFORM001":{"Table":"sys_microistore","Where":[["ApplicationType","=","Platform"]]},"Metric_1_UNIAPP0001":{"Table":"sys_microistore","Where":[["ApplicationType","=","UniApp"]]}}},"01KXFSG8153B3VZPZ45WNCCFHR":{"Table":"sys_microistoreversion","MenuWhere":[["InstallStatus","=","Abnormal"]],"Tabs":{"01KMARKETPLACEPLATFORM001":{"Table":"sys_microistore","Where":[["ApplicationType","=","Platform"]]},"01KMICROISTOREINSTALLED001":{"Table":"sys_microistoreversion","Where":[]},"01KMICROISTOREPUBLISHED001":{"Table":"sys_microistore","Where":[]},"01KMARKETPLACEUNIAPP0001":{"Table":"sys_microistore","Where":[["ApplicationType","=","UniApp"]]},"01KMARKETPLACEWEB0000001":{"Table":"sys_microistore","Where":[["ApplicationType","=","Web"]]},"01KMARKETPLACEMICROSVC001":{"Table":"sys_microistore","Where":[["ApplicationType","=","MicroService"]]}},"Metrics":{"Metric_0_LATFORM001":{"Table":"sys_microistore","Where":[["ApplicationType","=","Platform"]]},"Metric_1_UNIAPP0001":{"Table":"sys_microistore","Where":[["ApplicationType","=","UniApp"]]}}},"f873af6b-7577-44e0-b9a7-67027b54ace6":{"Table":"sys_apiengine","MenuWhere":[],"Tabs":{"3d989a95-ed5d-4a87-a2bf-b418dff2fd30":{"Table":"sys_apiengine","Where":[]},"11d228aa-bbba-4681-b69e-2de99e6f52f6":{"Table":"sys_apiengine","Where":[["Category","=","系统"]]},"b07a0f0e-976c-4e12-8c57-76baceafccf3":{"Table":"sys_apiengine","Where":[["Category","=","业务"]]},"31bc0812-4f66-49d0-9870-3f7b02d51166":{"Table":"sys_apiengine","Where":[["Category","=","飞书"]]},"ac3961c2-1f4c-48c5-8070-a0f16d4156ba":{"Table":"sys_apiengine","Where":[["Category","=","测试"]]},"e752c46c-7a43-4ddc-9079-637ceda14efe":{"Table":"sys_apiengine","Where":[["Category","=","微信"]]},"8edab2f5-285c-4a78-bd61-c6897f5e69a7":{"Table":"sys_apiengine","Where":[["Category","=","其它"],["Category","=","微信"]]}},"Metrics":{"Metric_0_e99e6f52f6":{"Table":"sys_apiengine","Where":[["Category","=","系统"]]},"Metric_1_baceafccf3":{"Table":"sys_apiengine","Where":[["Category","=","业务"]]}}},"01KWRC0GN2YVAA3D3DA8ENNVGV":{"Table":"sys_microistore","MenuWhere":[["Status","=","Offline"]],"Tabs":{"01KAIAPPTABALL000000000001":{"Table":"sys_microistore","Where":[]},"01KAIAPPTABWEB000000000001":{"Table":"sys_microistore","Where":[["ApplicationType","=","Web"]]},"01KAIAPPTABUNI000000000001":{"Table":"sys_microistore","Where":[["ApplicationType","=","UniApp"]]},"01KAIAPPTABMIC000000000001":{"Table":"sys_microistore","Where":[["ApplicationType","=","MicroService"]]},"01KAIAPPTABDRAFT0000000001":{"Table":"sys_microistore","Where":[["Status","=","Draft"]]},"01KAIAPPTABPUB000000000001":{"Table":"sys_microistore","Where":[["Status","=","Published"]]}},"Metrics":{"Metric_0_0000000001":{"Table":"sys_microistore","Where":[["ApplicationType","=","Web"]]},"Metric_1_0000000001":{"Table":"sys_microistore","Where":[["ApplicationType","=","UniApp"]]}}},"90ebdc4a-47a7-4c96-bb51-b15b757ff6ce":{"Table":"sys_menu","MenuWhere":[["Display","=","0"]],"Tabs":{},"Metrics":{"Metric_2_Display":{"Table":"sys_menu","Where":[["Display","=",1]]},"Metric_3_AppDisplay":{"Table":"sys_menu","Where":[["AppDisplay","=",1]]}}},"cc4faf05-2d4c-480b-9304-b549504bdb5b":{"Table":"microi_database","MenuWhere":[["IsEnable","=","0"]],"Tabs":{"mci-cc4faf05-all":{"Table":"microi_database","Where":[]},"mci-cc4faf05-IsEnable-0":{"Table":"microi_database","Where":[["IsEnable","=","1"]]},"mci-cc4faf05-IsEnable-1":{"Table":"microi_database","Where":[["IsEnable","=","0"]]}},"Metrics":{"Metric_0_5IsEnable0":{"Table":"microi_database","Where":[["IsEnable","=","1"]]},"Metric_1_5IsEnable1":{"Table":"microi_database","Where":[["IsEnable","=","0"]]}}},"0616395a-453f-4367-8c18-5784daca4ff2":{"Table":"mic_page","MenuWhere":[],"Tabs":{},"Metrics":{}},"01KK9865PN34C97FG0W8AF33PB":{"Table":"mic_data_dashboard","MenuWhere":[],"Tabs":{"mci-01KK9865-all":{"Table":"mic_data_dashboard","Where":[]},"mci-01KK9865-State-0":{"Table":"mic_data_dashboard","Where":[["State","=","-1"]]},"mci-01KK9865-State-1":{"Table":"mic_data_dashboard","Where":[["State","=","1"]]}},"Metrics":{"Metric_0_9865State0":{"Table":"mic_data_dashboard","Where":[["State","=","-1"]]},"Metric_1_9865State1":{"Table":"mic_data_dashboard","Where":[["State","=","1"]]}}},"d5ca0be2-3966-4205-8fa5-d5b044f9f639":{"Table":"wf_flowdesign","MenuWhere":[["IsEnable","=","0"]],"Tabs":{"mci-d5ca0be2-all":{"Table":"wf_flowdesign","Where":[]},"mci-d5ca0be2-IsEnable-0":{"Table":"wf_flowdesign","Where":[["IsEnable","=","1"]]},"mci-d5ca0be2-IsEnable-1":{"Table":"wf_flowdesign","Where":[["IsEnable","=","0"]]}},"Metrics":{"Metric_0_2IsEnable0":{"Table":"wf_flowdesign","Where":[["IsEnable","=","1"]]},"Metric_1_2IsEnable1":{"Table":"wf_flowdesign","Where":[["IsEnable","=","0"]]}}},"42078414-512a-4840-9843-9b75ab79ba79":{"Table":"sys_osclients","MenuWhere":[["IsEnable","=","0"]],"Tabs":{"mci-42078414-all":{"Table":"sys_osclients","Where":[]},"mci-42078414-IsEnable-0":{"Table":"sys_osclients","Where":[["IsEnable","=","1"]]},"mci-42078414-IsEnable-1":{"Table":"sys_osclients","Where":[["IsEnable","=","0"]]}},"Metrics":{"Metric_0_4IsEnable0":{"Table":"sys_osclients","Where":[["IsEnable","=","1"]]},"Metric_1_4IsEnable1":{"Table":"sys_osclients","Where":[["IsEnable","=","0"]]}}},"772f361d-d420-4762-9e0b-1ee8e680e92e":{"Table":"Rpt_Report","MenuWhere":[["IsEnable","=","0"]],"Tabs":{"mci-772f361d-all":{"Table":"Rpt_Report","Where":[]},"mci-772f361d-IsEnable-0":{"Table":"Rpt_Report","Where":[["IsEnable","=","1"]]},"mci-772f361d-IsEnable-1":{"Table":"Rpt_Report","Where":[["IsEnable","=","0"]]}},"Metrics":{"Metric_0_dIsEnable0":{"Table":"Rpt_Report","Where":[["IsEnable","=","1"]]},"Metric_1_dIsEnable1":{"Table":"Rpt_Report","Where":[["IsEnable","=","0"]]}}},"b08cce71-3a9e-4c4c-a2af-b0936b47b9a8":{"Table":"diy_schedule_job","MenuWhere":[],"Tabs":{},"Metrics":{"Metric_2_Status":{"Table":"diy_schedule_job","Where":[["Status","=","Enabled"]]}}},"eb621357-b759-41db-a58c-f45d50c93d5b":{"Table":"diy_queue_receive","MenuWhere":[],"Tabs":{},"Metrics":{}},"0e25ec63-89e2-460c-8e33-3373fae7caa5":{"Table":"mic_print","MenuWhere":[],"Tabs":{},"Metrics":{}},"ce9443c2-3887-4b37-bd54-abcecb57695d":{"Table":"diy_LeftJoinRightView","MenuWhere":[],"Tabs":{},"Metrics":{}},"4aa7036f-92e7-457e-8ddb-5f7461f75d5f":{"Table":"diy_field","MenuWhere":[["NotEmpty","=","0"]],"Tabs":{},"Metrics":{}},"f2dde5c7-d993-4959-86b6-96286649e4e7":{"Table":"diy_license","MenuWhere":[["Status","=","Pending"]],"Tabs":{"mci-f2dde5c7-all":{"Table":"diy_license","Where":[]},"mci-f2dde5c7-Status-0":{"Table":"diy_license","Where":[["Status","=","Pending"]]},"mci-f2dde5c7-Status-1":{"Table":"diy_license","Where":[["Status","=","Issued"]]},"mci-f2dde5c7-Status-2":{"Table":"diy_license","Where":[["Status","=","Rejected"]]}},"Metrics":{"Metric_0_5c7Status0":{"Table":"diy_license","Where":[["Status","=","Pending"]]},"Metric_1_5c7Status1":{"Table":"diy_license","Where":[["Status","=","Issued"]]}}},"b7fcf894-782f-4bc8-966f-9bcf486f41db":{"Table":"microi_print_template","MenuWhere":[],"Tabs":{},"Metrics":{}},"01KJ8AAPZVHAQKY9E5JXE511MW":{"Table":"mic_ai_record","MenuWhere":[],"Tabs":{},"Metrics":{}},"53f97f9d-15de-434a-8a06-5924417ae9d4":{"Table":"sys_microiservice","MenuWhere":[["IsEnable","=","0"]],"Tabs":{"mci-53f97f9d-all":{"Table":"sys_microiservice","Where":[]},"mci-53f97f9d-IsEnable-0":{"Table":"sys_microiservice","Where":[["IsEnable","=","1"]]},"mci-53f97f9d-IsEnable-1":{"Table":"sys_microiservice","Where":[["IsEnable","=","0"]]}},"Metrics":{"Metric_0_dIsEnable0":{"Table":"sys_microiservice","Where":[["IsEnable","=","1"]]},"Metric_1_dIsEnable1":{"Table":"sys_microiservice","Where":[["IsEnable","=","0"]]}}},"96de82ce-bf8d-4998-ab19-5eae581b87e3":{"Table":"diy_license_log","MenuWhere":[],"Tabs":{},"Metrics":{}},"dea581fd-a6ed-4f63-a320-6e21f46fce13":{"Table":"sys_datasource","MenuWhere":[["IsEnable","=","0"]],"Tabs":{"mci-dea581fd-all":{"Table":"sys_datasource","Where":[]},"mci-dea581fd-IsEnable-0":{"Table":"sys_datasource","Where":[["IsEnable","=","1"]]},"mci-dea581fd-IsEnable-1":{"Table":"sys_datasource","Where":[["IsEnable","=","0"]]}},"Metrics":{"Metric_0_dIsEnable0":{"Table":"sys_datasource","Where":[["IsEnable","=","1"]]},"Metric_1_dIsEnable1":{"Table":"sys_datasource","Where":[["IsEnable","=","0"]]}}},"914f07af-ee2c-4712-b990-a5b1c51f41d4":{"Table":"diy_table","MenuWhere":[],"Tabs":{},"Metrics":{}},"01KGPN73HXRF9XNAEXWBE1H1QP":{"Table":"diy_field","MenuWhere":[["NotEmpty","=","0"]],"Tabs":{},"Metrics":{}},"d0c7a74a-2cfd-41c0-8902-440909f5f30c":{"Table":"diy_component","MenuWhere":[["Disable","=","0"]],"Tabs":{},"Metrics":{}},"01KWA5Q0C87GK2192PP16F7FG3":{"Table":"mci_spider_site","MenuWhere":[["Status","=","停用"]],"Tabs":{"mci-01KWA5Q0-all":{"Table":"mci_spider_site","Where":[]},"mci-01KWA5Q0-Status-0":{"Table":"mci_spider_site","Where":[["Status","=","启用"]]},"mci-01KWA5Q0-Status-1":{"Table":"mci_spider_site","Where":[["Status","=","停用"]]}},"Metrics":{"Metric_0_5Q0Status0":{"Table":"mci_spider_site","Where":[["Status","=","启用"]]},"Metric_1_5Q0Status1":{"Table":"mci_spider_site","Where":[["Status","=","停用"]]}}},"01KWA5Q0QN3GPWVS08JJY3G6WR":{"Table":"mci_spider_account","MenuWhere":[["LoginStatus","=","失效"]],"Tabs":{"mci-01KWA5Q0-all":{"Table":"mci_spider_account","Where":[]},"mci-01KWA5Q0-LoginStatus-0":{"Table":"mci_spider_account","Where":[["LoginStatus","=","未登录"]]},"mci-01KWA5Q0-LoginStatus-1":{"Table":"mci_spider_account","Where":[["LoginStatus","=","已登录"]]},"mci-01KWA5Q0-LoginStatus-2":{"Table":"mci_spider_account","Where":[["LoginStatus","=","需人工"]]},"mci-01KWA5Q0-LoginStatus-3":{"Table":"mci_spider_account","Where":[["LoginStatus","=","失效"]]}},"Metrics":{"Metric_0_ginStatus0":{"Table":"mci_spider_account","Where":[["LoginStatus","=","未登录"]]},"Metric_1_ginStatus1":{"Table":"mci_spider_account","Where":[["LoginStatus","=","已登录"]]}}},"01KWA5Q11ZBBTQDPDZS810NKDZ":{"Table":"mci_spider_rule","MenuWhere":[["Status","=","停用"]],"Tabs":{"mci-01KWA5Q1-all":{"Table":"mci_spider_rule","Where":[]},"mci-01KWA5Q1-Status-0":{"Table":"mci_spider_rule","Where":[["Status","=","启用"]]},"mci-01KWA5Q1-Status-1":{"Table":"mci_spider_rule","Where":[["Status","=","停用"]]},"mci-01KWA5Q1-Status-2":{"Table":"mci_spider_rule","Where":[["Status","=","草稿"]]}},"Metrics":{"Metric_0_5Q1Status0":{"Table":"mci_spider_rule","Where":[["Status","=","启用"]]},"Metric_1_5Q1Status1":{"Table":"mci_spider_rule","Where":[["Status","=","停用"]]}}},"01KWA5Q1CJJTX6X1DF9A16H9MR":{"Table":"mci_spider_worker","MenuWhere":[["Status","=","异常"]],"Tabs":{"mci-01KWA5Q1-all":{"Table":"mci_spider_worker","Where":[]},"mci-01KWA5Q1-Status-0":{"Table":"mci_spider_worker","Where":[["Status","=","在线"]]},"mci-01KWA5Q1-Status-1":{"Table":"mci_spider_worker","Where":[["Status","=","离线"]]},"mci-01KWA5Q1-Status-2":{"Table":"mci_spider_worker","Where":[["Status","=","忙碌"]]},"mci-01KWA5Q1-Status-3":{"Table":"mci_spider_worker","Where":[["Status","=","异常"]]}},"Metrics":{"Metric_0_5Q1Status0":{"Table":"mci_spider_worker","Where":[["Status","=","在线"]]},"Metric_1_5Q1Status1":{"Table":"mci_spider_worker","Where":[["Status","=","离线"]]}}},"01KWA5Q1QEYVJQJD5ZW5SD3RJ9":{"Table":"mci_spider_profile","MenuWhere":[["LoginStatus","=","失效"]],"Tabs":{"mci-01KWA5Q1-all":{"Table":"mci_spider_profile","Where":[]},"mci-01KWA5Q1-LoginStatus-0":{"Table":"mci_spider_profile","Where":[["LoginStatus","=","未登录"]]},"mci-01KWA5Q1-LoginStatus-1":{"Table":"mci_spider_profile","Where":[["LoginStatus","=","已登录"]]},"mci-01KWA5Q1-LoginStatus-2":{"Table":"mci_spider_profile","Where":[["LoginStatus","=","需人工"]]},"mci-01KWA5Q1-LoginStatus-3":{"Table":"mci_spider_profile","Where":[["LoginStatus","=","失效"]]}},"Metrics":{"Metric_0_ginStatus0":{"Table":"mci_spider_profile","Where":[["LoginStatus","=","未登录"]]},"Metric_1_ginStatus1":{"Table":"mci_spider_profile","Where":[["LoginStatus","=","已登录"]]}}},"01KWA5Q20NCJTPF3A7YXFG5QTD":{"Table":"mci_spider_task","MenuWhere":[["Status","=","失败"]],"Tabs":{"00MQZH39COBRXMUEAO2C600000":{"Table":"mci_spider_task","Where":[]},"00MQZH39COOOG9MDDQ6R000000":{"Table":"mci_spider_task","Where":[["Status","=","待执行"]]},"00MQZH39CO3VGTUE6FMUE00000":{"Table":"mci_spider_task","Where":[["Status","=","等待人工"]]},"00MQZH39CO51UAIR13OXK00000":{"Table":"mci_spider_task","Where":[["Status","=","失败"]]}},"Metrics":{"Metric_0_DQ6R000000":{"Table":"mci_spider_task","Where":[["Status","=","待执行"]]},"Metric_1_6FMUE00000":{"Table":"mci_spider_task","Where":[["Status","=","等待人工"]]}}},"01KWA5Q2AFF3X1PK2RF0WDYWA8":{"Table":"mci_spider_task_step","MenuWhere":[["Status","=","失败"]],"Tabs":{"mci-01KWA5Q2-all":{"Table":"mci_spider_task_step","Where":[]},"mci-01KWA5Q2-Status-0":{"Table":"mci_spider_task_step","Where":[["Status","=","待执行"]]},"mci-01KWA5Q2-Status-1":{"Table":"mci_spider_task_step","Where":[["Status","=","执行中"]]},"mci-01KWA5Q2-Status-2":{"Table":"mci_spider_task_step","Where":[["Status","=","成功"]]},"mci-01KWA5Q2-Status-3":{"Table":"mci_spider_task_step","Where":[["Status","=","失败"]]},"mci-01KWA5Q2-Status-4":{"Table":"mci_spider_task_step","Where":[["Status","=","跳过"]]}},"Metrics":{"Metric_0_5Q2Status0":{"Table":"mci_spider_task_step","Where":[["Status","=","待执行"]]},"Metric_1_5Q2Status1":{"Table":"mci_spider_task_step","Where":[["Status","=","执行中"]]}}},"01KWA5Q2KQWKGPV9NFX16EB6YS":{"Table":"mci_spider_artifact","MenuWhere":[],"Tabs":{},"Metrics":{}},"01KWA5Q2YXQYSCJH469QR95M05":{"Table":"mci_spider_result","MenuWhere":[["Status","=","异常"]],"Tabs":{"mci-01KWA5Q2-all":{"Table":"mci_spider_result","Where":[]},"mci-01KWA5Q2-Status-0":{"Table":"mci_spider_result","Where":[["Status","=","有效"]]},"mci-01KWA5Q2-Status-1":{"Table":"mci_spider_result","Where":[["Status","=","缺答案"]]},"mci-01KWA5Q2-Status-2":{"Table":"mci_spider_result","Where":[["Status","=","重复"]]},"mci-01KWA5Q2-Status-3":{"Table":"mci_spider_result","Where":[["Status","=","异常"]]}},"Metrics":{"Metric_0_5Q2Status0":{"Table":"mci_spider_result","Where":[["Status","=","有效"]]},"Metric_1_5Q2Status1":{"Table":"mci_spider_result","Where":[["Status","=","缺答案"]]}}},"01KWA5Q389AKG3322NARSGWZ0Q":{"Table":"mci_spider_export","MenuWhere":[["Status","=","失败"]],"Tabs":{"mci-01KWA5Q3-all":{"Table":"mci_spider_export","Where":[]},"mci-01KWA5Q3-Status-0":{"Table":"mci_spider_export","Where":[["Status","=","已生成"]]},"mci-01KWA5Q3-Status-1":{"Table":"mci_spider_export","Where":[["Status","=","失败"]]}},"Metrics":{"Metric_0_5Q3Status0":{"Table":"mci_spider_export","Where":[["Status","=","已生成"]]},"Metric_1_5Q3Status1":{"Table":"mci_spider_export","Where":[["Status","=","失败"]]}}},"a07fd4e0-fdd2-4c0e-8565-88a28db7d3e7":{"Table":"diy_lang","MenuWhere":[],"Tabs":{},"Metrics":{}},"01KW1ERYZ7M810Q5HW85Y0DNNW":{"Table":"mci_lang_init_log","MenuWhere":[["Status","=","Failed"]],"Tabs":{"mci-01KW1ERY-all":{"Table":"mci_lang_init_log","Where":[]},"mci-01KW1ERY-Status-0":{"Table":"mci_lang_init_log","Where":[["Status","=","Running"]]},"mci-01KW1ERY-Status-1":{"Table":"mci_lang_init_log","Where":[["Status","=","Success"]]},"mci-01KW1ERY-Status-2":{"Table":"mci_lang_init_log","Where":[["Status","=","Partial"]]},"mci-01KW1ERY-Status-3":{"Table":"mci_lang_init_log","Where":[["Status","=","Failed"]]}},"Metrics":{"Metric_0_ERYStatus0":{"Table":"mci_lang_init_log","Where":[["Status","=","Running"]]},"Metric_1_ERYStatus1":{"Table":"mci_lang_init_log","Where":[["Status","=","Success"]]}}},"01KW6Q2TF6Q8T8X4DEH87HQT5N":{"Table":"mci_security_attack_event","MenuWhere":[["Status","=","Blocked"]],"Tabs":{"mci-01KW6Q2T-all":{"Table":"mci_security_attack_event","Where":[]},"mci-01KW6Q2T-Status-0":{"Table":"mci_security_attack_event","Where":[["Status","=","Pending"]]},"mci-01KW6Q2T-Status-1":{"Table":"mci_security_attack_event","Where":[["Status","=","Blocked"]]},"mci-01KW6Q2T-Status-2":{"Table":"mci_security_attack_event","Where":[["Status","=","Ignored"]]},"mci-01KW6Q2T-Status-3":{"Table":"mci_security_attack_event","Where":[["Status","=","Resolved"]]}},"Metrics":{"Metric_0_Q2TStatus0":{"Table":"mci_security_attack_event","Where":[["Status","=","Pending"]]},"Metric_1_Q2TStatus1":{"Table":"mci_security_attack_event","Where":[["Status","=","Blocked"]]}}},"01KW6Q2TT4W3YPDQ06T8X1PXPC":{"Table":"mci_security_ip_block","MenuWhere":[],"Tabs":{"mci-01KW6Q2T-all":{"Table":"mci_security_ip_block","Where":[]},"mci-01KW6Q2T-Status-0":{"Table":"mci_security_ip_block","Where":[["Status","=","Active"]]},"mci-01KW6Q2T-Status-1":{"Table":"mci_security_ip_block","Where":[["Status","=","Expired"]]},"mci-01KW6Q2T-Status-2":{"Table":"mci_security_ip_block","Where":[["Status","=","Unblocked"]]}},"Metrics":{"Metric_0_Q2TStatus0":{"Table":"mci_security_ip_block","Where":[["Status","=","Active"]]},"Metric_1_Q2TStatus1":{"Table":"mci_security_ip_block","Where":[["Status","=","Expired"]]}}},"01KW6Q2V343B07RWR28NAPJTJW":{"Table":"mci_security_access_log","MenuWhere":[["RiskLevel","=","Blocked"]],"Tabs":{"mci-01KW6Q2V-all":{"Table":"mci_security_access_log","Where":[]},"mci-01KW6Q2V-RiskLevel-0":{"Table":"mci_security_access_log","Where":[["RiskLevel","=","Info"]]},"mci-01KW6Q2V-RiskLevel-1":{"Table":"mci_security_access_log","Where":[["RiskLevel","=","Warn"]]},"mci-01KW6Q2V-RiskLevel-2":{"Table":"mci_security_access_log","Where":[["RiskLevel","=","Blocked"]]}},"Metrics":{"Metric_0_RiskLevel0":{"Table":"mci_security_access_log","Where":[["RiskLevel","=","Info"]]},"Metric_1_RiskLevel1":{"Table":"mci_security_access_log","Where":[["RiskLevel","=","Warn"]]}}},"36b0f2cf-e176-4d81-be6e-a306f492f59f":{"Table":"mci_mqtt_client","MenuWhere":[["IsOnline","=","0"]],"Tabs":{},"Metrics":{"Metric_2_IsOnline":{"Table":"mci_mqtt_client","Where":[["IsOnline","=",1]]}}},"2a1292d5-32ed-410f-89d8-38dca487d181":{"Table":"mci_mqtt_log","MenuWhere":[],"Tabs":{},"Metrics":{}},"01KVFNEFC58CHR4BNQKE5SAQFZ":{"Table":"sys_microiservice_page","MenuWhere":[["IsEnable","=","0"]],"Tabs":{"mci-01KVFNEF-all":{"Table":"sys_microiservice_page","Where":[]},"mci-01KVFNEF-IsEnable-0":{"Table":"sys_microiservice_page","Where":[["IsEnable","=","1"]]},"mci-01KVFNEF-IsEnable-1":{"Table":"sys_microiservice_page","Where":[["IsEnable","=","0"]]}},"Metrics":{"Metric_0_FIsEnable0":{"Table":"sys_microiservice_page","Where":[["IsEnable","=","1"]]},"Metric_1_FIsEnable1":{"Table":"sys_microiservice_page","Where":[["IsEnable","=","0"]]}}},"48a11346-3b52-467a-9a41-86ec3dc6c975":{"Table":"diy_sso","MenuWhere":[["IsEnable","=","0"]],"Tabs":{"mci-48a11346-all":{"Table":"diy_sso","Where":[]},"mci-48a11346-IsEnable-0":{"Table":"diy_sso","Where":[["IsEnable","=","1"]]},"mci-48a11346-IsEnable-1":{"Table":"diy_sso","Where":[["IsEnable","=","0"]]}},"Metrics":{"Metric_0_6IsEnable0":{"Table":"diy_sso","Where":[["IsEnable","=","1"]]},"Metric_1_6IsEnable1":{"Table":"diy_sso","Where":[["IsEnable","=","0"]]}}},"8055d6d9-5065-43c6-938c-6a3d9fbd1d36":{"Table":"diy_tenant","MenuWhere":[],"Tabs":{},"Metrics":{}},"84785a58-fb78-4742-8aef-de9dd9bd6a31":{"Table":"diy_wallpaper","MenuWhere":[["IsEnable","=","0"]],"Tabs":{"mci-84785a58-all":{"Table":"diy_wallpaper","Where":[]},"mci-84785a58-IsEnable-0":{"Table":"diy_wallpaper","Where":[["IsEnable","=","1"]]},"mci-84785a58-IsEnable-1":{"Table":"diy_wallpaper","Where":[["IsEnable","=","0"]]}},"Metrics":{"Metric_0_8IsEnable0":{"Table":"diy_wallpaper","Where":[["IsEnable","=","1"]]},"Metric_1_8IsEnable1":{"Table":"diy_wallpaper","Where":[["IsEnable","=","0"]]}}},"a283360d-9f1f-43d3-9380-074d60b87375":{"Table":"microi_calendar","MenuWhere":[],"Tabs":{"mci-a283360d-all":{"Table":"microi_calendar","Where":[]},"mci-a283360d-State-0":{"Table":"microi_calendar","Where":[["State","=","0"]]},"mci-a283360d-State-1":{"Table":"microi_calendar","Where":[["State","=","1"]]}},"Metrics":{"Metric_0_360dState0":{"Table":"microi_calendar","Where":[["State","=","0"]]},"Metric_1_360dState1":{"Table":"microi_calendar","Where":[["State","=","1"]]}}},"ca93d252-b69b-474a-81da-89c0f8657692":{"Table":"diy_queue_receive_log","MenuWhere":[],"Tabs":{},"Metrics":{"Metric_2_Status":{"Table":"diy_queue_receive_log","Where":[["Status","=","Enabled"]]}}},"e1d58be1-85fe-4a47-a504-3f15ef77b287":{"Table":"mic_email_server","MenuWhere":[],"Tabs":{},"Metrics":{}},"4ddeb83f-dc36-4aab-85c2-ab9b7bec9b47":{"Table":"mic_msgset","MenuWhere":[["IsEnable","=","0"]],"Tabs":{"mci-4ddeb83f-all":{"Table":"mic_msgset","Where":[]},"mci-4ddeb83f-IsEnable-0":{"Table":"mic_msgset","Where":[["IsEnable","=","1"]]},"mci-4ddeb83f-IsEnable-1":{"Table":"mic_msgset","Where":[["IsEnable","=","0"]]}},"Metrics":{"Metric_0_fIsEnable0":{"Table":"mic_msgset","Where":[["IsEnable","=","1"]]},"Metric_1_fIsEnable1":{"Table":"mic_msgset","Where":[["IsEnable","=","0"]]}}},"33441a33-de79-4e8a-ae65-b96175e1d334":{"Table":"sys_user","MenuWhere":[["State","=","0"]],"Tabs":{"mci-33441a33-all":{"Table":"sys_user","Where":[]},"mci-33441a33-State-0":{"Table":"sys_user","Where":[["State","=","1"]]},"mci-33441a33-State-1":{"Table":"sys_user","Where":[["State","=","0"]]}},"Metrics":{"Metric_0_1a33State0":{"Table":"sys_user","Where":[["State","=","1"]]},"Metric_1_1a33State1":{"Table":"sys_user","Where":[["State","=","0"]]}}},"01KRS6GSD5VSKHMPYNBN4D8A65":{"Table":"diy_job","MenuWhere":[],"Tabs":{},"Metrics":{}},"d264cab5-c2f9-400b-85cc-cf12bf342f00":{"Table":"sys_basedata","MenuWhere":[],"Tabs":{},"Metrics":{}},"13fbe90c-b676-4c94-af69-861afae8a06d":{"Table":"microi_icon","MenuWhere":[["IsEnable","=","0"]],"Tabs":{"mci-13fbe90c-all":{"Table":"microi_icon","Where":[]},"mci-13fbe90c-IsEnable-0":{"Table":"microi_icon","Where":[["IsEnable","=","1"]]},"mci-13fbe90c-IsEnable-1":{"Table":"microi_icon","Where":[["IsEnable","=","0"]]}},"Metrics":{"Metric_0_cIsEnable0":{"Table":"microi_icon","Where":[["IsEnable","=","1"]]},"Metric_1_cIsEnable1":{"Table":"microi_icon","Where":[["IsEnable","=","0"]]}}},"ea6b79e8-2c6b-4d0f-9b6a-44d01a3479bf":{"Table":"Sys_Config","MenuWhere":[["IsEnable","=","0"]],"Tabs":{"mci-ea6b79e8-all":{"Table":"Sys_Config","Where":[]},"mci-ea6b79e8-IsEnable-0":{"Table":"Sys_Config","Where":[["IsEnable","=","1"]]},"mci-ea6b79e8-IsEnable-1":{"Table":"Sys_Config","Where":[["IsEnable","=","0"]]}},"Metrics":{"Metric_0_8IsEnable0":{"Table":"Sys_Config","Where":[["IsEnable","=","1"]]},"Metric_1_8IsEnable1":{"Table":"Sys_Config","Where":[["IsEnable","=","0"]]}}},"e64561bd-9198-4f52-9f37-b5dbb677ecaf":{"Table":"wf_nodelist","MenuWhere":[["IsEnable","=","0"]],"Tabs":{"mci-e64561bd-all":{"Table":"wf_nodelist","Where":[]},"mci-e64561bd-IsEnable-0":{"Table":"wf_nodelist","Where":[["IsEnable","=","1"]]},"mci-e64561bd-IsEnable-1":{"Table":"wf_nodelist","Where":[["IsEnable","=","0"]]}},"Metrics":{"Metric_0_dIsEnable0":{"Table":"wf_nodelist","Where":[["IsEnable","=","1"]]},"Metric_1_dIsEnable1":{"Table":"wf_nodelist","Where":[["IsEnable","=","0"]]}}},"29ae2648-10bb-489e-ba78-64a43f233141":{"Table":"diy_schedule_job_log","MenuWhere":[],"Tabs":{},"Metrics":{}},"5380cf1b-cd4c-4587-a42d-506449284d8b":{"Table":"mic_msg_event_log","MenuWhere":[["IsSuccess","=","0"]],"Tabs":{"mci-5380cf1b-all":{"Table":"mic_msg_event_log","Where":[]},"mci-5380cf1b-IsSuccess-0":{"Table":"mic_msg_event_log","Where":[["IsSuccess","=","1"]]},"mci-5380cf1b-IsSuccess-1":{"Table":"mic_msg_event_log","Where":[["IsSuccess","=","0"]]}},"Metrics":{"Metric_0_IsSuccess0":{"Table":"mic_msg_event_log","Where":[["IsSuccess","=","1"]]},"Metric_1_IsSuccess1":{"Table":"mic_msg_event_log","Where":[["IsSuccess","=","0"]]}}},"8c97b9ed-bafe-46de-a0e5-a1660f5e346c":{"Table":"sys_servernode","MenuWhere":[["IsEnable","=","0"]],"Tabs":{"mci-8c97b9ed-all":{"Table":"sys_servernode","Where":[]},"mci-8c97b9ed-IsEnable-0":{"Table":"sys_servernode","Where":[["IsEnable","=","1"]]},"mci-8c97b9ed-IsEnable-1":{"Table":"sys_servernode","Where":[["IsEnable","=","0"]]}},"Metrics":{"Metric_0_dIsEnable0":{"Table":"sys_servernode","Where":[["IsEnable","=","1"]]},"Metric_1_dIsEnable1":{"Table":"sys_servernode","Where":[["IsEnable","=","0"]]}}},"c92c01c1-2d01-47dd-88e3-a6213716aeec":{"Table":"diy_test","MenuWhere":[["ShifouYZJ","=","0"]],"Tabs":{"ac52f694-796f-4322-86b2-f3c496366f71":{"Table":"diy_test","Where":[]},"b043f224-092d-4921-915e-c53cffc8983e":{"Table":"diy_test","Where":[]}},"Metrics":{}}};

// 任务调度的真实持久化状态为“正常/暂停”。旧展示配置由英文枚举推断为
// Enabled，导致顶部“启用”指标始终为 0；在可信白名单中固定真实状态值。
CONFIG['b08cce71-3a9e-4c4c-a2af-b0936b47b9a8'].Metrics.Metric_2_Status.Where = [['Status', '=', '正常']];

function toNumber(value) {
    var numberValue = Number(value);
    return isNaN(numberValue) ? 0 : numberValue;
}

var param = V8.Param || {};
var forceRefresh = param.ForceRefresh === true || Number(param.ForceRefresh || 0) === 1 || String(param.ForceRefresh || '').toLowerCase() === 'true';
var currentUserId = V8.CurrentUser && V8.CurrentUser.Id ? String(V8.CurrentUser.Id) : 'anonymous';
var countMemo = {};

function countCacheKey(tableName, whereList) {
    var signature = String(tableName || '') + '|' + JSON.stringify(whereList || []);
    var digest = '';
    try { digest = V8.EncryptHelper.Sha256Hex(signature); }
    catch (ignoreSha) { digest = V8.EncryptHelper.MD5Encrypt(signature); }
    return 'Microi:' + V8.OsClient + ':ModulePresentationCount:' + currentUserId + ':' + digest;
}

function countSignature(tableName, whereList) {
    return String(tableName || '') + '|' + JSON.stringify(whereList || []);
}

function lookupCount(tableName, whereList) {
    if (!tableName) return { Hit: true, Value: 0, Signature: '', CacheKey: '' };
    var signature = countSignature(tableName, whereList);
    if (Object.prototype.hasOwnProperty.call(countMemo, signature)) {
        return { Hit: true, Value: countMemo[signature], Signature: signature, CacheKey: countCacheKey(tableName, whereList) };
    }
    var cacheKey = countCacheKey(tableName, whereList);
    if (!forceRefresh) {
        var cached = V8.Cache.Get(cacheKey);
        if (cached !== null && cached !== undefined && String(cached) !== '') {
            countMemo[signature] = toNumber(cached);
            return { Hit: true, Value: countMemo[signature], Signature: signature, CacheKey: cacheKey };
        }
    }
    return { Hit: false, Value: 0, Signature: signature, CacheKey: cacheKey };
}

function extractCount(result) {
    if (result === null || result === undefined) return 0;
    if (typeof result === 'number' || typeof result === 'string') return toNumber(result);
    if (result.DataCount !== undefined) return toNumber(result.DataCount);
    if (result.Count !== undefined) return toNumber(result.Count);
    if (result.Data !== undefined) {
        if (typeof result.Data === 'number' || typeof result.Data === 'string') return toNumber(result.Data);
        if (result.Data && result.Data.Count !== undefined) return toNumber(result.Data.Count);
        if (result.Data && result.Data.DataCount !== undefined) return toNumber(result.Data.DataCount);
    }
    return 0;
}

function storeCount(signature, cacheKey, value) {
    countMemo[signature] = toNumber(value);
    V8.Cache.Set(cacheKey, String(countMemo[signature]), 10);
    return countMemo[signature];
}

function getCount(tableName, whereList) {
    var lookup = lookupCount(tableName, whereList);
    if (lookup.Hit) return lookup.Value;

    var result = V8.FormEngine.GetTableDataCount(tableName, { _Where: whereList || [] });
    if (result === null || result === undefined) return 0;
    if (result.Code !== undefined && Number(result.Code) !== 1) return 0;
    return storeCount(lookup.Signature, lookup.CacheKey, extractCount(result));
}

function addPrefetchSpec(specs, seen, tableName, whereList) {
    var lookup = lookupCount(tableName, whereList);
    if (lookup.Hit || !lookup.Signature || Object.prototype.hasOwnProperty.call(seen, lookup.Signature)) return;
    seen[lookup.Signature] = true;
    specs.push({
        Table: tableName,
        Where: whereList || [],
        Signature: lookup.Signature,
        CacheKey: lookup.CacheKey
    });
}

function collectMenuCountSpecs(request, specs, seen) {
    request = request || {};
    var menuId = String(request.SysMenuId || request._SysMenuId || '');
    var config = CONFIG[menuId];
    if (!config) return;
    var valueOnly = request.ValueOnly === true
        || Number(request.ValueOnly || 0) === 1
        || String(request.ValueOnly || '').toLowerCase() === 'true';

    if (!valueOnly || !(config.MenuWhere && config.MenuWhere.length)) {
        addPrefetchSpec(specs, seen, config.Table, []);
    }
    if (config.MenuWhere && config.MenuWhere.length) {
        addPrefetchSpec(specs, seen, config.Table, config.MenuWhere);
    }

    var buttonKeys = request.ButtonKeys || [];
    for (var i = 0; i < buttonKeys.length; i++) {
        var buttonKey = String(buttonKeys[i]);
        var tabConfig = config.Tabs ? config.Tabs[buttonKey] : null;
        if (tabConfig) addPrefetchSpec(specs, seen, tabConfig.Table, tabConfig.Where || []);
    }
    var metricKeys = request.MetricKeys || [];
    for (var j = 0; j < metricKeys.length; j++) {
        var metricKey = String(metricKeys[j]);
        var metricConfig = config.Metrics ? config.Metrics[metricKey] : null;
        if (metricConfig) addPrefetchSpec(specs, seen, metricConfig.Table, metricConfig.Where || []);
    }
}

function prefetchMenuCounts(requests, requestLimit) {
    if (!V8.FormEngine || typeof V8.FormEngine.GetTableDataCountBatch !== 'function') return;
    var specs = [];
    var seen = {};
    var limit = Math.min(requests.length, requestLimit);
    for (var requestIndex = 0; requestIndex < limit; requestIndex++) {
        collectMenuCountSpecs(requests[requestIndex], specs, seen);
    }

    for (var offset = 0; offset < specs.length; offset += 64) {
        var batchParams = [];
        var batchSpecs = [];
        var batchEnd = Math.min(offset + 64, specs.length);
        for (var specIndex = offset; specIndex < batchEnd; specIndex++) {
            var spec = specs[specIndex];
            batchSpecs.push(spec);
            batchParams.push({ FormEngineKey: spec.Table, _Where: spec.Where });
        }
        try {
            var batchResult = V8.FormEngine.GetTableDataCountBatch(batchParams);
            if (!batchResult || Number(batchResult.Code) !== 1) continue;
            var rows = batchResult.Data || [];
            for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                var row = rows[rowIndex] || {};
                var resultIndex = toNumber(row.Index);
                if (Number(row.Code) !== 1 || resultIndex < 0 || resultIndex >= batchSpecs.length) continue;
                var matchedSpec = batchSpecs[resultIndex];
                storeCount(matchedSpec.Signature, matchedSpec.CacheKey, row.Count);
            }
        } catch (ignoreBatchCount) {
            // Rolling upgrades may run this engine briefly on an older API node.
            // computeMenu then falls back to the existing single-count calls.
        }
    }
}

function computeMenu(request) {
    request = request || {};
    var menuId = String(request.SysMenuId || request._SysMenuId || '');
    var config = CONFIG[menuId];
    if (!config) {
        return { Value: 0, Count: 0, Total: 0, Buttons: {}, Metrics: {} };
    }

    var valueOnly = request.ValueOnly === true
        || Number(request.ValueOnly || 0) === 1
        || String(request.ValueOnly || '').toLowerCase() === 'true';
    var total = valueOnly ? null : getCount(config.Table, []);
    var menuCount = config.MenuWhere && config.MenuWhere.length
        ? getCount(config.Table, config.MenuWhere)
        : (valueOnly ? getCount(config.Table, []) : total);
    var buttons = {};
    var buttonKeys = request.ButtonKeys || [];
    for (var i = 0; i < buttonKeys.length; i++) {
        var buttonKey = String(buttonKeys[i]);
        var tabConfig = config.Tabs ? config.Tabs[buttonKey] : null;
        if (tabConfig) buttons[buttonKey] = getCount(tabConfig.Table, tabConfig.Where || []);
    }
    var metrics = {};
    var metricKeys = request.MetricKeys || [];
    for (var j = 0; j < metricKeys.length; j++) {
        var metricKey = String(metricKeys[j]);
        var metricConfig = config.Metrics ? config.Metrics[metricKey] : null;
        if (metricConfig) metrics[metricKey] = getCount(metricConfig.Table, metricConfig.Where || []);
    }

    return {
        Value: menuCount,
        Count: menuCount,
        Total: valueOnly ? menuCount : total,
        Buttons: buttons,
        Metrics: metrics
    };
}

var menuRequests = param.MenuRequests || [];
if (menuRequests && menuRequests.length) {
    var menus = {};
    var processed = 0;
    var limit = Math.min(menuRequests.length, 200);
    prefetchMenuCounts(menuRequests, limit);
    for (var requestIndex = 0; requestIndex < limit; requestIndex++) {
        var menuRequest = menuRequests[requestIndex] || {};
        var requestedMenuId = String(menuRequest.SysMenuId || menuRequest._SysMenuId || '');
        if (!requestedMenuId || Object.prototype.hasOwnProperty.call(menus, requestedMenuId)) continue;
        menus[requestedMenuId] = computeMenu(menuRequest);
        processed++;
    }
    return { Code: 1, Data: { Menus: menus, Count: processed, Batched: true } };
}

prefetchMenuCounts([param], 1);
return { Code: 1, Data: computeMenu(param) };
