ALTER TABLE `manufacturingStages` ADD `machineNumber` varchar(50);--> statement-breakpoint
ALTER TABLE `manufacturingStages` ADD `shiftNumber` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `production` ADD `productSize` varchar(100) DEFAULT '';--> statement-breakpoint
ALTER TABLE `production` ADD `productColor` varchar(100) DEFAULT '';