const getDashboardStats = async (userId, prisma, log) => {
  try {
    const numericUserId = Number(userId);

    // Fetch the count of unread notifications for the user
    const totalMessages = await prisma.notification.count({
      where: { userId: numericUserId, isRead: false },
    });

    const linkedSitesCount = await prisma.linkedSite.count({
      where: { userId: numericUserId },
    });

    const apiKeysCount = await prisma.apiKey.count({
      where: { userId: numericUserId },
    });

    // Fetch real linked sites from the database, limited to the 5 most recent
    const linkedSitesList = await prisma.linkedSite.findMany({
      where: { userId: numericUserId },
      orderBy: { lastActivity: 'desc' },
      take: 5,
    });

    // Fetch real recent activities from the database, limited to the 5 most recent
    const recentActivities = await prisma.activity.findMany({
      where: { userId: numericUserId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const stats = {
      totalMessages,
      linkedSites: linkedSitesCount,
      apiKeys: apiKeysCount,
      linkedSitesList,
      recentActivities,
    };

    log.info({ userId }, 'Successfully fetched dashboard stats');
    return stats;
  } catch (error) {
    log.error({ err: error, userId }, 'Error fetching dashboard stats');
    throw {
      status: 500,
      message: 'Server error while fetching dashboard stats',
      code: 'DASHBOARD_STATS_ERROR',
    };
  }
};

module.exports = {
  getDashboardStats,
};
