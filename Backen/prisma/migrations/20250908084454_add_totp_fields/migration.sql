-- AlterTable
ALTER TABLE `user` ADD COLUMN `totpCode` VARCHAR(191) NULL,
    ADD COLUMN `totpExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `totpSecret` VARCHAR(191) NULL;
