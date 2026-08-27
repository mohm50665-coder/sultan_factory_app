CREATE TABLE `activityLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(255) NOT NULL,
	`entityType` varchar(100) NOT NULL,
	`entityId` int,
	`details` json,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activityLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `administrativeProcedures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referenceNumber` varchar(50),
	`submissionDate` timestamp,
	`employeeName` varchar(255) NOT NULL,
	`employeeNumber` varchar(50),
	`department` varchar(100),
	`requestType` varchar(100) NOT NULL,
	`requestDetails` text NOT NULL,
	`attachments` json,
	`boardRepStatus` enum('pending','approved','rejected') DEFAULT 'pending',
	`boardRepRejectionReason` text,
	`boardRepActionDate` timestamp,
	`directManagerStatus` enum('pending','approved','rejected') DEFAULT 'pending',
	`directManagerRejectionReason` text,
	`directManagerActionDate` timestamp,
	`generalManagerStatus` enum('pending','approved','rejected') DEFAULT 'pending',
	`generalManagerRejectionReason` text,
	`generalManagerActionDate` timestamp,
	`status` enum('pending','approved','rejected') DEFAULT 'pending',
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `administrativeProcedures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('cost_exceeded','low_productivity','pending_procedure','quality_issue','safety_alert') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL,
	`read` int DEFAULT 0,
	`data` json,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `appSettings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `auditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`tableName` varchar(100) NOT NULL,
	`recordId` int NOT NULL,
	`oldValue` json,
	`newValue` json,
	`description` text,
	`ipAddress` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`backupName` varchar(255) NOT NULL,
	`backupType` enum('manual','automatic','scheduled') NOT NULL,
	`dataSize` int DEFAULT 0,
	`status` enum('pending','in_progress','completed','failed') DEFAULT 'pending',
	`backupPath` text,
	`errorMessage` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `backups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bankBalance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`amount` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bankBalance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `boardRepresentativeData` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dataType` varchar(100) NOT NULL,
	`value` varchar(500) NOT NULL,
	`description` text,
	`date` varchar(20) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `boardRepresentativeData_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collection` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collectorName` varchar(255) NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`amount` int NOT NULL,
	`receiptNumber` varchar(100),
	`receiptDate` varchar(50),
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collection_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`description` text,
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `departments_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `employeeStageAssignment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stageId` int NOT NULL,
	`department` varchar(255) NOT NULL,
	`role` varchar(100),
	`assignedDate` varchar(20) NOT NULL,
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employeeStageAssignment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`amount` int NOT NULL,
	`expenseDetails` text NOT NULL,
	`paymentMethod` enum('bankTransfer','cash','cardHaydar','cardDirector') NOT NULL,
	`requiresApproval` int DEFAULT 0,
	`approvedBy` varchar(255),
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financialReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`month` varchar(20) NOT NULL,
	`year` int NOT NULL,
	`revenue` int DEFAULT 0,
	`expenses` int DEFAULT 0,
	`netProfit` int DEFAULT 0,
	`category` varchar(100),
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financialReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goalProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`goalId` int NOT NULL,
	`date` varchar(20) NOT NULL,
	`achievedValue` int NOT NULL,
	`percentage` int DEFAULT 0,
	`notes` text,
	`recordedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `goalProgress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `governmentTenders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`organization` varchar(255),
	`deadline` varchar(20),
	`value` int DEFAULT 0,
	`status` varchar(50) DEFAULT 'open',
	`description` text,
	`requirements` text,
	`attachments` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `governmentTenders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incomingMaterials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`materialType` varchar(255) NOT NULL,
	`quantity` int NOT NULL,
	`unit` enum('kilo','gram','piece','carton') NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `incomingMaterials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kpis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`month` varchar(20) NOT NULL,
	`department` varchar(255) NOT NULL,
	`kpiName` varchar(255) NOT NULL,
	`kpiType` enum('production','quality','efficiency','safety','financial','custom') NOT NULL,
	`currentValue` int NOT NULL,
	`targetValue` int NOT NULL,
	`previousValue` int NOT NULL DEFAULT 0,
	`unit` varchar(50) NOT NULL,
	`status` enum('on_track','at_risk','off_track','exceeded') NOT NULL DEFAULT 'on_track',
	`trend` enum('up','down','stable') NOT NULL DEFAULT 'stable',
	`notes` text NOT NULL DEFAULT (''),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kpis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `localProductionCosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(20) NOT NULL,
	`category` varchar(100) NOT NULL,
	`description` varchar(255),
	`amount` int DEFAULT 0,
	`quantity` int DEFAULT 0,
	`unitPrice` int DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `localProductionCosts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `machines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`machineCode` varchar(50) NOT NULL,
	`machineName` varchar(255) NOT NULL,
	`machineType` varchar(100),
	`department` varchar(255) NOT NULL,
	`status` enum('active','inactive','maintenance','retired') DEFAULT 'active',
	`capacity` int DEFAULT 0,
	`installDate` varchar(20),
	`notes` text,
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `machines_id` PRIMARY KEY(`id`),
	CONSTRAINT `machines_machineCode_unique` UNIQUE(`machineCode`)
);
--> statement-breakpoint
CREATE TABLE `maintainedEquipment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`equipmentName` varchar(255) NOT NULL,
	`maintenanceDate` timestamp NOT NULL,
	`maintenanceDetails` text NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintainedEquipment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenanceRecommendations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recommendation` text NOT NULL,
	`priority` enum('low','medium','high') DEFAULT 'medium',
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintenanceRecommendations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `manufacturingStages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stageName` varchar(100) NOT NULL,
	`workerName` varchar(255) NOT NULL,
	`quantityDozen` int DEFAULT 0,
	`quantityPair` int DEFAULT 0,
	`productType` varchar(100),
	`productName` varchar(255) DEFAULT '',
	`date` varchar(20) DEFAULT '',
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manufacturingStages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `manufacturingWorkers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stageId` varchar(100) NOT NULL,
	`workerName` varchar(255) NOT NULL,
	`role` varchar(100),
	`isActive` int DEFAULT 1,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manufacturingWorkers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `materialConsumption` (
	`id` int AUTO_INCREMENT NOT NULL,
	`materialType` varchar(255) NOT NULL,
	`quantity` int NOT NULL,
	`unit` enum('kilo','gram','piece','carton') NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `materialConsumption_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meetingOutputs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`meetingId` int NOT NULL,
	`description` text NOT NULL,
	`assignedTo` varchar(255),
	`deadline` varchar(20),
	`status` varchar(50) DEFAULT 'pending',
	`priority` varchar(20) DEFAULT 'medium',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meetingOutputs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`meetingNumber` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`date` varchar(20) NOT NULL,
	`time` varchar(10),
	`location` varchar(255),
	`type` varchar(50),
	`status` varchar(50) DEFAULT 'pending',
	`requestedBy` varchar(255),
	`attendees` json,
	`agenda` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meetings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monthlyGoals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`month` varchar(20) NOT NULL,
	`department` varchar(255) NOT NULL,
	`goalType` enum('production','sales','quality','efficiency','safety','custom') NOT NULL,
	`goalName` varchar(255) NOT NULL,
	`targetValue` int NOT NULL,
	`unit` varchar(50) NOT NULL,
	`weight` int NOT NULL DEFAULT 100,
	`description` text NOT NULL DEFAULT (''),
	`status` enum('active','completed','cancelled') NOT NULL DEFAULT 'active',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthlyGoals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productCostCalculation` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(20) NOT NULL,
	`productName` varchar(255) NOT NULL,
	`productColor` varchar(100) NOT NULL,
	`cottonWeight` int DEFAULT 0,
	`cottonColor` varchar(100),
	`cottonCode` varchar(50),
	`bambooWeight` int DEFAULT 0,
	`bambooColor` varchar(100),
	`bambooCode` varchar(50),
	`nylonWeight` int DEFAULT 0,
	`nylonColor` varchar(100),
	`nylonCode` varchar(50),
	`spanWeight` int DEFAULT 0,
	`spanColor` varchar(100),
	`spanCode` varchar(50),
	`spandexWeight` int DEFAULT 0,
	`spandexColor` varchar(100),
	`spandexCode` varchar(50),
	`rubberWeight` int DEFAULT 0,
	`rubberColor` varchar(100),
	`rubberCode` varchar(50),
	`totalThreadWeight` int DEFAULT 0,
	`notes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productCostCalculation_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productTracking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productName` varchar(255) NOT NULL,
	`productSize` varchar(100),
	`productColor` varchar(100),
	`trackingDate` varchar(20) NOT NULL,
	`totalWeightGrams` int DEFAULT 0,
	`yarnDetails` json,
	`quantityDozen` int DEFAULT 0,
	`quantityPairs` int DEFAULT 0,
	`machineNumbers` json,
	`currentStage` varchar(100) NOT NULL,
	`previousStage` varchar(100),
	`deliveredBy` varchar(255),
	`receivedBy` varchar(255),
	`handoverStatus` enum('pending','delivered','received','rejected') NOT NULL DEFAULT 'pending',
	`handoverDate` timestamp,
	`notes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productTracking_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productTypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productName` varchar(255) NOT NULL,
	`productNameEn` varchar(255),
	`category` varchar(100),
	`description` text,
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productTypes_id` PRIMARY KEY(`id`),
	CONSTRAINT `productTypes_productName_unique` UNIQUE(`productName`)
);
--> statement-breakpoint
CREATE TABLE `production` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(20) NOT NULL,
	`machineNumber` varchar(50) NOT NULL,
	`productName` varchar(100) DEFAULT '',
	`shiftNumber` int DEFAULT 1,
	`shiftStart` varchar(10) DEFAULT '',
	`shiftEnd` varchar(10) DEFAULT '',
	`productionDozen` int DEFAULT 0,
	`productionPairs` int DEFAULT 0,
	`wasteThreadGrams` int DEFAULT 0,
	`wasteSocksGrams` int DEFAULT 0,
	`secondGradeDozen` int DEFAULT 0,
	`secondGradePairs` int DEFAULT 0,
	`wasteNeedles` int DEFAULT 0,
	`productionHours` int DEFAULT 0,
	`productionMinutes` int DEFAULT 0,
	`yarnRubber` int DEFAULT 0,
	`yarnSpandex` int DEFAULT 0,
	`yarnNylon` int DEFAULT 0,
	`yarnCotton` int DEFAULT 0,
	`yarnBamboo` int DEFAULT 0,
	`yarnSpan` int DEFAULT 0,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `production_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productionCosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(20) NOT NULL,
	`threadCost` int DEFAULT 0,
	`rubberCost` int DEFAULT 0,
	`spandexCost` int DEFAULT 0,
	`nylonCost` int DEFAULT 0,
	`cottonCost` int DEFAULT 0,
	`bambooCost` int DEFAULT 0,
	`spanCost` int DEFAULT 0,
	`laborCost` int DEFAULT 0,
	`utilitiesCost` int DEFAULT 0,
	`maintenanceCost` int DEFAULT 0,
	`otherCost` int DEFAULT 0,
	`totalCost` int DEFAULT 0,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productionCosts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productionStages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stageName` varchar(255) NOT NULL,
	`stageNameEn` varchar(255),
	`stageOrder` int NOT NULL,
	`department` varchar(255) NOT NULL,
	`description` text,
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productionStages_id` PRIMARY KEY(`id`),
	CONSTRAINT `productionStages_stageName_unique` UNIQUE(`stageName`)
);
--> statement-breakpoint
CREATE TABLE `rawMaterials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`materialName` varchar(255) NOT NULL,
	`quantity` int NOT NULL,
	`unit` varchar(50) NOT NULL,
	`dataEnteredBy` varchar(255) NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rawMaterials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportName` varchar(255) NOT NULL,
	`reportType` enum('production','cost','sales','performance','quality','maintenance') NOT NULL,
	`startDate` varchar(20) NOT NULL,
	`endDate` varchar(20) NOT NULL,
	`data` json,
	`generatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerName` varchar(255) NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerCategory` varchar(100),
	`quantityDozen` int DEFAULT 0,
	`quantityPair` int DEFAULT 0,
	`amount` varchar(50) DEFAULT '0',
	`invoiceNumber` varchar(100),
	`invoiceDate` varchar(50),
	`paymentMethod` enum('cash','credit','deferred') NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `savedProductCosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productName` varchar(255) NOT NULL,
	`date` varchar(20) NOT NULL,
	`threadData` json NOT NULL,
	`totalCost` int DEFAULT 0,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `savedProductCosts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stoppedEquipment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`equipmentName` varchar(255) NOT NULL,
	`stopDate` timestamp NOT NULL,
	`stopReason` text NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stoppedEquipment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `systemSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`settingValue` text NOT NULL,
	`description` text,
	`category` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `systemSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `systemSettings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentSource` enum('board_representative','general_manager') NOT NULL,
	`assignedEmployee` varchar(255) NOT NULL,
	`assignedUsername` varchar(100),
	`taskDescription` text NOT NULL,
	`createdDate` varchar(50),
	`startDate` varchar(50),
	`endDate` varchar(50),
	`result` enum('completed','not_completed','partial','extended','recommendations','pending') NOT NULL DEFAULT 'pending',
	`resultReason` text,
	`completionPercentage` int,
	`extensionDate` varchar(50),
	`recommendations` text,
	`adminEvaluation` text,
	`reward` int,
	`rewardReason` text,
	`deduction` int,
	`deductionReason` text,
	`hasWarning` int DEFAULT 0,
	`warningText` text,
	`attachedDecisions` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `threadColors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`threadTypeId` int NOT NULL,
	`colorName` varchar(100) NOT NULL,
	`colorCode` varchar(20) NOT NULL,
	`hexColor` varchar(7),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `threadColors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `threadTypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`code` varchar(50) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `threadTypes_id` PRIMARY KEY(`id`),
	CONSTRAINT `threadTypes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `wasteAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`metricKey` varchar(100) NOT NULL,
	`message` text NOT NULL,
	`severity` varchar(20) DEFAULT 'warning',
	`isRead` int DEFAULT 0,
	`machineNumber` varchar(50),
	`value` int DEFAULT 0,
	`threshold` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wasteAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wasteThresholds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`metricKey` varchar(100) NOT NULL,
	`metricName` varchar(255) NOT NULL,
	`threshold` int DEFAULT 0,
	`unit` varchar(50),
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wasteThresholds_id` PRIMARY KEY(`id`),
	CONSTRAINT `wasteThresholds_metricKey_unique` UNIQUE(`metricKey`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','manager','supervisor') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `position` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `department` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `password` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `allowedSections` json;--> statement-breakpoint
ALTER TABLE `users` ADD `toolPermissions` json;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);