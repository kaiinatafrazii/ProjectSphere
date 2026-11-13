import app from './app.js';
import dotenv from 'dotenv';
import { initializeDatabase } from './config/db.js';

dotenv.config();

const PORT = Number(process.env.PORT || 5000);

try {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`ProjectSphere API running on http://localhost:${PORT}`);
  });
} catch (error) {
  console.error('Database initialization failed:', error);
  process.exitCode = 1;
}
