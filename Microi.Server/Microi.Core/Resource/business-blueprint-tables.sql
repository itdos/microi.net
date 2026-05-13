-- ============================================================
-- Microi 业务架构蓝图（System Blueprint）- MySQL 5.7+ 建表语句
-- 设计意图：每个 OsClient 一份"系统蓝图"，作为AI/人工开发的唯一事实源
-- 三层模型：
--   Layer 1 · 领域层（ER 图：表/字段/外键）
--   Layer 2 · 流程层（跨表业务流转图）
--   Layer 3 · 行为层（V8事件/接口引擎/按钮 绑定到节点）
-- 与现有 wf_flowdesign（审批流，运行时执行）完全独立，互不影响。
-- ============================================================

-- 1. 蓝图主表：每个 OsClient 可有多个蓝图（如 CRM、ERP、进销存…）
CREATE TABLE IF NOT EXISTS `sys_business_blueprint` (
  `Id` VARCHAR(36) NOT NULL COMMENT '主键 Ulid/Guid',
  `OsClient` VARCHAR(50) NOT NULL COMMENT '租户标识',
  `Name` VARCHAR(200) NOT NULL COMMENT '蓝图名称，如 "CRM 客户管理系统"',
  `Code` VARCHAR(100) NULL COMMENT '蓝图编码（可选，用作 URL/导出标识）',
  `Description` VARCHAR(2000) NULL COMMENT '蓝图描述',
  `Version` VARCHAR(20) NULL DEFAULT '1.0' COMMENT '蓝图版本号',
  `RootDiagramId` VARCHAR(50) NULL COMMENT '根图（总体图）Id',
  `BlueprintData` MEDIUMTEXT NULL COMMENT '蓝图全文 JSON（diagrams/domainModel/metadata）',
  `Status` INT NULL DEFAULT 1 COMMENT '状态：0=草稿，1=启用，2=归档',
  `LockedBy` VARCHAR(36) NULL COMMENT '协作锁：当前编辑用户 Id（NULL 表示未锁）',
  `LockedAt` DATETIME NULL COMMENT '加锁时间',
  `LastSyncedSchemaHash` VARCHAR(64) NULL COMMENT '最后同步时的数据库 schema 哈希，用于漂移检测',
  `Sort` INT NULL DEFAULT 0,
  `Remark` VARCHAR(2000) NULL,
  `CreateTime` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateTime` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `CreateUserId` VARCHAR(36) NULL,
  `CreateUserName` VARCHAR(100) NULL,
  `UpdateUserId` VARCHAR(36) NULL,
  `UpdateUserName` VARCHAR(100) NULL,
  `IsDeleted` INT NULL DEFAULT 0,
  PRIMARY KEY (`Id`),
  KEY `idx_blueprint_osclient` (`OsClient`, `IsDeleted`),
  KEY `idx_blueprint_name` (`OsClient`, `Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='业务架构蓝图主表';

-- 2. 蓝图反向关联表：蓝图节点到平台资源（表/字段/接口引擎/菜单/V8事件）的引用关系
--    用途：
--    a) 删表/接口前检查是否被蓝图引用
--    b) AI 生成代码时反向查询某资源属于哪个蓝图节点
--    c) 漂移检测（资源被删除时蓝图标记为不一致）
CREATE TABLE IF NOT EXISTS `sys_blueprint_relation` (
  `Id` VARCHAR(36) NOT NULL,
  `OsClient` VARCHAR(50) NOT NULL,
  `BlueprintId` VARCHAR(36) NOT NULL COMMENT '所属蓝图 Id',
  `DiagramId` VARCHAR(50) NULL COMMENT '所在子图 Id',
  `NodeId` VARCHAR(50) NULL COMMENT '蓝图节点 Id',
  `RelationType` VARCHAR(50) NOT NULL COMMENT '关联类型：table | field | menu | engine | v8event | dataSource | printTemplate | workflow | page | job',
  `RelationKey` VARCHAR(200) NULL COMMENT '资源主键（diy_table.Id / sys_apiengine.ApiEngineKey 等）',
  `RelationName` VARCHAR(200) NULL COMMENT '资源名称（用于展示和漂移检测）',
  `Sort` INT NULL DEFAULT 0,
  `CreateTime` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `IsDeleted` INT NULL DEFAULT 0,
  PRIMARY KEY (`Id`),
  KEY `idx_relation_blueprint` (`OsClient`, `BlueprintId`),
  KEY `idx_relation_resource` (`OsClient`, `RelationType`, `RelationKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='蓝图与平台资源的反向关联表';

-- 3. 蓝图历史快照表：每次保存归档一份，用于回滚和 diff
CREATE TABLE IF NOT EXISTS `sys_blueprint_history` (
  `Id` VARCHAR(36) NOT NULL,
  `OsClient` VARCHAR(50) NOT NULL,
  `BlueprintId` VARCHAR(36) NOT NULL,
  `Version` VARCHAR(20) NULL,
  `BlueprintData` MEDIUMTEXT NULL COMMENT '保存时的完整蓝图 JSON 快照',
  `ChangeSummary` VARCHAR(2000) NULL COMMENT '变更说明（手工填写或 AI 生成）',
  `CreateTime` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `CreateUserId` VARCHAR(36) NULL,
  `CreateUserName` VARCHAR(100) NULL,
  `IsDeleted` INT NULL DEFAULT 0,
  PRIMARY KEY (`Id`),
  KEY `idx_history_blueprint` (`OsClient`, `BlueprintId`, `CreateTime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='蓝图历史快照（用于回滚/diff）';
