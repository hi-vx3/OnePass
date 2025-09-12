-- AlterTable
ALTER TABLE `authorizationcode` ADD COLUMN `code_challenge` VARCHAR(191) NULL,
    ADD COLUMN `code_challenge_method` VARCHAR(191) NULL;
