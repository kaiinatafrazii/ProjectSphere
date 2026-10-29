import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../src/config/db.js';

dotenv.config();

const ownerId = process.env.DEV_SEED_OWNER_ID;
if (!ownerId) {
  console.error('Set DEV_SEED_OWNER_ID to an existing account ID before running the optional development seed.');
  process.exitCode = 1;
} else {
  const owner = db.prepare('SELECT id FROM users WHERE id = ?').get(ownerId);
  if (!owner) {
    console.error('The configured development seed owner does not exist.');
    process.exitCode = 1;
  } else {
    const id = uuidv4();
    db.prepare(
      `INSERT INTO projects
       (id, user_id, title, tagline, category, tech_stack, summary, overview, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).run(
      id,
      ownerId,
      'Development sample project',
      'An example submission for local dashboard testing.',
      'Developer Tools',
      JSON.stringify(['React', 'Node.js', 'SQLite']),
      'A local-only example project created by the explicit development seed command.',
      'Use this record to exercise dashboard listing and moderation in a development environment.'
    );
    console.log(`Created a pending development project (${id}).`);
  }
}

db.close();
