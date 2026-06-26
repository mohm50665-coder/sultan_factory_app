-- جدول حساب التكاليف
CREATE TABLE IF NOT EXISTS `productionCosts` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `date` varchar(20) NOT NULL,
  `threadCost` int DEFAULT 0,
  `rubberCost` int DEFAULT 0,
  `spandexCost` int DEFAULT 0,
  `nylonCost` int DEFAULT 0,
  `cottonCost` int DEFAULT 0,
  `bambooCost` int DEFAULT 0,
  `spanCost` int DEFAULT 0,
  `laborCost` int DEFAULT 0,
  `utilitiesCost` int DEFAULT 0,
  `maintenanceCost` int DEFAULT 0,
  `otherCost` int DEFAULT 0,
  `totalCost` int DEFAULT 0,
  `userId` int NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- جدول التنبيهات
CREATE TABLE IF NOT EXISTS `alerts` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `type` enum('cost_exceeded', 'low_productivity', 'pending_procedure', 'quality_issue', 'safety_alert') NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `severity` enum('info', 'warning', 'critical') NOT NULL,
  `read` int DEFAULT 0,
  `data` json,
  `userId` int NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- جدول النسخ الاحتياطية
CREATE TABLE IF NOT EXISTS `backups` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `backupName` varchar(255) NOT NULL,
  `backupType` enum('manual', 'automatic', 'scheduled') NOT NULL,
  `dataSize` int DEFAULT 0,
  `status` enum('pending', 'in_progress', 'completed', 'failed') DEFAULT 'pending',
  `backupPath` text,
  `errorMessage` text,
  `userId` int NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- جدول سجل الأنشطة
CREATE TABLE IF NOT EXISTS `activityLog` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `action` varchar(255) NOT NULL,
  `entityType` varchar(100) NOT NULL,
  `entityId` int,
  `details` json,
  `userId` int NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP
);

-- جدول التقارير
CREATE TABLE IF NOT EXISTS `reports` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `reportName` varchar(255) NOT NULL,
  `reportType` enum('production', 'cost', 'sales', 'performance', 'quality', 'maintenance') NOT NULL,
  `startDate` varchar(20) NOT NULL,
  `endDate` varchar(20) NOT NULL,
  `data` json,
  `generatedBy` int NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- إضافة فهارس
CREATE INDEX idx_productionCosts_date ON `productionCosts`(`date`);
CREATE INDEX idx_productionCosts_userId ON `productionCosts`(`userId`);
CREATE INDEX idx_alerts_userId ON `alerts`(`userId`);
CREATE INDEX idx_alerts_type ON `alerts`(`type`);
CREATE INDEX idx_backups_status ON `backups`(`status`);
CREATE INDEX idx_activityLog_userId ON `activityLog`(`userId`);
CREATE INDEX idx_activityLog_entityType ON `activityLog`(`entityType`);
CREATE INDEX idx_reports_reportType ON `reports`(`reportType`);
CREATE INDEX idx_reports_generatedBy ON `reports`(`generatedBy`);
