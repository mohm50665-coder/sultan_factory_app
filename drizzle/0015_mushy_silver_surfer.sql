CREATE TABLE `sampleRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referenceCode` varchar(30) NOT NULL,
	`requesterId` int NOT NULL,
	`requesterName` varchar(255) NOT NULL,
	`requesterDepartment` varchar(100),
	`clientName` varchar(255),
	`productName` varchar(255) NOT NULL,
	`productSize` varchar(100) NOT NULL,
	`productColor` varchar(100) NOT NULL,
	`quantity` int NOT NULL,
	`quantityUnit` enum('dozen','pair') NOT NULL DEFAULT 'dozen',
	`specifications` text NOT NULL,
	`designAttachments` json NOT NULL,
	`manufacturingFormAttachments` json NOT NULL,
	`transferReceiptAttachments` json NOT NULL,
	`signatureAttachments` json NOT NULL,
	`sampleMediaAttachments` json,
	`status` enum('incomplete','pending_sales','approved_sales','rejected_sales','approved_production','in_production','ready_for_requester','completed') NOT NULL DEFAULT 'incomplete',
	`productionId` int,
	`currentStage` varchar(100),
	`deliveredAt` timestamp,
	`receivedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sampleRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `sampleRequests_referenceCode_unique` UNIQUE(`referenceCode`)
);
--> statement-breakpoint
ALTER TABLE `productTracking` MODIFY COLUMN `qualityGrade` enum('first','second','sample');--> statement-breakpoint
ALTER TABLE `manufacturingStages` ADD `qualityGrade` enum('first','second','sample') DEFAULT 'first' NOT NULL;--> statement-breakpoint
ALTER TABLE `manufacturingStages` ADD `sampleRequestId` int;--> statement-breakpoint
ALTER TABLE `manufacturingStages` ADD `productionId` int;--> statement-breakpoint
ALTER TABLE `manufacturingStages` ADD `stageStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `manufacturingStages` ADD `stageCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `manufacturingStages` ADD `shortageDozen` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `manufacturingStages` ADD `shortagePairs` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `manufacturingStages` ADD `wasteGrams` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `productTracking` ADD `sampleRequestId` int;--> statement-breakpoint
ALTER TABLE `productTracking` ADD `sampleReference` varchar(30);--> statement-breakpoint
ALTER TABLE `productTracking` ADD `stageStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `productTracking` ADD `stageCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `productTracking` ADD `shortageDozen` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `productTracking` ADD `shortagePairs` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `productTracking` ADD `wasteGrams` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `production` ADD `qualityGrade` enum('first','second','sample') DEFAULT 'first' NOT NULL;--> statement-breakpoint
ALTER TABLE `production` ADD `sampleRequestId` int;--> statement-breakpoint
ALTER TABLE `production` ADD `sampleReference` varchar(30);