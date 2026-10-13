CREATE TABLE `sampleRequestPenalties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sampleRequestId` int NOT NULL,
	`employeeId` int NOT NULL,
	`employeeName` varchar(255) NOT NULL,
	`level` enum('warning','salary_deduction','customer_compensation') NOT NULL,
	`amount` decimal(12,2) NOT NULL DEFAULT 0,
	`reason` text NOT NULL,
	`correctiveAction` text,
	`status` enum('open','acknowledged','closed') NOT NULL DEFAULT 'open',
	`createdById` int NOT NULL,
	`createdByName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sampleRequestPenalties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `alerts` MODIFY COLUMN `type` enum('cost_exceeded','low_productivity','pending_procedure','quality_issue','safety_alert','sample_delivery','deadline_alert','penalty') NOT NULL;--> statement-breakpoint
ALTER TABLE `sampleRequests` ADD `lastDeadlineAlertKey` varchar(80);