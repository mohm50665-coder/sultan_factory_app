CREATE TABLE `finishedWarehouseMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stockId` int NOT NULL,
	`movementType` enum('receipt','issue','adjustment') NOT NULL,
	`quantityDozen` decimal(12,2) NOT NULL,
	`sourceType` varchar(60) NOT NULL,
	`sourceId` int,
	`notes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `finishedWarehouseMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finishedWarehouseStock` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productName` varchar(255) NOT NULL,
	`productSize` varchar(100) DEFAULT '',
	`productColor` varchar(100) DEFAULT '',
	`qualityGrade` varchar(30) NOT NULL DEFAULT 'first',
	`quantityDozen` decimal(12,2) NOT NULL DEFAULT 0,
	`minimumDozen` decimal(12,2) NOT NULL DEFAULT 50,
	`lastMovementAt` timestamp,
	`isActive` int NOT NULL DEFAULT 1,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `finishedWarehouseStock_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productManufacturingRequestEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`action` varchar(60) NOT NULL,
	`fromStatus` varchar(50),
	`toStatus` varchar(50) NOT NULL,
	`actorId` int NOT NULL,
	`actorName` varchar(255) NOT NULL,
	`notes` text,
	`signature` text,
	`attachments` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `productManufacturingRequestEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productManufacturingRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referenceCode` varchar(40) NOT NULL,
	`requesterId` int NOT NULL,
	`requesterName` varchar(255) NOT NULL,
	`customerId` int,
	`customerName` varchar(255) NOT NULL,
	`productName` varchar(255) NOT NULL,
	`productSize` varchar(100) DEFAULT '',
	`productColor` varchar(100) DEFAULT '',
	`quantityDozen` decimal(12,2) NOT NULL,
	`orderDate` varchar(20) NOT NULL,
	`deliveryDate` varchar(20) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'PENDING_SALES',
	`currentDepartment` varchar(80) NOT NULL DEFAULT 'sales',
	`decisionNotes` text,
	`correctiveAction` text,
	`attachments` json NOT NULL,
	`signatures` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productManufacturingRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `productManufacturingRequests_referenceCode_unique` UNIQUE(`referenceCode`)
);
