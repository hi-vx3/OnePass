/*
  Warnings:

  - A unique constraint covering the columns `[userId,client_id]` on the table `LinkedSite` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `client_id` to the `LinkedSite` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `linkedsite` ADD COLUMN `client_id` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `LinkedSite_userId_client_id_key` ON `LinkedSite`(`userId`, `client_id`);

-- AddForeignKey
ALTER TABLE `LinkedSite` ADD CONSTRAINT `LinkedSite_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `ApiKey`(`client_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
