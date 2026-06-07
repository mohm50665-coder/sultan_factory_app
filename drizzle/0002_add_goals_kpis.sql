-- جدول الأهداف الشهرية
CREATE TABLE `monthlyGoals` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `month` varchar(20) NOT NULL,
  `department` varchar(255) NOT NULL,
  `goalType` enum('production', 'sales', 'quality', 'efficiency', 'safety', 'custom') NOT NULL,
  `goalName` varchar(255) NOT NULL,
  `targetValue` int NOT NULL,
  `unit` varchar(50) NOT NULL,
  `weight` int DEFAULT 100,
  `description` text,
  `status` enum('active', 'completed', 'cancelled') DEFAULT 'active',
  `createdBy` int NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_month_department` (`month`, `department`),
  KEY `idx_status` (`status`)
);

-- جدول تتبع إنجاز الأهداف
CREATE TABLE `goalProgress` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `goalId` int NOT NULL,
  `date` varchar(20) NOT NULL,
  `achievedValue` int NOT NULL,
  `percentage` int DEFAULT 0,
  `notes` text,
  `recordedBy` int NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_goalId` (`goalId`),
  KEY `idx_date` (`date`)
);

-- جدول مؤشرات الأداء (KPIs)
CREATE TABLE `kpis` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `month` varchar(20) NOT NULL,
  `department` varchar(255) NOT NULL,
  `kpiName` varchar(255) NOT NULL,
  `kpiType` enum('production', 'quality', 'efficiency', 'safety', 'financial', 'custom') NOT NULL,
  `currentValue` int NOT NULL,
  `targetValue` int NOT NULL,
  `previousValue` int DEFAULT 0,
  `unit` varchar(50) NOT NULL,
  `status` enum('on_track', 'at_risk', 'off_track', 'exceeded') DEFAULT 'on_track',
  `trend` enum('up', 'down', 'stable') DEFAULT 'stable',
  `notes` text,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_month_department` (`month`, `department`),
  KEY `idx_status` (`status`)
);
