USE projectsphere;

INSERT INTO users (id, name, email, password_hash, bio, location, skills, role)
VALUES
  ('0f4a1f11-7f6f-44b6-9212-8f41f9d9ce80', 'Aisha Rahman', 'aisha@example.com', '$2a$10$zr7.bJ7v9dUyQ6VSX0c1XeOdfnvVL9W5mQSn6N333lUdhIxKobNh.', 'Product-minded software engineer building climate tech tools.', 'Dhaka, Bangladesh', JSON_ARRAY('React','Node.js','MySQL'), 'developer'),
  ('19d7f4d5-9bcc-4d55-84d9-6ce2b1170dd7', 'Nicolas Lee', 'nicolas@example.com', '$2a$10$zr7.bJ7v9dUyQ6VSX0c1XeOdfnvVL9W5mQSn6N333lUdhIxKobNh.', 'ML engineer exploring human-centered healthcare interfaces.', 'Singapore', JSON_ARRAY('Python','TensorFlow','Research'), 'researcher');

INSERT INTO projects (id, user_id, title, tagline, category, tech_stack, summary, overview, repo_url, live_url, screenshot_url, likes, views, status)
VALUES
  ('0a3bc1d6-05d0-4ff5-a1b0-c2bc730ec1d4', '0f4a1f11-7f6f-44b6-9212-8f41f9d9ce80', 'ProjectSphere', 'A premium project discovery hub for student and developer communities.', 'Productivity', JSON_ARRAY('React','Node.js','MySQL','Vite'), 'A community-powered platform for discovering, publishing, and reviewing technical projects.', 'ProjectSphere brings together project publishing, thoughtful reviews, and profile-driven discovery. It is designed for students, founders, and AI researchers looking to share technical work and get actionable feedback.',NULL,NULL,'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80', 228, 3450, 'featured'),
  ('2df9fdc9-8aa2-4fe8-a29d-17d3670d9ef1', '19d7f4d5-9bcc-4d55-84d9-6ce2b1170dd7', 'SignalCare AI', 'Diagnose patient risk patterns with explainable machine learning.', 'AI/ML', JSON_ARRAY('Python','PyTorch','FastAPI'), 'An explainable AI system for clinical risk scoring and patient recommendation workflows.', 'SignalCare AI supports healthcare teams by surfacing evidence from multimodal records and ranking potential intervention pathways. The platform emphasizes interpretability and needs-driven design.',NULL,NULL,'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80', 142, 2100, 'published');

INSERT INTO project_reviews (id, project_id, user_id, rating, comment)
VALUES
  ('76f4a50d-19d8-4f5a-b9a5-a282db2a67bd', '0a3bc1d6-05d0-4ff5-a1b0-c2bc730ec1d4', '19d7f4d5-9bcc-4d55-84d9-6ce2b1170dd7', 5, 'The public-facing UX is great and the discovery flow is easy to trust.');
