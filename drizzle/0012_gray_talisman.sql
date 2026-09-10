ALTER TABLE `manufacturingStages` ADD `expectedReceiver` varchar(255);--> statement-breakpoint
ALTER TABLE `manufacturingStages` ADD `receiverStage` varchar(100);--> statement-breakpoint
ALTER TABLE `manufacturingStages` ADD `receivedBy` varchar(255);--> statement-breakpoint
ALTER TABLE `manufacturingStages` ADD `receivedAt` timestamp;