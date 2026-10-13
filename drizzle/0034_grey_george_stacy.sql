ALTER TABLE `sampleRequests` ADD `sampleProductionDueAt` timestamp;--> statement-breakpoint
ALTER TABLE `sampleRequests` ADD `customerApprovalDueAt` timestamp;--> statement-breakpoint
ALTER TABLE `sampleRequests` ADD `correctionDueAt` timestamp;--> statement-breakpoint
ALTER TABLE `sampleRequests` ADD `executionDueAt` timestamp;--> statement-breakpoint
ALTER TABLE `sampleRequests` ADD `executionLatestDueAt` timestamp;