CREATE TABLE `representativeSales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referenceCode` varchar(40) NOT NULL,
	`representativeId` int NOT NULL,
	`representativeName` varchar(255) NOT NULL,
	`customerId` int NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`invoiceNumber` varchar(100) NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`invoiceDate` varchar(20) NOT NULL,
	`attachments` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `representativeSales_id` PRIMARY KEY(`id`),
	CONSTRAINT `representativeSales_referenceCode_unique` UNIQUE(`referenceCode`)
);
