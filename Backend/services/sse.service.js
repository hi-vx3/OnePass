const clients = new Map();

let sseLog;

/**
 * @description إرسال حدث إلى عميل معين.
 * @param {import('express').Response} clientRes - كائن الاستجابة للعميل.
 * @param {string} event - اسم الحدث.
 * @param {object} data - البيانات المراد إرسالها.
 */
function sendEvent(clientRes, event, data) {
  clientRes.write(`event: ${event}\n`);
  clientRes.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * @description تهيئة نقطة وصول SSE.
 * @param {import('express').Router} router - موجه Express.
 * @param {import('pino').Logger} log - مسجل الأحداث.
 */
function initializeSSE(router, log) {
  sseLog = log.child({ service: 'sse' });

  router.get('/stream', (req, res) => {
    const userId = Number(req.session.user.id);

    // إعداد Headers الخاصة بـ SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // إرسال رسالة أولية للاتصال
    sendEvent(res, 'open', { message: 'SSE connection established.' });
    sseLog.info(`SSE connection opened for user ID: ${userId}`);

    clients.set(userId, res);

    // إرسال ping للحفاظ على الاتصال
    const pingInterval = setInterval(() => {
      res.write(':ping\n\n');
    }, 30000); // كل 30 ثانية

    req.on('close', () => {
      clearInterval(pingInterval);
      clients.delete(userId);
      sseLog.info(`SSE connection closed for user ID: ${userId}`);
    });
  });
}

function sendEventToUser(userId, event, data) {
  const clientRes = clients.get(Number(userId));
  if (clientRes) {
    sendEvent(clientRes, event, data);
  }
}

module.exports = { initializeSSE, sendEventToUser };