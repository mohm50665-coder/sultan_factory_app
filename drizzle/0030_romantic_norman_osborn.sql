ALTER TABLE `finishedWarehouseMovements` MODIFY COLUMN `quantityDozen` decimal(12,6) NOT NULL;--> statement-breakpoint
ALTER TABLE `finishedWarehouseStock` MODIFY COLUMN `quantityDozen` decimal(12,6) NOT NULL;--> statement-breakpoint
ALTER TABLE `finishedWarehouseStock` MODIFY COLUMN `minimumDozen` decimal(12,6) NOT NULL DEFAULT 50;