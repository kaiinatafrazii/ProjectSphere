import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'projectsphere',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

export const pool = mysql.createPool(config);

export const memoryStore = {
  users: [
    {
      id: 'user-1',
      name: 'Aisha Rahman',
      email: 'aisha@example.com',
      passwordHash: '$2a$10$zr7.bJ7v9dUyQ6VSX0c1XeOdfnvVL9W5mQSn6N333lUdhIxKobNh.',
      bio: 'Product-minded engineer crafting thoughtful digital experiences.',
      location: 'Dhaka, Bangladesh',
      skills: ['React', 'Node.js', 'MySQL'],
      role: 'developer',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
      savedProjects: ['project-1'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-2',
      name: 'Noah Chen',
      email: 'noah@example.com',
      passwordHash: '$2a$10$zr7.bJ7v9dUyQ6VSX0c1XeOdfnvVL9W5mQSn6N333lUdhIxKobNh.',
      bio: 'AI researcher working on practical ML systems.',
      location: 'Singapore',
      skills: ['Python', 'PyTorch', 'Research'],
      role: 'researcher',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
      savedProjects: ['project-2'],
      createdAt: new Date().toISOString(),
    },
  ],
  sessions: [],
  projects: [
    {
      id: 'project-1',
      userId: 'user-1',
      title: 'ProjectSphere',
      tagline: 'A premium project discovery hub for student and developer communities.',
      category: 'Productivity',
      techStack: ['React', 'Node.js', 'MySQL', 'Vite'],
      summary: 'A community-powered platform for discovering, publishing, and reviewing technical projects.',
      overview: 'ProjectSphere brings together project publishing, thoughtful reviews, and profile-driven discovery. It is designed for students, founders, and AI researchers looking to share technical work and get actionable feedback.',
      repoUrl: 'https://github.com/example/projectsphere',
      liveUrl: 'https://projectsphere.app',
      screenshotUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
      likes: 228,
      views: 3450,
      status: 'featured',
      createdAt: new Date().toISOString(),
      reviews: [
        { id: 'review-1', userId: 'user-2', rating: 5, comment: 'Easy to trust and delightful to explore.' },
      ],
    },
    {
      id: 'project-2',
      userId: 'user-2',
      title: 'SignalCare AI',
      tagline: 'Diagnose patient risk patterns with explainable machine learning.',
      category: 'AI/ML',
      techStack: ['Python', 'PyTorch', 'FastAPI'],
      summary: 'An explainable AI system for clinical risk scoring and patient recommendation workflows.',
      overview: 'SignalCare AI supports healthcare teams by surfacing evidence from multimodal records and ranking potential intervention pathways. The platform emphasizes interpretability and needs-driven design.',
      repoUrl: 'https://github.com/example/signalcare',
      liveUrl: 'https://signalcare.example.com',
      screenshotUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80',
      likes: 142,
      views: 2100,
      status: 'published',
      createdAt: new Date().toISOString(),
      reviews: [],
    },
    {
      id: 'project-3',
      userId: 'user-1',
      title: 'PulseBoard',
      tagline: 'Track product milestones and engineering rituals across teams.',
      category: 'Developer Tools',
      techStack: ['React', 'Express', 'PostgreSQL'],
      summary: 'A lightweight project health dashboard for teams shipping features and prototypes.',
      overview: 'PulseBoard gives engineering teams one source of truth for sprint health, issue backlog progress, and project narratives.',
      repoUrl: 'https://github.com/example/pulseboard',
      liveUrl: 'https://pulseboard.example.com',
      screenshotUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
      likes: 96,
      views: 1780,
      status: 'published',
      createdAt: new Date().toISOString(),
      reviews: [],
    },
  ],
};

export async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    if (!['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(error.code)) {
      throw error;
    }

    console.warn('MySQL is unavailable; using the non-persistent demo store:', error.message);
    return fallbackQuery(sql, params);
  }
}

function fallbackQuery(sql, params = []) {
  const normalized = sql.trim();

  if (normalized.startsWith('SELECT') && normalized.includes('FROM users')) {
    if (normalized.includes('WHERE email = ?')) {
      return memoryStore.users.filter((user) => user.email.toLowerCase() === String(params[0]).toLowerCase());
    }
    if (normalized.includes('WHERE id = ?')) {
      return memoryStore.users.filter((user) => user.id === params[0]);
    }
    return [...memoryStore.users];
  }
  if (normalized.startsWith('SELECT') && normalized.includes('FROM auth_sessions')) {
    const session = memoryStore.sessions.find((entry) => entry.id === params[0] && !entry.revokedAt);
    return session ? [session] : [];
  }
  if (normalized.startsWith('INSERT INTO auth_sessions')) {
    const [id, userId, expiresAt] = params;
    memoryStore.sessions.push({ id, userId, expiresAt, revokedAt: null });
    return { insertId: id };
  }
  if (normalized.startsWith('UPDATE auth_sessions')) {
    const [id] = params.slice(-1);
    const session = memoryStore.sessions.find((entry) => entry.id === id);
    if (session) session.revokedAt = new Date().toISOString();
    return { affectedRows: session ? 1 : 0 };
  }
  if (normalized.startsWith('SELECT') && normalized.includes('FROM projects')) {
    if (normalized.includes('WHERE id = ?')) {
      return memoryStore.projects.filter((project) => project.id === params[0]);
    }
    return [...memoryStore.projects];
  }
  if (normalized.startsWith('SELECT') && normalized.includes('FROM project_reviews')) {
    const projectId = params[0];
    const projects = projectId
      ? memoryStore.projects.filter((project) => project.id === projectId)
      : memoryStore.projects;
    return projects.flatMap((project) =>
      project.reviews.map((review) => ({
        ...review,
        project_id: project.id,
        projectId: project.id,
        userName: memoryStore.users.find((user) => user.id === review.userId)?.name || 'Community member',
      }))
    );
  }
  if (normalized.startsWith('INSERT INTO users')) {
    const [id, name, email, passwordHash, bio, avatarUrl, location, skills, role] = params;
    const user = {
      id,
      name, email: String(email).toLowerCase(), passwordHash, bio, avatarUrl, location,
      skills: typeof skills === 'string' ? JSON.parse(skills) : Array.isArray(skills) ? skills : [],
      role,
      savedProjects: [], createdAt: new Date().toISOString(),
    };
    memoryStore.users.push(user);
    return { insertId: user.id };
  }
  if (normalized.startsWith('INSERT INTO projects')) {
    const [id, userId, title, tagline, category, techStack, summary, overview, repoUrl, liveUrl, screenshotUrl, likes, views, status] = params;
    const project = {
      id,
      userId, title, tagline, category,
      techStack: typeof techStack === 'string' ? JSON.parse(techStack) : Array.isArray(techStack) ? techStack : [],
      summary, overview, repoUrl, liveUrl, screenshotUrl,
      likes: Number(likes || 0), views: Number(views || 0), status, createdAt: new Date().toISOString(), reviews: [],
    };
    memoryStore.projects.push(project);
    return { insertId: project.id };
  }
  if (normalized.startsWith('INSERT INTO project_reviews')) {
    const [, projectId, userId, rating, comment] = params;
    const review = { id: globalThis.crypto.randomUUID(), userId, rating, comment };
    const project = memoryStore.projects.find((entry) => entry.id === projectId);
    if (project) project.reviews.push(review);
    return { insertId: review.id };
  }
  return [];
}

export const isDatabaseAvailable = async () => {
  try {
    const connection = await pool.getConnection();
    connection.release();
    return true;
  } catch (error) {
    return false;
  }
};
