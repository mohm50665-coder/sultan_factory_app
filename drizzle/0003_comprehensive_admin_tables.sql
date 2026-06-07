-- جدول الأقسام والفروع
CREATE TABLE IF NOT EXISTS `departments` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(255) NOT NULL UNIQUE,
  `nameEn` varchar(255),
  `description` text,
  `isActive` int DEFAULT 1,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- جدول المكائن
CREATE TABLE IF NOT EXISTS `machines` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `machineCode` varchar(50) NOT NULL UNIQUE,
  `machineName` varchar(255) NOT NULL,
  `machineType` varchar(100),
  `department` varchar(255) NOT NULL,
  `status` enum('active', 'inactive', 'maintenance', 'retired') DEFAULT 'active',
  `capacity` int DEFAULT 0,
  `installDate` varchar(20),
  `notes` text,
  `isActive` int DEFAULT 1,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- جدول مراحل التسليم
CREATE TABLE IF NOT EXISTS `productionStages` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `stageName` varchar(255) NOT NULL UNIQUE,
  `stageNameEn` varchar(255),
  `stageOrder` int NOT NULL,
  `department` varchar(255) NOT NULL,
  `description` text,
  `isActive` int DEFAULT 1,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- جدول تعيين الموظفين للمراحل
CREATE TABLE IF NOT EXISTS `employeeStageAssignment` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `stageId` int NOT NULL,
  `department` varchar(255) NOT NULL,
  `role` varchar(100),
  `assignedDate` varchar(20) NOT NULL,
  `isActive` int DEFAULT 1,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`stageId`) REFERENCES `productionStages`(`id`) ON DELETE CASCADE
);

-- جدول أنواع المنتجات
CREATE TABLE IF NOT EXISTS `productTypes` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `productName` varchar(255) NOT NULL UNIQUE,
  `productNameEn` varchar(255),
  `category` varchar(100),
  `description` text,
  `isActive` int DEFAULT 1,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- جدول بيانات ممثل مجلس الإدارة
CREATE TABLE IF NOT EXISTS `boardRepresentativeData` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `dataType` varchar(100) NOT NULL,
  `value` varchar(500) NOT NULL,
  `description` text,
  `date` varchar(20) NOT NULL,
  `notes` text,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- جدول سجل التدقيق
CREATE TABLE IF NOT EXISTS `auditLog` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `action` varchar(100) NOT NULL,
  `tableName` varchar(100) NOT NULL,
  `recordId` int NOT NULL,
  `oldValue` json,
  `newValue` json,
  `description` text,
  `ipAddress` varchar(50),
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- جدول الإعدادات العامة
CREATE TABLE IF NOT EXISTS `systemSettings` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `settingKey` varchar(100) NOT NULL UNIQUE,
  `settingValue` text NOT NULL,
  `description` text,
  `category` varchar(100),
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
