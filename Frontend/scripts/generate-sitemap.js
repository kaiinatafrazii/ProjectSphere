import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outputDirectory = path.join(root, 'dist');

async function readConfiguredSiteUrl() {
  if (process.env.VITE_SITE_URL) return process.env.VITE_SITE_URL;

  for (const file of ['.env.production', '.env']) {
    try {
      const contents = await readFile(path.join(root, file), 'utf8');
      const entry = contents.match(/^\s*VITE_SITE_URL\s*=\s*(.+)\s*$/m);
      if (entry) return entry[1].trim().replace(/^['"]|['"]$/g, '');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return '';
}

const configuredUrl = await readConfiguredSiteUrl();
if (!configuredUrl) {
  console.warn('VITE_SITE_URL is not set; deployment sitemap generation was skipped.');
  process.exit(0);
}

let site;
try {
  site = new URL(configuredUrl);
} catch {
  throw new Error('VITE_SITE_URL must be an absolute URL.');
}
if (site.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(site.hostname)) {
  throw new Error('VITE_SITE_URL must use HTTPS unless it is a localhost development URL.');
}

const origin = site.origin;
const routes = ['', 'discover', 'privacy', 'terms'];
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  routes.map((route) => `  <url><loc>${origin}/${route}</loc></url>`).join('\n') +
  '\n</urlset>\n';

await writeFile(path.join(outputDirectory, 'sitemap.xml'), xml, 'utf8');

const robotsPath = path.join(outputDirectory, 'robots.txt');
let robots = await readFile(robotsPath, 'utf8');
robots = robots.replace(/^Sitemap:.*(?:\r?\n)?/gm, '');
robots += `Sitemap: ${origin}/sitemap.xml\n`;
await writeFile(robotsPath, robots, 'utf8');

const htmlPath = path.join(outputDirectory, 'index.html');
let html = await readFile(htmlPath, 'utf8');
html = html.replace(/content="\/images\/social-preview\.svg"/g, `content="${origin}/images/social-preview.svg"`);
if (!html.includes('rel="canonical"')) {
  html = html.replace('</head>', `  <link rel="canonical" href="${origin}/" />\n  </head>`);
}
await writeFile(htmlPath, html, 'utf8');
