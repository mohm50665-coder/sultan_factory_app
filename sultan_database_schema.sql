-- Sultan Factory Database Schema for MySQL
-- Includes all tables for production, sales, warehouses, custom manufacturing, maintenance, etc.

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `users` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `openId` varchar(64) NOT NULL UNIQUE,
  `name` varchar(255) NOT NULL,
  `username` varchar(100) NOT NULL UNIQUE,
  `email` varchar(320) NOT NULL,
  `phone` varchar(20),
  `position` varchar(255),
  `department` varchar(100),
  `password` varchar(255) NOT NULL,
  `loginMethod` varchar(64),
  `role` enum('user','admin','manager','supervisor') NOT NULL DEFAULT 'user',
  `isActive` int NOT NULL DEFAULT 0,
  `allowedSections` json,
  `toolPermissions` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `production` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `date` varchar(20) NOT NULL,
  `machineNumber` varchar(50) NOT NULL,
  `productName` varchar(100) DEFAULT '',
  `shiftNumber` int DEFAULT 1,
  `shiftStart` varchar(10) DEFAULT '',
  `shiftEnd` varchar(10) DEFAULT '',
  `productionDozen` int DEFAULT 0,
  `productionPairs` int DEFAULT 0,
  `wasteThreadGrams` int DEFAULT 0,
  `wasteSocksGrams` int DEFAULT 0,
  `secondGradeDozen` int DEFAULT 0,
  `secondGradePairs` int DEFAULT 0,
  `wasteNeedles` int DEFAULT 0,
  `productionHours` int DEFAULT 0,
  `productionMinutes` int DEFAULT 0,
  `yarnRubber` int DEFAULT 0,
  `yarnSpandex` int DEFAULT 0,
  `yarnNylon` int DEFAULT 0,
  `yarnCotton` int DEFAULT 0,
  `yarnBamboo` int DEFAULT 0,
  `yarnSpan` int DEFAULT 0,
  `userId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `manufacturingStages` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `stageName` varchar(100) NOT NULL,
  `workerName` varchar(255) NOT NULL,
  `quantityDozen` int DEFAULT 0,
  `quantityPair` int DEFAULT 0,
  `productType` varchar(100),
  `productName` varchar(255) DEFAULT '',
  `date` varchar(20) DEFAULT '',
  `userId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `sales` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `sellerName` varchar(255) NOT NULL,
  `customerName` varchar(255) NOT NULL,
  `customerCategory` varchar(100),
  `quantityDozen` int DEFAULT 0,
  `quantityPair` int DEFAULT 0,
  `amount` varchar(50) DEFAULT '0',
  `invoiceNumber` varchar(100),
  `invoiceDate` varchar(50),
  `paymentMethod` enum('cash','credit','deferred') NOT NULL,
  `userId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `customManufacturing` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `clientName` varchar(255) NOT NULL,
  `officialName` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `notes` text,
  `commercialRegister` varchar(255),
  `taxNumber` varchar(255),
  `nationalAddress` varchar(255),
  `designFile` varchar(500),
  `manufacturingForm` varchar(500),
  `status` varchar(50) DEFAULT 'new',
  `progress` int DEFAULT 25,
  `userId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SET FOREIGN_KEY_CHECKS = 1;
