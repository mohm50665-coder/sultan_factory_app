CREATE TABLE `custodyBatches` (
	`id` varchar(36) NOT NULL,
	`trackingNumber` varchar(80) NOT NULL,
	`productionId` int,
	`legacySourceKey` varchar(100),
	`version` int NOT NULL DEFAULT 1,
	`payload` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custodyBatches_id` PRIMARY KEY(`id`),
	CONSTRAINT `custodyBatches_trackingNumber_unique` UNIQUE(`trackingNumber`),
	CONSTRAINT `custodyBatches_legacySourceKey_unique` UNIQUE(`legacySourceKey`)
);
--> statement-breakpoint
CREATE TABLE `custodyEvents` (
	`id` varchar(36) NOT NULL,
	`batchId` varchar(36) NOT NULL,
	`custodyId` varchar(36),
	`transferId` varchar(36),
	`sessionId` varchar(36),
	`progressId` varchar(36),
	`disposalId` varchar(36),
	`sequence` int NOT NULL,
	`actorId` int NOT NULL,
	`actorName` varchar(255) NOT NULL,
	`stage` varchar(40),
	`action` varchar(80) NOT NULL,
	`pairs` int,
	`reason` text,
	`before` json,
	`after` json,
	`payload` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custodyEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `custodyEvents_batch_sequence_uq` UNIQUE(`batchId`,`sequence`)
);
--> statement-breakpoint
CREATE TABLE `custodyInventory` (
	`id` varchar(36) NOT NULL,
	`batchId` varchar(36) NOT NULL,
	`custodyId` varchar(36) NOT NULL,
	`barcode` varchar(128) NOT NULL,
	`productCode` varchar(100) NOT NULL,
	`productSize` varchar(100) NOT NULL,
	`productColor` varchar(100) NOT NULL,
	`quality` varchar(20) NOT NULL,
	`packagePairs` int NOT NULL,
	`pairs` int NOT NULL,
	`storedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custodyInventory_id` PRIMARY KEY(`id`),
	CONSTRAINT `custodyInventory_custodyId_unique` UNIQUE(`custodyId`)
);
--> statement-breakpoint
CREATE TABLE `custodyOperations` (
	`id` varchar(36) NOT NULL,
	`operationKey` varchar(128) NOT NULL,
	`actorId` int NOT NULL,
	`requestHash` varchar(64) NOT NULL,
	`batchId` varchar(36) NOT NULL,
	`result` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custodyOperations_id` PRIMARY KEY(`id`),
	CONSTRAINT `custodyOperations_actor_operation_uq` UNIQUE(`actorId`,`operationKey`)
);
--> statement-breakpoint
CREATE TABLE `custodySettings` (
	`id` int NOT NULL,
	`payload` json NOT NULL,
	`scheduleCronTaskUid` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custodySettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custodyWorkerLocks` (
	`userId` int NOT NULL,
	`batchId` varchar(36) NOT NULL,
	`custodyId` varchar(36) NOT NULL,
	`acquiredAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custodyWorkerLocks_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `custodySampleOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referenceCode` varchar(48) NOT NULL,
	`requesterId` int NOT NULL,
	`payload` json NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'intake',
	`batchId` varchar(36),
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custodySampleOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `custodySampleOrders_referenceCode_unique` UNIQUE(`referenceCode`)
);
--> statement-breakpoint
ALTER TABLE `production` MODIFY COLUMN `wasteThreadGrams` decimal(14,6) DEFAULT 0;--> statement-breakpoint
ALTER TABLE `production` MODIFY COLUMN `wasteSocksGrams` decimal(14,6) DEFAULT 0;--> statement-breakpoint
ALTER TABLE `production` MODIFY COLUMN `yarnRubber` decimal(14,6) DEFAULT 0;--> statement-breakpoint
ALTER TABLE `production` MODIFY COLUMN `yarnSpandex` decimal(14,6) DEFAULT 0;--> statement-breakpoint
ALTER TABLE `production` MODIFY COLUMN `yarnNylon` decimal(14,6) DEFAULT 0;--> statement-breakpoint
ALTER TABLE `production` MODIFY COLUMN `yarnCotton` decimal(14,6) DEFAULT 0;--> statement-breakpoint
ALTER TABLE `production` MODIFY COLUMN `yarnBamboo` decimal(14,6) DEFAULT 0;--> statement-breakpoint
ALTER TABLE `production` MODIFY COLUMN `yarnSpan` decimal(14,6) DEFAULT 0;--> statement-breakpoint
ALTER TABLE `finishedWarehouseMovements` ADD `totalPairs` int;--> statement-breakpoint
ALTER TABLE `finishedWarehouseMovements` ADD `sourceKey` varchar(160);--> statement-breakpoint
ALTER TABLE `finishedWarehouseStock` ADD `totalPairs` int;--> statement-breakpoint
ALTER TABLE `finishedWarehouseStock` ADD `packagePairs` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `finishedWarehouseStock` ADD `productCode` varchar(100);--> statement-breakpoint
ALTER TABLE `finishedWarehouseMovements` ADD CONSTRAINT `finishedWarehouseMovements_sourceKey_unique` UNIQUE(`sourceKey`);--> statement-breakpoint
CREATE INDEX `custodyBatches_productionId_idx` ON `custodyBatches` (`productionId`);--> statement-breakpoint
CREATE INDEX `custodyEvents_batch_created_idx` ON `custodyEvents` (`batchId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `custodyEvents_custody_idx` ON `custodyEvents` (`custodyId`);--> statement-breakpoint
CREATE INDEX `custodyInventory_barcode_idx` ON `custodyInventory` (`barcode`);--> statement-breakpoint
CREATE INDEX `custodyInventory_batch_idx` ON `custodyInventory` (`batchId`);--> statement-breakpoint
CREATE INDEX `custodyOperations_batch_idx` ON `custodyOperations` (`batchId`);--> statement-breakpoint
CREATE INDEX `custodyWorkerLocks_batch_idx` ON `custodyWorkerLocks` (`batchId`);--> statement-breakpoint
CREATE INDEX `custodySampleOrders_requester_idx` ON `custodySampleOrders` (`requesterId`);--> statement-breakpoint
CREATE INDEX `custodySampleOrders_status_idx` ON `custodySampleOrders` (`status`);--> statement-breakpoint
CREATE INDEX `custodySampleOrders_batch_idx` ON `custodySampleOrders` (`batchId`);