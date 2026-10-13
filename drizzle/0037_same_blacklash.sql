ALTER TABLE `sampleRequestPenalties` ADD `approvalStatus` enum('pending','approved','rejected') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `sampleRequestPenalties` ADD `approvedById` int;--> statement-breakpoint
ALTER TABLE `sampleRequestPenalties` ADD `approvedByName` varchar(255);--> statement-breakpoint
ALTER TABLE `sampleRequestPenalties` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `sampleRequestPenalties` ADD `approvalNotes` text;