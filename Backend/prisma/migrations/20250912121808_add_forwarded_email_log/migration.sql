-- CreateTable
CREATE TABLE `ForwardedEmailLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `virtualEmailAddress` VARCHAR(191) NOT NULL,
    `senderAddress` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `forwardedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ForwardedEmailLog` ADD CONSTRAINT `ForwardedEmailLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
