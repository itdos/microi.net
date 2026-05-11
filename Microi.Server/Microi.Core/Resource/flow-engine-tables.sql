-- ============================================================
-- Microi 自动化流引擎 (Flow Engine) - MySQL 5.7+
-- 设计意图：低代码可视化编排自动化（trigger → step → step → ...）
--   - 触发器类型：cron / webhook / mq / state-change / manual
--   - 步骤类型：http / sql / apiengine / email / mq / if / delay / loop
--   - 节点 JSON 由前端 X6 设计器生成，由后端通用执行器解释执行
-- ============================================================

-- 1. 自动化流定义
CREATE TABLE IF NOT EXISTS `sys_flow_design` (
  `Id` VARCHAR(36) NOT NULL,
  `OsClient` VARCHAR(50) NOT NULL,
  `Name` VARCHAR(200) NOT NULL,
  `Code` VARCHAR(100) NOT NULL COMMENT '编码，唯一',
  `Description` VARCHAR(2000) NULL,
  `TriggerType` VARCHAR(50) NOT NULL DEFAULT 'manual' COMMENT 'manual|cron|webhook|mq|state-change|api',
  `TriggerConfig` MEDIUMTEXT NULL COMMENT 'JSON：cron 表达式 / webhook 路径 / mq 队列 等',
  `FlowData` MEDIUMTEXT NULL COMMENT 'JSON：{nodes:[],edges:[]} - 由 X6 设计器生成',
  `Status` INT NULL DEFAULT 1 COMMENT '0=禁用 1=启用',
  `MaxRetry` INT NULL DEFAULT 0,
  `Timeout` INT NULL DEFAULT 60 COMMENT '总超时秒',
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
  UNIQUE KEY `uk_flow_code` (`OsClient`, `Code`),
  KEY `idx_flow_trigger` (`OsClient`, `TriggerType`, `Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自动化流定义';

-- 2. 流执行记录
CREATE TABLE IF NOT EXISTS `sys_flow_run` (
  `Id` VARCHAR(36) NOT NULL,
  `OsClient` VARCHAR(50) NOT NULL,
  `FlowId` VARCHAR(36) NOT NULL,
  `FlowCode` VARCHAR(100) NULL,
  `TriggerSource` VARCHAR(50) NULL COMMENT '触发来源：manual/cron/...',
  `InputData` MEDIUMTEXT NULL COMMENT '入参 JSON',
  `OutputData` MEDIUMTEXT NULL COMMENT '出参 JSON',
  `StepLog` MEDIUMTEXT NULL COMMENT '逐节点执行日志 JSON：[{nodeId,startAt,endAt,success,output,error}]',
  `Status` VARCHAR(20) NOT NULL DEFAULT 'running' COMMENT 'running|success|failed|timeout|cancelled',
  `StartTime` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `EndTime` DATETIME NULL,
  `DurationMs` INT NULL,
  `ErrorMsg` VARCHAR(2000) NULL,
  `CreateUserId` VARCHAR(36) NULL,
  `IsDeleted` INT NULL DEFAULT 0,
  PRIMARY KEY (`Id`),
  KEY `idx_flow_run_flow` (`OsClient`, `FlowId`, `StartTime`),
  KEY `idx_flow_run_status` (`OsClient`, `Status`, `StartTime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自动化流执行历史';
