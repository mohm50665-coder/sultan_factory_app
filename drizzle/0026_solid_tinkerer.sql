ALTER TABLE `finishedWarehouseStock` ADD `barcode` varchar(64) NULL;--> statement-breakpoint
ALTER TABLE `productManufacturingRequests` ADD `barcode` varchar(64) NULL;--> statement-breakpoint
ALTER TABLE `production` ADD `barcode` varchar(64) NULL;--> statement-breakpoint
UPDATE `finishedWarehouseStock` SET `barcode` = CONCAT('WH-', `id`) WHERE `barcode` IS NULL OR `barcode` = '';--> statement-breakpoint
UPDATE `productManufacturingRequests` SET `barcode` = CONCAT('MFG-', `id`) WHERE `barcode` IS NULL OR `barcode` = '';--> statement-breakpoint
UPDATE `production` SET `barcode` = CONCAT('PRD-', `id`) WHERE `barcode` IS NULL OR `barcode` = '';--> statement-breakpoint
ALTER TABLE `finishedWarehouseStock` MODIFY `barcode` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `productManufacturingRequests` MODIFY `barcode` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `production` MODIFY `barcode` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `finishedWarehouseStock` ADD CONSTRAINT `finishedWarehouseStock_barcode_unique` UNIQUE(`barcode`);