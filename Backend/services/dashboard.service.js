const getDashboardStats = async (userId, prisma, log) => {
  try {
    const numericUserId = Number(userId);

    // Fetch user's virtual email info
    const virtualEmailInfo = await prisma.virtualEmail.findUnique({
      where: { userId: numericUserId },
    });

    // Fetch the count of unread notifications for the user
    const totalMessages = await prisma.notification.count({
      where: { userId: numericUserId, isRead: false },
    });

    // Use Promise.all to fetch data concurrently on the backend
    const [
      linkedSitesCount,
      apiKeys,
      recentActivities,
      notifications,
    ] = await Promise.all([
      prisma.linkedSite.count({ where: { userId: numericUserId } }),
      prisma.apiKey.findMany({
        where: { userId: numericUserId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          clientId: true,
          redirectUris: true,
          scopes: true,
          logoUrl: true,
          createdAt: true,
          requestCount: true,
          lastUsedAt: true,
        },
      }),
      prisma.activity.findMany({
        where: { userId: numericUserId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.notification.findMany({
        where: { userId: numericUserId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Format API keys after fetching
    const formattedApiKeys = apiKeys.map(key => ({
      ...key,
      redirectUris: key.redirectUris ? key.redirectUris.split(',') : [],
      scopes: key.scopes ? key.scopes.split(',') : [],
    }));

    const stats = {
      totalMessages,
      linkedSites: linkedSitesCount,
      apiKeys: apiKeys.length, // Get count from the fetched array
      recentActivities,
      virtualEmail: virtualEmailInfo?.address || null,
      isEmailActive: virtualEmailInfo?.isActive ?? false,
      isForwardingActive: virtualEmailInfo?.isForwardingActive ?? false,
      canChange: virtualEmailInfo?.canChange ?? true, // If no email, they can create one.
      // Add the full data to the response
      apiKeysList: formattedApiKeys,
      notificationsList: notifications,
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
