/*
  Warnings:

  - A unique constraint covering the columns `[pending_email]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `user` ADD COLUMN `pending_email` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_pending_email_key` ON `User`(`pending_email`);
