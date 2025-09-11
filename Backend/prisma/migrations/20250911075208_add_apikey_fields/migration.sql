/*
  Warnings:

  - You are about to drop the column `key` on the `apikey` table. All the data in the column will be lost.
  - You are about to drop the column `maskedKey` on the `apikey` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `apikey` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[client_id]` on the table `ApiKey` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `client_id` to the `ApiKey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `client_secret` to the `ApiKey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hashed_secret` to the `ApiKey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `ApiKey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `redirect_uris` to the `ApiKey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `ApiKey` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `apikey` DROP FOREIGN KEY `ApiKey_userId_fkey`;

-- DropIndex
DROP INDEX `ApiKey_key_key` ON `apikey`;

-- DropIndex
DROP INDEX `ApiKey_userId_fkey` ON `apikey`;

-- AlterTable
ALTER TABLE `apikey` DROP COLUMN `key`,
    DROP COLUMN `maskedKey`,
    DROP COLUMN `userId`,
    ADD COLUMN `client_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `client_secret` VARCHAR(191) NOT NULL,
    ADD COLUMN `hashed_secret` VARCHAR(191) NOT NULL,
    ADD COLUMN `logo_url` VARCHAR(191) NULL,
    ADD COLUMN `name` VARCHAR(191) NOT NULL,
    ADD COLUMN `redirect_uris` TEXT NOT NULL,
    ADD COLUMN `user_id` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `AuthorizationCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `redirect_uri` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AuthorizationCode_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `ApiKey_client_id_key` ON `ApiKey`(`client_id`);

-- AddForeignKey
ALTER TABLE `ApiKey` ADD CONSTRAINT `ApiKey_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
