-- AlterTable
ALTER TABLE `user` ADD COLUMN `totpLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `totpBlockedUntil` DATETIME(3) NULL;