-- AlterTable
ALTER TABLE `fundrequest` ADD COLUMN `isLockedForEdit` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `viewedByFinanceAt` DATETIME(3) NULL,
    ADD COLUMN `viewedByHODAt` DATETIME(3) NULL;
