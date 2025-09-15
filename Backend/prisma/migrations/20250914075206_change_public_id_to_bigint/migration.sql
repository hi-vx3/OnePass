/*
  Warnings:

  - You are about to alter the column `public_id` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `BigInt`.

*/
-- AlterTable
ALTER TABLE `user` MODIFY `public_id` BIGINT NOT NULL;
