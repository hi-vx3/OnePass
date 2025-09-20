const { WebSocketServer } = require('ws');

// خريطة لتخزين اتصالات المستخدمين النشطة
// Map<userId, Map<sessionId, WebSocket>>
const userConnections = new Map();

let wss;
let wsLog;


/**
 * تهيئة خادم WebSocket وربطه بخادم HTTP.
 * @param {http.Server} server - خادم HTTP.
 * @param {Function} sessionParser - Middleware لتحليل الجلسات.
 * @param {pino.Logger} log - أداة تسجيل الأحداث.
 */
function initializeWebSocket(server, sessionParser, log) {
  wss = new WebSocketServer({ server });
  wsLog = log.child({ service: 'websocket' });

  wss.on('connection', (ws, req) => {
    wsLog.info('New WebSocket connection initiated.');

    // استخدام sessionParser للوصول إلى بيانات الجلسة
    sessionParser(req, {}, () => {
      if (!req.session || !req.session.user || !req.session.user.id) {
        wsLog.warn('WebSocket connection attempt without authentication. Closing connection.');
        ws.close(1008, 'User not authenticated');
        return;
      }

      const userId = Number(req.session.user.id);
      const sessionId = req.sessionID;

      // إذا لم يكن للمستخدم خريطة جلسات، قم بإنشائها
      if (!userConnections.has(userId)) {
        userConnections.set(userId, new Map());
      }

      // تخزين اتصال WebSocket مع معرف الجلسة
      const userSessionMap = userConnections.get(userId);
      userSessionMap.set(sessionId, { ws, connectedAt: new Date() });

      wsLog.info(`WebSocket connection established for user ID: ${userId}, session ID: ${sessionId}`);

      // إرسال حدث "متصل" إلى جميع الجلسات الأخرى لنفس المستخدم
      broadcastToUser(userId, { type: 'session_online', payload: { sessionId } }, sessionId);

      ws.on('message', (message) => {
        // يمكنك هنا معالجة الرسائل الواردة من العميل إذا لزم الأمر
        wsLog.info(`Received message from user ${userId}: ${message}`);
      });

      ws.on('close', () => {
        if (userConnections.has(userId)) {
          const userSessionMap = userConnections.get(userId);
          userSessionMap.delete(sessionId);
          // إذا لم يتبق أي جلسات للمستخدم، قم بإزالة المستخدم من الخريطة
          if (userSessionMap.size === 0) {
            userConnections.delete(userId);
          }
        }
        wsLog.info(`WebSocket connection closed for user ID: ${userId}, session ID: ${sessionId}`);
        // إرسال حدث "غير متصل" إلى جميع الجلسات الأخرى لنفس المستخدم
        broadcastToUser(userId, { type: 'session_offline', payload: { sessionId } });
      });

      ws.on('error', (error) => {
        wsLog.error({ err: error }, `WebSocket error for user ID: ${userId}, session ID: ${sessionId}`);
      });
    });
  });

  wsLog.info('WebSocket server initialized.');
}

/**
 * إرسال إشعار إلى مستخدم معين عبر WebSocket.
 * @param {number} userId - معرف المستخدم.
 * @param {object} payload - البيانات المراد إرسالها (سيتم تحويلها إلى JSON).
 * @param {string|null} excludeSessionId - معرف الجلسة التي لا يجب الإرسال إليها.
 */
function broadcastToUser(userId, payload, excludeSessionId = null) {
  const userSessionMap = userConnections.get(Number(userId));
  if (userSessionMap) {
    for (const [sessionId, connection] of userSessionMap.entries()) {
      const ws = connection.ws; // استخراج كائن WebSocket الفعلي
      if (sessionId !== excludeSessionId && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    }
  }
}

/**
 * يتحقق مما إذا كانت جلسة معينة متصلة حاليًا.
 * @param {number} userId
 * @param {string} sessionId
 * @returns {boolean}
 */
function getSessionOnlineDetails(userId, sessionId) {
  const userSessionMap = userConnections.get(Number(userId));
  const connection = userSessionMap?.get(sessionId);
  return connection ? { isOnline: true, connectedAt: connection.connectedAt.toISOString() } : { isOnline: false, connectedAt: null };
}

// إعادة تسمية الدالة القديمة للحفاظ على التوافق
const sendNotificationToUser = broadcastToUser;

module.exports = {
  initializeWebSocket,
  sendNotificationToUser,
  broadcastToUser,
  getSessionOnlineDetails,
};