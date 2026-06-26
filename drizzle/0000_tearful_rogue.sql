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
CREATE TABLE `bankBalance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`amount` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bankBalance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collection` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collectorName` varchar(255) NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`amount` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collection_id` PRIMARY KEY(`id`)
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
	`recommendations` text NOT NULL,
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
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manufacturingStages_id` PRIMARY KEY(`id`)
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
CREATE TABLE `production` (
	`id` int AUTO_INCREMENT NOT NULL,
	`machineNumber` varchar(50) NOT NULL,
	`quantityDozen` int DEFAULT 0,
	`quantityPair` int DEFAULT 0,
	`wasteThreadsGrams` int DEFAULT 0,
	`wasteDefectiveSocksGrams` int DEFAULT 0,
	`secondGradePair` int DEFAULT 0,
	`secondGradeGrams` int DEFAULT 0,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `production_id` PRIMARY KEY(`id`)
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
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerName` varchar(255) NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerCategory` varchar(100),
	`quantityDozen` int DEFAULT 0,
	`quantityPair` int DEFAULT 0,
	`paymentMethod` enum('cash','credit','deferred') NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stoppedEquipment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`equipmentName` varchar(255) NOT NULL,
	`stoppageDate` timestamp NOT NULL,
	`stoppageReason` text NOT NULL,
	`solutionProcedures` text NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stoppedEquipment_id` PRIMARY KEY(`id`)
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
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`username` varchar(100) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(20),
	`position` varchar(255),
	`department` varchar(100),
	`password` varchar(255) NOT NULL,
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`isActive` int NOT NULL DEFAULT 0,
	`allowedSections` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
