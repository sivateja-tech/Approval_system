-- AlterTable
ALTER TABLE `fundrequest` ADD COLUMN `endDate` DATETIME(3) NULL,
    ADD COLUMN `fundReturnNote` TEXT NULL,
    ADD COLUMN `fundUsed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `startDate` DATETIME(3) NULL;
