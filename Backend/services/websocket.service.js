const { WebSocketServer } = require('ws');

// خريطة لتخزين اتصالات المستخدمين النشطة
// Map<userId: number, ws: WebSocket>
const clients = new Map();

let wss;

/**
 * تهيئة خادم WebSocket وربطه بخادم HTTP.
 * @param {http.Server} server - خادم HTTP.
 * @param {Function} sessionParser - Middleware لتحليل الجلسات.
 * @param {pino.Logger} log - أداة تسجيل الأحداث.
 */
function initializeWebSocket(server, sessionParser, log) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    log.info('New WebSocket connection initiated.');

    // استخدام sessionParser للوصول إلى بيانات الجلسة
    sessionParser(req, {}, () => {
      if (!req.session || !req.session.user || !req.session.user.id) {
        log.warn('WebSocket connection attempt without authentication. Closing connection.');
        ws.close(1008, 'User not authenticated');
        return;
      }

      const userId = Number(req.session.user.id);
      clients.set(userId, ws);
      log.info(`WebSocket connection established for user ID: ${userId}`);

      ws.on('message', (message) => {
        // يمكنك هنا معالجة الرسائل الواردة من العميل إذا لزم الأمر
        log.info(`Received message from user ${userId}: ${message}`);
      });

      ws.on('close', () => {
        clients.delete(userId);
        log.info(`WebSocket connection closed for user ID: ${userId}`);
      });

      ws.on('error', (error) => {
        log.error({ err: error }, `WebSocket error for user ID: ${userId}`);
      });
    });
  });

  log.info('WebSocket server initialized.');
}

/**
 * إرسال إشعار إلى مستخدم معين عبر WebSocket.
 * @param {number} userId - معرف المستخدم.
 * @param {object} payload - البيانات المراد إرسالها (سيتم تحويلها إلى JSON).
 */
function sendNotificationToUser(userId, payload) {
  const ws = clients.get(Number(userId));
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

module.exports = {
  initializeWebSocket,
  sendNotificationToUser,
};