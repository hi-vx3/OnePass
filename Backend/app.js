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
const errorHandler = require('./utils/errorHandler');
const { initializeLogger } = require('./utils/logger');
const { verifyTransporter } = require('./services/email.service');
const { initializeWebSocket } = require('./services/websocket.service'); // <-- إضافة خدمة WebSocket
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
  prefix: 'onepass:session:',
});

// --- إعدادات CORS ---
// في بيئة التطوير، اسمح بالطلبات من أي مصدر لتسهيل الاختبار.
// في بيئة الإنتاج، سيتم تقييده إلى FRONTEND_URL فقط.
const isProduction = process.env.NODE_ENV === 'production';
const corsOptions = {
  origin: isProduction ? process.env.FRONTEND_URL : (origin, callback) => callback(null, true),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

log.info({ corsOrigin: isProduction ? process.env.FRONTEND_URL : 'any' }, 'CORS configured');
app.use(cors(corsOptions));

// --- إعدادات الجلسات (Sessions) ---
const sessionParser = 
  session({
    store: redisStore,
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // استخدم Secure Cookies في بيئة الإنتاج
      httpOnly: true, // منع الوصول من جهة العميل
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 أيام
      sameSite: 'lax',
    },
  })
;
app.use(sessionParser); // <-- استخدام middleware الجلسات
initializeWebSocket(server, sessionParser, log); // <-- تهيئة خادم WebSocket

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
app.use('/api/auth', createAuthRouter(prisma, log));

// 2. مسارات OAuth 2.0 (هذا هو "محاكي Netflix" لتسجيل دخول الطرف الثالث)
//    - /api/oauth/authorize: نقطة البداية، حيث يوافق المستخدم على منح الإذن للتطبيق الثالث.
//    - /api/oauth/token: حيث يتبادل التطبيق الثالث الـ "Authorization Code" بـ "Access Token".
app.use('/api/oauth', createOAuthRouter(prisma, log));

// 3. مسارات المستخدم (لإدارة مفاتيح API والملف الشخصي)
app.use('/api/user', createUserRouter(prisma, log));

// 4. مسارات لوحة التحكم (Dashboard)
app.use('/api/dashboard', createDashboardRouter(prisma, log));

// 5. مسارات Webhooks (لاستقبال إشعارات من خدمات أخرى)
app.use('/api/webhooks', createWebhookRouter(prisma, log));

// 6. مسار حالة النظام (Status Page)
app.use('/api/status', createStatusRouter(prisma, redisClient, log));

// --- معالج الأخطاء العام (Global Error Handler) ---
app.use((err, req, res, next) => errorHandler(err, req, res, next, log));

// --- بدء تشغيل الخادم ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => { // <-- تشغيل خادم http بدلاً من app
  log.info(`Server running on port ${PORT}`);
});