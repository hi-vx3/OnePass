require('dotenv').config();
   const express = require('express');
   const cors = require('cors');
   const { PrismaClient } = require('@prisma/client');
   const pino = require('pino');
   const authRoutes = require('./routes/auth.routes');
   const errorHandler = require('./utils/errorHandler');
   const { logger } = require('./utils/logger');

   const app = express();
   const prisma = new PrismaClient();
   const log = logger();

   // Enable CORS for requests from http://localhost (or specific frontend origin)
   app.use(cors({
     origin: 'http://localhost', // Adjust to match your frontend origin (e.g., http://localhost:5500 if using Live Server)
     methods: ['GET', 'POST'], // Allow only GET and POST methods
     allowedHeaders: ['Content-Type'], // Allow Content-Type header
   }));

   log.info(`Environment variables: EMAIL_HOST=${process.env.EMAIL_HOST}, EMAIL_PORT=${process.env.EMAIL_PORT}, EMAIL_USER=${process.env.EMAIL_USER}`);

   app.use(express.json());
   app.use('/api/auth', authRoutes);

   // Global error handler
   app.use(errorHandler);

   const PORT = process.env.PORT || 3000;
   app.listen(PORT, () => {
     log.info(`Server running on port ${PORT}`);
   });