import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const ownerId = process.env.DEV_SEED_OWNER_ID;
const sampleProjects = [
  {
    title: 'PulseBoard',
    tagline: 'A thoughtful dashboard for shipping healthier team rituals.',
    category: 'Productivity',
    techStack: ['React', 'Node.js', 'MySQL'],
    summary: 'A collaborative planning tool designed to help small teams turn goals into visible weekly momentum.',
    overview: 'PulseBoard combines goal tracking, sprint planning, and team check-ins in one calm workspace tailored for distributed product teams.',
    status: 'featured',
    screenshotUrl: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80',
    repoUrl: 'https://github.com/example/pulseboard',
    liveUrl: 'https://pulseboard.example.com',
  },
  {
    title: 'AgriSense AI',
    tagline: 'AI field signals for smarter crop health decisions.',
    category: 'AI/ML',
    techStack: ['Python', 'TensorFlow', 'FastAPI'],
    summary: 'An explainable crop-monitoring workflow that blends satellite imagery and in-field sensor data to flag stress early.',
    overview: 'AgriSense AI helps growers act on environmental anomalies quickly by highlighting at-risk plots and summarizing what changed over time.',
    status: 'published',
    screenshotUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
    repoUrl: 'https://github.com/example/agrisense-ai',
    liveUrl: 'https://agrisense.example.com',
  },
  {
    title: 'CodeCanvas',
    tagline: 'Design, prototype, and review product ideas faster.',
    category: 'Developer Tools',
    techStack: ['TypeScript', 'Vite', 'Node.js'],
    summary: 'A lightweight studio for collecting design ideas, organizing notes, and turning them into interactive prototypes.',
    overview: 'CodeCanvas is a concept playground for product teams that need to sketch flows, test ideas, and collect feedback without leaving the browser.',
    status: 'published',
    screenshotUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1200&q=80',
    repoUrl: 'https://github.com/example/codecanvas',
    liveUrl: 'https://codecanvas.example.com',
  },
];

async function seedDevelopmentProjects() {
  const { closeDatabase, initializeDatabase, pool } = await import('../src/config/db.js');
  try {
    await initializeDatabase();
    const connection = await pool.getConnection();
    const seededProjects = [];
    try {
      await connection.beginTransaction();
      let targetOwnerId = ownerId;
      if (!targetOwnerId) {
        const [users] = await connection.execute('SELECT id FROM users ORDER BY created_at ASC LIMIT 1');
        targetOwnerId = users[0]?.id;
      }
      if (!targetOwnerId) {
        throw new Error('Create an account or run npm run setup:admin before seeding development projects.');
      }

      const [owners] = await connection.execute('SELECT id FROM users WHERE id = ?', [targetOwnerId]);
      if (!owners.length) throw new Error('The configured development seed owner does not exist.');

      for (const project of sampleProjects) {
        const id = uuidv4();
        await connection.execute(
          `INSERT INTO projects
           (id, user_id, title, tagline, category, tech_stack, summary, overview, repo_url, live_url, screenshot_url, likes, views, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
          [
            id,
            targetOwnerId,
            project.title,
            project.tagline,
            project.category,
            JSON.stringify(project.techStack),
            project.summary,
            project.overview,
            project.repoUrl,
            project.liveUrl,
            project.screenshotUrl,
            project.status,
          ]
        );
        seededProjects.push({ id, title: project.title, status: project.status });
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    console.log(`Created ${seededProjects.length} demo projects for development.`);
    seededProjects.forEach((project) => console.log(`- ${project.title} (${project.status}) -> ${project.id}`));
  } finally {
    await closeDatabase();
  }
}

seedDevelopmentProjects().catch((error) => {
  console.error(`Development seed failed: ${error.message}`);
  process.exitCode = 1;
});
