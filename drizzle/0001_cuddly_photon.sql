CREATE TABLE `administrativeProcedures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enteredBy` varchar(255) NOT NULL,
	`workDetails` text NOT NULL,
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
CREATE TABLE `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`section` varchar(100) NOT NULL,
	`canView` int DEFAULT 1,
	`canAdd` int DEFAULT 0,
	`canEdit` int DEFAULT 0,
	`canDelete` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`)
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
	`quantityDozen` int DEFAULT 0,
	`quantityPair` int DEFAULT 0,
	`paymentMethod` enum('cash','credit') NOT NULL,
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
	`employeeName` varchar(255) NOT NULL,
	`taskDescription` text NOT NULL,
	`dueDate` timestamp NOT NULL,
	`status` enum('pending','inProgress','completed') NOT NULL DEFAULT 'pending',
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `position` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `password` varchar(255);