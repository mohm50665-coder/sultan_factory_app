CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`barcode` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`size` varchar(100),
	`color` varchar(100),
	`weightGrams` int DEFAULT 0,
	`yarnDetails` json,
	`imageUrl` text,
	`attachments` json,
	`isActive` int NOT NULL DEFAULT 1,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_barcode_unique` UNIQUE(`barcode`)
);
