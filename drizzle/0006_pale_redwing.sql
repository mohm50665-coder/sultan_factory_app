CREATE TABLE `internalMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subject` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`senderId` int NOT NULL,
	`recipientUserId` int,
	`recipientDepartment` varchar(100),
	`relatedType` varchar(80),
	`relatedId` int,
	`attachments` json,
	`readAt` timestamp,
	`dueAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `internalMessages_id` PRIMARY KEY(`id`)
);
