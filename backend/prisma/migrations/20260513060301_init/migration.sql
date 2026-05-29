-- CreateTable
CREATE TABLE `Department` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Department_name_key`(`name`),
    UNIQUE INDEX `Department_code_key`(`code`),
    INDEX `Department_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'HOD', 'FINANCE') NOT NULL DEFAULT 'USER',
    `departmentId` INTEGER NOT NULL,
    `approvalLimit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_email_idx`(`email`),
    INDEX `User_role_idx`(`role`),
    INDEX `User_departmentId_idx`(`departmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HODHierarchy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `departmentId` INTEGER NOT NULL,
    `level` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HODHierarchy_userId_key`(`userId`),
    INDEX `HODHierarchy_departmentId_level_idx`(`departmentId`, `level`),
    UNIQUE INDEX `HODHierarchy_departmentId_level_key`(`departmentId`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FundRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestNumber` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `purpose` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_HOD_APPROVAL', 'HOD_APPROVED', 'PENDING_FINANCE_APPROVAL', 'FINANCE_APPROVED', 'FINANCE_REJECTED', 'NEEDS_REVIEW', 'RESUBMITTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `createdById` INTEGER NOT NULL,
    `currentLevel` INTEGER NOT NULL DEFAULT 0,
    `totalHodLevels` INTEGER NOT NULL DEFAULT 0,
    `submittedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FundRequest_requestNumber_key`(`requestNumber`),
    INDEX `FundRequest_createdById_idx`(`createdById`),
    INDEX `FundRequest_status_idx`(`status`),
    INDEX `FundRequest_requestNumber_idx`(`requestNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalStep` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fundRequestId` INTEGER NOT NULL,
    `approverId` INTEGER NOT NULL,
    `hodLevel` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED', 'WAITING') NOT NULL DEFAULT 'WAITING',
    `remarks` TEXT NULL,
    `actionAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ApprovalStep_fundRequestId_idx`(`fundRequestId`),
    INDEX `ApprovalStep_approverId_idx`(`approverId`),
    INDEX `ApprovalStep_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FinanceReview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fundRequestId` INTEGER NOT NULL,
    `reviewedById` INTEGER NOT NULL,
    `action` ENUM('APPROVED', 'REJECTED', 'NEEDS_REVIEW') NOT NULL,
    `remarks` TEXT NULL,
    `reviewedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FinanceReview_fundRequestId_idx`(`fundRequestId`),
    INDEX `FinanceReview_reviewedById_idx`(`reviewedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Comment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fundRequestId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Comment_fundRequestId_idx`(`fundRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fundRequestId` INTEGER NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Attachment_fundRequestId_idx`(`fundRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `fundRequestId` INTEGER NULL,
    `type` ENUM('APPROVAL_REQUIRED', 'REQUEST_APPROVED', 'REQUEST_REJECTED', 'FINANCE_REVIEW', 'STATUS_UPDATE', 'COMMENT_ADDED', 'NEEDS_REVIEW') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Notification_userId_isRead_idx`(`userId`, `isRead`),
    INDEX `Notification_fundRequestId_idx`(`fundRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fundRequestId` INTEGER NOT NULL,
    `actorId` INTEGER NOT NULL,
    `actorRole` ENUM('USER', 'HOD', 'FINANCE') NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('DRAFT', 'SUBMITTED', 'PENDING_HOD_APPROVAL', 'HOD_APPROVED', 'PENDING_FINANCE_APPROVAL', 'FINANCE_APPROVED', 'FINANCE_REJECTED', 'NEEDS_REVIEW', 'RESUBMITTED', 'CANCELLED') NULL,
    `toStatus` ENUM('DRAFT', 'SUBMITTED', 'PENDING_HOD_APPROVAL', 'HOD_APPROVED', 'PENDING_FINANCE_APPROVAL', 'FINANCE_APPROVED', 'FINANCE_REJECTED', 'NEEDS_REVIEW', 'RESUBMITTED', 'CANCELLED') NULL,
    `remarks` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkflowHistory_fundRequestId_idx`(`fundRequestId`),
    INDEX `WorkflowHistory_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HODHierarchy` ADD CONSTRAINT `HODHierarchy_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HODHierarchy` ADD CONSTRAINT `HODHierarchy_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FundRequest` ADD CONSTRAINT `FundRequest_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalStep` ADD CONSTRAINT `ApprovalStep_fundRequestId_fkey` FOREIGN KEY (`fundRequestId`) REFERENCES `FundRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalStep` ADD CONSTRAINT `ApprovalStep_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinanceReview` ADD CONSTRAINT `FinanceReview_fundRequestId_fkey` FOREIGN KEY (`fundRequestId`) REFERENCES `FundRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinanceReview` ADD CONSTRAINT `FinanceReview_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_fundRequestId_fkey` FOREIGN KEY (`fundRequestId`) REFERENCES `FundRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_fundRequestId_fkey` FOREIGN KEY (`fundRequestId`) REFERENCES `FundRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_fundRequestId_fkey` FOREIGN KEY (`fundRequestId`) REFERENCES `FundRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowHistory` ADD CONSTRAINT `WorkflowHistory_fundRequestId_fkey` FOREIGN KEY (`fundRequestId`) REFERENCES `FundRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowHistory` ADD CONSTRAINT `WorkflowHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
