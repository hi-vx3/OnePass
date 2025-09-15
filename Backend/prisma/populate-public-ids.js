const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Generates a unique, large random number to be used as a public ID.
 * @returns {BigInt}
 */
function generateNumericPublicId() {
  const buffer = crypto.randomBytes(8); // 8 bytes for a 64-bit number
  return buffer.readBigUInt64BE();
}

async function main() {
  // 1. Find all users where publicId is null
  const usersToUpdate = await prisma.user.findMany({
    where: {
      publicId: null,
    },
  });

  if (usersToUpdate.length === 0) {
    console.log('✅ All users already have a publicId. No action needed.');
    return;
  }

  console.log(`Found ${usersToUpdate.length} users without a publicId. Populating now...`);

  // 2. Create an update promise for each user
  const updatePromises = usersToUpdate.map(user =>
    prisma.user.update({
      where: { id: user.id },
      data: { publicId: generateNumericPublicId() },
    })
  );

  // 3. Execute all updates in a transaction
  await prisma.$transaction(updatePromises);

  console.log(`✅ Successfully populated publicId for ${usersToUpdate.length} users.`);
}

main()
  .catch(e => {
    console.error('Error populating publicIds:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });