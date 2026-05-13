-- ============================================================
-- Microi 业务流"状态机/Workflow轻量"引擎 - MySQL 5.7+
-- 设计意图：用于业务对象(订单/单据/工单)的状态流转
--   - 与 wf_flowdesign 审批流互补：审批流是"人审"，状态机是"数据流"
--   - 由 diy_table.StatusField 字段触发；状态变更由 ApiEngine 'state-machine-transition' 处理
-- ============================================================

-- 1. 状态机定义
CREATE TABLE IF NOT EXISTS `sys_state_machine` (
  `Id` VARCHAR(36) NOT NULL,
  `OsClient` VARCHAR(50) NOT NULL,
  `Name` VARCHAR(200) NOT NULL COMMENT '状态机名称，如 "订单状态"',
  `Code` VARCHAR(100) NOT NULL COMMENT '编码，唯一索引',
  `TableName` VARCHAR(100) NOT NULL COMMENT '绑定的业务表名 (diy_table.Name)',
  `StatusField` VARCHAR(100) NOT NULL DEFAULT 'Status' COMMENT '状态字段名',
  `Description` VARCHAR(2000) NULL,
  `States` MEDIUMTEXT NULL COMMENT 'JSON：[{key,label,color,terminal}]',
  `InitialState` VARCHAR(100) NULL COMMENT '初始状态 key',
  `Status` INT NULL DEFAULT 1 COMMENT '0=禁用 1=启用',
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
  UNIQUE KEY `uk_state_machine_code` (`OsClient`, `Code`),
  KEY `idx_state_machine_table` (`OsClient`, `TableName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='状态机/业务流定义';

-- 2. 状态跃迁规则
CREATE TABLE IF NOT EXISTS `sys_state_transition` (
  `Id` VARCHAR(36) NOT NULL,
  `OsClient` VARCHAR(50) NOT NULL,
  `StateMachineId` VARCHAR(36) NOT NULL,
  `Name` VARCHAR(200) NULL COMMENT '跃迁动作名，如 "付款"',
  `FromState` VARCHAR(100) NOT NULL,
  `ToState` VARCHAR(100) NOT NULL,
  `ConditionV8` MEDIUMTEXT NULL COMMENT 'V8 表达式：return true 才允许跃迁；可读 V8.Row、V8.User',
  `ActionApiEngineKey` VARCHAR(200) NULL COMMENT '跃迁后调用的接口引擎 Key（事务内）',
  `RequireRole` VARCHAR(200) NULL COMMENT '所需角色 Id，多个逗号分隔',
  `Sort` INT NULL DEFAULT 0,
  `IsDeleted` INT NULL DEFAULT 0,
  `CreateTime` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  KEY `idx_state_transition_machine` (`OsClient`, `StateMachineId`),
  KEY `idx_state_transition_from` (`OsClient`, `StateMachineId`, `FromState`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='状态跃迁规则';

-- 3. 状态变更历史（审计）
CREATE TABLE IF NOT EXISTS `sys_state_history` (
  `Id` VARCHAR(36) NOT NULL,
  `OsClient` VARCHAR(50) NOT NULL,
  `StateMachineId` VARCHAR(36) NOT NULL,
  `TableName` VARCHAR(100) NOT NULL,
  `RowId` VARCHAR(64) NOT NULL COMMENT '业务表行 Id',
  `FromState` VARCHAR(100) NULL,
  `ToState` VARCHAR(100) NOT NULL,
  `TransitionId` VARCHAR(36) NULL,
  `OperatorId` VARCHAR(36) NULL,
  `OperatorName` VARCHAR(100) NULL,
  `Comment` VARCHAR(2000) NULL,
  `CreateTime` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  KEY `idx_state_history_row` (`OsClient`, `TableName`, `RowId`, `CreateTime`),
  KEY `idx_state_history_machine` (`OsClient`, `StateMachineId`, `CreateTime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='状态变更审计历史';
