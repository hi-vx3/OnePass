require('dotenv').config();
   const express = require('express');
   const cors = require('cors');
   const { PrismaClient } = require('@prisma/client');
   const session = require('express-session');
   const RedisStore = require('connect-redis').default;
   const Redis = require('ioredis');
   const createOAuthRouter = require('./routes/oauth.routes');
   const createAuthRouter = require('./routes/auth.routes');   
   const createUserRouter = require('./routes/user.routes');
   const createDashboardRouter = require('./routes/dashboard.routes');
   const errorHandler = require('./utils/errorHandler');
   const { initializeLogger } = require('./utils/logger');
   const { verifyTransporter } = require('./services/email.service');

   const app = express();
   const prisma = new PrismaClient();
   const log = initializeLogger();
   verifyTransporter(log);

   // Add a check for the session secret to prevent startup without it
   if (!process.env.SESSION_SECRET) {
     log.error('FATAL ERROR: SESSION_SECRET is not defined in the environment variables. Please check your .env file.');
     process.exit(1); // Exit the application if the secret is not set
   }

   // Add a check for the JWT secret
   if (!process.env.JWT_SECRET) {
     log.error('FATAL ERROR: JWT_SECRET is not defined in the environment variables. Please check your .env file.');
     process.exit(1);
   }


   // Initialize Redis client
   const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
   redisClient.on('error', (err) => log.error({ err }, 'Redis Client Error'));
   redisClient.on('connect', () => log.info('Connected to Redis'));

   // Initialize Redis store
   const redisStore = new RedisStore({
     client: redisClient,
     prefix: 'onepass:session:',
   });

   // Enable CORS for requests from http://localhost (or specific frontend origin)
app.use(cors({
  origin: 'http://localhost:3000', // Allow requests from the frontend on port 3001
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

   // Session middleware
   app.use(
     session({
       store: redisStore,
       resave: false,
       saveUninitialized: false,
       secret: process.env.SESSION_SECRET,
       cookie: {
         secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
         httpOnly: true, // Prevent client-side access
         maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
         sameSite: 'lax',
       },
     })
   );

   log.info(`Environment variables: EMAIL_HOST=${process.env.EMAIL_HOST}, EMAIL_PORT=${process.env.EMAIL_PORT}, EMAIL_USER=${process.env.EMAIL_USER}`);

   app.use(express.json());
   app.use('/api/oauth', createOAuthRouter(prisma, log));
   app.use('/api/auth', createAuthRouter(prisma, log));
   app.use('/api/user', createUserRouter(prisma, log));
   app.use('/api/dashboard', createDashboardRouter(prisma, log));

   // Global error handler
   app.use((err, req, res, next) => errorHandler(err, req, res, next, log));

   const PORT = process.env.PORT || 3001;
   app.listen(PORT, () => {
     log.info(`Server running on port ${PORT}`);
   });