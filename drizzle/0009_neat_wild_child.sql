ALTER TABLE `manufacturingStages` ADD `movementStatus` enum('none','received','delivered') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `manufacturingStages` ADD `movementBy` varchar(255);--> statement-breakpoint
ALTER TABLE `manufacturingStages` ADD `movementAt` timestamp;--> statement-breakpoint
ALTER TABLE `production` ADD `movementStatus` enum('none','received','delivered') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `production` ADD `movementBy` varchar(255);--> statement-breakpoint
ALTER TABLE `production` ADD `movementAt` timestamp;