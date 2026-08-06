-- Create threadTypes table
CREATE TABLE IF NOT EXISTS `threadTypes` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(100) NOT NULL,
  `code` varchar(50) NOT NULL UNIQUE,
  `description` text,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create threadColors table
CREATE TABLE IF NOT EXISTS `threadColors` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `threadTypeId` int NOT NULL,
  `colorName` varchar(100) NOT NULL,
  `colorCode` varchar(20) NOT NULL,
  `hexColor` varchar(7),
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`threadTypeId`) REFERENCES `threadTypes`(`id`) ON DELETE CASCADE
);

-- Create productCostCalculation table
CREATE TABLE IF NOT EXISTS `productCostCalculation` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `date` varchar(20) NOT NULL,
  `productName` varchar(255) NOT NULL,
  `productColor` varchar(100) NOT NULL,
  `cottonWeight` int DEFAULT 0,
  `cottonColor` varchar(100),
  `cottonCode` varchar(50),
  `bambooWeight` int DEFAULT 0,
  `bambooColor` varchar(100),
  `bambooCode` varchar(50),
  `nylonWeight` int DEFAULT 0,
  `nylonColor` varchar(100),
  `nylonCode` varchar(50),
  `spanWeight` int DEFAULT 0,
  `spanColor` varchar(100),
  `spanCode` varchar(50),
  `spandexWeight` int DEFAULT 0,
  `spandexColor` varchar(100),
  `spandexCode` varchar(50),
  `rubberWeight` int DEFAULT 0,
  `rubberColor` varchar(100),
  `rubberCode` varchar(50),
  `totalThreadWeight` int DEFAULT 0,
  `notes` text,
  `userId` int NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- Insert default thread types
INSERT IGNORE INTO `threadTypes` (`name`, `code`, `description`) VALUES
('قطن', 'COTTON', 'خيط القطن'),
('بامبو', 'BAMBOO', 'خيط البامبو'),
('نايلون', 'NYLON', 'خيط النايلون'),
('إسبان', 'SPAN', 'خيط الإسبان'),
('إسباندكس', 'SPANDEX', 'خيط الإسباندكس'),
('مطاط', 'RUBBER', 'خيط المطاط');
