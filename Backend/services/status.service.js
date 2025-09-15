const { checkEmailServiceStatus } = require('./email.service');

/**
 * يتحقق من حالة اتصال قاعدة البيانات.
 * @param {PrismaClient} prisma - عميل Prisma.
 * @returns {Promise<{status: string, details: string}>}
 */
async function checkDatabaseStatus(prisma) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'OPERATIONAL', details: 'الاتصال بقاعدة البيانات ناجح.' };
  } catch (error) {
    return { status: 'OUTAGE', details: `فشل الاتصال بقاعدة البيانات: ${error.message}` };
  }
}

/**
 * يتحقق من حالة اتصال Redis.
 * @param {import('ioredis').Redis} redisClient - عميل ioredis.
 * @returns {Promise<{status: string, details: string}>}
 */
async function checkRedisStatus(redisClient) {
  try {
    const reply = await redisClient.ping();
    if (reply === 'PONG') {
      return { status: 'OPERATIONAL', details: 'الاتصال بـ Redis ناجح.' };
    }
    return { status: 'DEGRADED', details: `استجابة غير متوقعة من Redis: ${reply}` };
  } catch (error) {
    return { status: 'OUTAGE', details: `فشل الاتصال بـ Redis: ${error.message}` };
  }
}

/**
 * يتحقق من حالة خدمة البريد الإلكتروني.
 * @returns {Promise<{status: string, details: string}>}
 */
async function checkEmailService() {
  try {
    await checkEmailServiceStatus();
    return { status: 'OPERATIONAL', details: 'الاتصال بخادم البريد الإلكتروني ناجح.' };
  } catch (error) {
    return { status: 'OUTAGE', details: `فشل الاتصال بخادم البريد: ${error.message}` };
  }
}

/**
 * يجمع حالات جميع الخدمات.
 * @param {PrismaClient} prisma
 * @param {import('ioredis').Redis} redisClient
 * @returns {Promise<object>}
 */
async function getSystemStatus(prisma, redisClient, log) {
  log.info('Fetching system status...');
  const services = [
    { name: 'قاعدة البيانات (MySQL)', check: () => checkDatabaseStatus(prisma) },
    { name: 'التخزين المؤقت (Redis)', check: () => checkRedisStatus(redisClient) },
    { name: 'خدمة البريد الإلكتروني', check: () => checkEmailService() },
  ];

  const results = await Promise.all(services.map(async (service) => {
    const { status, details } = await service.check();
    return { name: service.name, status, details };
  }));

  const isOutage = results.some(s => s.status === 'OUTAGE');
  const isDegraded = results.some(s => s.status === 'DEGRADED');

  const overallStatus = isOutage ? 'OUTAGE' : isDegraded ? 'DEGRADED' : 'OPERATIONAL';

  log.info({ overallStatus, services: results }, 'System status fetched successfully.');

  return {
    overallStatus,
    timestamp: new Date().toISOString(),
    services: results,
  };
}

module.exports = { getSystemStatus };