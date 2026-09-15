CREATE TABLE `administrativeDailyReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportDate` varchar(20) NOT NULL,
	`summary` text NOT NULL,
	`workItemsSnapshot` json,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `administrativeDailyReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `administrativeWorkItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workDescription` text NOT NULL,
	`procedureType` enum('electronic','manual') NOT NULL,
	`status` enum('completed','not_completed','partial') NOT NULL DEFAULT 'not_completed',
	`nonCompletionReason` text,
	`targetDate` varchar(20),
	`assignedTo` varchar(255),
	`assignedUserId` int,
	`department` varchar(100),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `administrativeWorkItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financialCustodies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`custodyAmount` decimal(14,2) NOT NULL,
	`recipientName` varchar(255) NOT NULL,
	`recipientUserId` int,
	`custodyDate` varchar(20) NOT NULL,
	`settlementDate` varchar(20),
	`shortageAmount` decimal(14,2) DEFAULT 0,
	`shortageAction` text,
	`notes` text,
	`attachments` json,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financialCustodies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financialDailyReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportDate` varchar(20) NOT NULL,
	`bankBalance` decimal(14,2) DEFAULT 0,
	`totalExpenses` decimal(14,2) DEFAULT 0,
	`totalCustodies` decimal(14,2) DEFAULT 0,
	`totalShortages` decimal(14,2) DEFAULT 0,
	`details` json,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financialDailyReports_id` PRIMARY KEY(`id`)
);
