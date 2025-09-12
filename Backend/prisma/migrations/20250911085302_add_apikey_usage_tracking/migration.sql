-- AlterTable
ALTER TABLE `apikey` ADD COLUMN `last_used_at` DATETIME(3) NULL,
    ADD COLUMN `request_count` INTEGER NOT NULL DEFAULT 0;
