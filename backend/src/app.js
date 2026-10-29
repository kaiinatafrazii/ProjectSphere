import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimit } from 'express-rate-limit';
import { submitContactMessage } from './controllers/contactController.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const app = express();
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const localDevelopmentOrigin =
        process.env.NODE_ENV !== 'production' &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (origin === frontendUrl || localDevelopmentOrigin) {
        return callback(null, origin);
      }

      return callback(new Error('Origin is not allowed by CORS.'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

app.post(
  '/api/contact',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'Too many messages sent. Please try again later.' },
  }),
  submitContactMessage
);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

app.use(errorHandler);

export default app;
