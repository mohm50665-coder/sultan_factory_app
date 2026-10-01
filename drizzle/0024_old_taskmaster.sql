ALTER TABLE `customers` ADD `assignedRepresentativeId` int;--> statement-breakpoint
ALTER TABLE `customers` ADD `assignedRepresentativeName` varchar(255);--> statement-breakpoint
ALTER TABLE `customers` ADD `sourceSellerName` varchar(255);--> statement-breakpoint
ALTER TABLE `customers` ADD `sourceAccountCode` varchar(100);--> statement-breakpoint
ALTER TABLE `customers` ADD `postalCode` varchar(30);--> statement-breakpoint
ALTER TABLE `customers` ADD `buildingNumber` varchar(30);