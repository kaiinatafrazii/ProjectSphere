import dotenv from 'dotenv';
import { initializeDatabase, closeDatabase } from '../src/config/db.js';

dotenv.config();

async function runMigration() {
  console.log('Connecting to MySQL and ensuring database and tables are created...');
  try {
    await initializeDatabase();
    console.log('MySQL schema migrations successfully applied.');
  } catch (error) {
    console.error('MySQL migration failed:', error);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

runMigration();

