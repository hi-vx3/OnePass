require('dotenv').config();
const express = require('express');
const http = require('http'); // <-- إضافة وحدة http
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const Redis = require('ioredis');
const createOAuthRouter = require('./routes/oauth.routes');
const createAuthRouter = require('./routes/auth.routes');
const createUserRouter = require('./routes/user.routes');
const createDashboardRouter = require('./routes/dashboard.routes');
const createWebhookRouter = require('./routes/webhook.routes');
const createStatusRouter = require('./routes/status.routes'); // <-- إضافة مسار الحالة
const createPaymentRouter = require('./routes/payment.routes'); // <-- إضافة مسار الدفع
const createSessionRouter = require('./routes/session.routes'); // <-- إضافة مسار الجلسات
const createNotificationRouter = require('./routes/notification.routes'); // <-- إضافة مسار الإشعارات
const errorHandler = require('./utils/errorHandler');
const { initializeLogger } = require('./utils/logger');
const { verifyTransporter } = require('./services/email.service');
const { initializeWebSocket } = require('./services/websocket.service');
const path = require('path');

// --- تهيئة أساسية ---
const app = express();
const prisma = new PrismaClient();
const log = initializeLogger();
const server = http.createServer(app); // <-- إنشاء خادم http من Express

// --- التحقق من متغيرات البيئة الأساسية عند بدء التشغيل ---
if (!process.env.SESSION_SECRET || !process.env.JWT_SECRET) {
  log.error(
    'FATAL ERROR: SESSION_SECRET or JWT_SECRET is not defined in .env file.'
  );
  process.exit(1);
}

// --- التحقق من اتصال خدمة البريد الإلكتروني ---
verifyTransporter(log);

// --- إعداد اتصال Redis ---
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
redisClient.on('error', (err) => log.error({ err }, 'Redis Client Error'));
redisClient.on('connect', () => log.info('Connected to Redis'));

// --- إعداد مخزن الجلسات باستخدام Redis ---
const redisStore = new RedisStore({
  client: redisClient,
  // تحديد البادئة لضمان تطابقها مع ما يتم البحث عنه في user.routes.js
  prefix: 'onepass:session:',
});

// --- إعدادات CORS ---
// في بيئة التطوير، اسمح بالطلبات من أي مصدر لتسهيل الاختبار.
// في بيئة الإنتاج، سيتم تقييده إلى FRONTEND_URL فقط.
const isProduction = process.env.NODE_ENV === 'production';
const corsOptions = {
  origin: isProduction ? process.env.FRONTEND_URL : 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

log.info({ corsOrigin: isProduction ? process.env.FRONTEND_URL : 'any' }, 'CORS configured');
app.use(cors(corsOptions));

// --- إعدادات الجلسات (Sessions) ---
const sessionParser = session({
  store: redisStore,
  resave: false,
  saveUninitialized: false,
  secret: process.env.SESSION_SECRET,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 أيام
    sameSite: 'lax',
  },
  // إنشاء مفتاح جلسة مخصص لربطه بالمستخدم
  genid: function (req) {
    // استخدم uuid أو طريقة أخرى لتوليد ID فريد
    const { v4: uuidv4 } = require('uuid');
    return uuidv4();
  },
  // اسم مفتاح الجلسة في Redis
  name: 'onepass.sid',
});
app.use(sessionParser); // <-- استخدام middleware الجلسات
initializeWebSocket(server, sessionParser, log); // <-- تهيئة خادم WebSocket

// --- Middleware لتسجيل معلومات الطلب في الجلسة ---
// هذا يضمن أن كل جلسة تحتوي على أحدث IP و userAgent
app.use((req, res, next) => {
  if (req.session) {
    // ربط الجلسة بالمستخدم عند تسجيل الدخول
    if (req.user && req.session.userId !== req.user.id) {
      req.session.userId = req.user.id;
      // إعادة حفظ الجلسة لضمان تخزين userId
      req.session.save();
    }
    req.session.ip = req.ip;
    req.session.userAgent = req.headers['user-agent'];
    req.session.lastSeen = new Date().toISOString(); // تحديث آخر ظهور مع كل طلب
  }
  next();
});

log.info(
  `Environment variables: EMAIL_HOST=${process.env.EMAIL_HOST}, EMAIL_PORT=${process.env.EMAIL_PORT}, EMAIL_USER=${process.env.EMAIL_USER}`
);

// --- Middleware لمعالجة JSON ---
// يتم تطبيق express.json على كل المسارات ما عدا webhooks التي تحتاج إلى الجسم الخام للتحقق من التوقيع
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/webhooks')) {
      req.rawBody = buf;
    }
  },
}));

// --- Middleware لمعالجة بيانات النماذج (URL-encoded) ---
app.use(express.urlencoded({ extended: true }));

// --- Middleware لخدمة الملفات الثابتة (مثل الصور المرفوعة) ---
// هذا يجعل الملفات الموجودة في مجلد 'public' متاحة للوصول العام
app.use(express.static(path.join(__dirname, 'public')));

// --- تسجيل المسارات (Routers) ---
// 1. مسارات المصادقة الداخلية (تسجيل، دخول TOTP)
app.use('/api/auth', createAuthRouter(prisma, log, redisClient));

// 2. مسارات OAuth 2.0 (هذا هو "محاكي Netflix" لتسجيل دخول الطرف الثالث)
//    - /api/oauth/authorize: نقطة البداية، حيث يوافق المستخدم على منح الإذن للتطبيق الثالث.
//    - /api/oauth/token: حيث يتبادل التطبيق الثالث الـ "Authorization Code" بـ "Access Token".
app.use('/api/oauth', createOAuthRouter(prisma, log));

// 3. مسارات المستخدم (لإدارة الملف الشخصي، مفاتيح API، إلخ)
app.use('/api/user', createUserRouter(prisma, log, redisClient));

// 4. مسارات لوحة التحكم (Dashboard) - هذا المسار مدمج الآن ضمن user.routes.js
app.use('/api/dashboard', createDashboardRouter(prisma, log));

// 5. مسارات Webhooks (لاستقبال إشعارات من خدمات أخرى)
app.use('/api/webhooks', createWebhookRouter(prisma, log));

// 6. مسار حالة النظام (Status Page)
app.use('/api/status', createStatusRouter(prisma, redisClient, log));

// 7. مسار الإشعارات الفورية (SSE)
app.use('/api/notifications', createNotificationRouter(log));

// 8. مسارات الدفع (Stripe)
app.use('/api/payment', createPaymentRouter(prisma, log));

// 9. مسارات الجلسات (Sessions)
app.use('/api/sessions', createSessionRouter(redisClient, log));

// --- معالج الأخطاء العام (Global Error Handler) ---
app.use((err, req, res, next) => errorHandler(err, req, res, next, log));

// --- بدء تشغيل الخادم ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => { // <-- تشغيل خادم http بدلاً من app
  log.info(`Server running on port ${PORT}`);
});