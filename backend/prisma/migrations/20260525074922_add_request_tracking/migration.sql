-- AlterTable
ALTER TABLE `fundrequest` ADD COLUMN `isModified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `modifiedAt` DATETIME(3) NULL,
    ADD COLUMN `modifiedCount` INTEGER NOT NULL DEFAULT 0;
