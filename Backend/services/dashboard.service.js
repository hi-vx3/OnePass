const getDashboardStats = async (userId, prisma, log) => {
  try {
    const numericUserId = Number(userId);
 
    // --- تحسين الأداء: دمج جميع الاستعلامات في معاملة واحدة ---
    // هذا يقلل من عدد الرحلات إلى قاعدة البيانات ويسرّع عملية جلب البيانات.
    const [
      userWithCounts,
      recentActivities,
      notifications,
    ] = await Promise.all([
      // استعلام واحد لجلب معلومات المستخدم وعدد العناصر المرتبطة به
      prisma.user.findUnique({
        where: { id: numericUserId },
        include: {
          virtualEmail: true, // جلب معلومات البريد الوهمي
          _count: {
            select: {
              linkedSites: true, // حساب عدد المواقع المرتبطة
              apiKeys: true,     // حساب عدد مفاتيح API
              notifications: { where: { isRead: false } }, // حساب الإشعارات غير المقروءة
            },
          },
        },
      }),
      // جلب آخر 5 أنشطة فقط بدلاً من جميع الأنشطة في آخر 3 أيام
      prisma.activity.findMany({
        where: { userId: numericUserId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // جلب آخر 5 إشعارات فقط
      prisma.notification.findMany({
        where: { userId: numericUserId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);
 
    // استخراج البيانات من النتائج المدمجة
    const virtualEmailInfo = userWithCounts?.virtualEmail;
    const counts = userWithCounts?._count || {
      linkedSites: 0,
      apiKeys: 0,
      notifications: 0,
    };
 
    const stats = {
      name: userWithCounts?.name, // <-- إضافة اسم المستخدم
      email: userWithCounts?.email, // <-- إضافة البريد الإلكتروني
      totalMessages: counts.notifications,
      linkedSites: counts.linkedSites,
      apiKeys: counts.apiKeys,
      recentActivities,
      virtualEmail: virtualEmailInfo?.address || null,
      isEmailActive: virtualEmailInfo?.isActive ?? false,
      isForwardingActive: virtualEmailInfo?.isForwardingActive ?? false,
      canChange: virtualEmailInfo?.canChange ?? true, // If no email, they can create one.
      notificationsList: notifications,
    };

    log.info({ userId }, 'Successfully fetched dashboard stats');
    return stats;
  } catch (error) {
    log.error({ err: error, userId }, 'Error fetching dashboard stats');
    throw {
      status: 500,
      message: 'Server error while fetching dashboard statistics.',
      code: 'DASHBOARD_STATS_ERROR',
    };
  }
};

module.exports = {
  getDashboardStats,
};
