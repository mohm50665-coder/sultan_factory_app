ALTER TABLE `sampleRequests` ADD `customerApprovalToken` varchar(120);--> statement-breakpoint
ALTER TABLE `sampleRequests` ADD `customerApprovalStatus` varchar(30) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `sampleRequests` ADD `customerApprovalReason` text;--> statement-breakpoint
ALTER TABLE `sampleRequests` ADD `customerApprovalAttachments` json;--> statement-breakpoint
ALTER TABLE `sampleRequests` ADD `customerApprovedAt` timestamp;--> statement-breakpoint
ALTER TABLE `sampleRequests` ADD `initialSavedAt` timestamp;--> statement-breakpoint
ALTER TABLE `sampleRequests` ADD `finalSavedAt` timestamp;--> statement-breakpoint
ALTER TABLE `sampleRequests` ADD `createdProductId` int;