import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import yauzl from 'yauzl';
import { pool } from '../config/db.js';
import { sendError, sendSuccess } from '../utils/response.js';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const configuredStorage = process.env.SOURCE_CODE_STORAGE_DIR || path.join(backendDirectory, 'data', 'private-source-code');
const storageDirectory = path.isAbsolute(configuredStorage)
  ? configuredStorage
  : path.resolve(backendDirectory, configuredStorage);
const repositoryDirectory = path.resolve(backendDirectory, '..');
for (const publicDirectory of [
  path.join(backendDirectory, 'public'),
  path.join(repositoryDirectory, 'Frontend', 'public'),
]) {
  const relative = path.relative(publicDirectory, storageDirectory);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('SOURCE_CODE_STORAGE_DIR must be outside public web directories.');
  }
}
const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 5000;
const zipSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export const sourceCodeUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many source archive uploads. Please try again later.' },
});

export const sourceCodeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ARCHIVE_BYTES, files: 1, fields: 0 },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedMimeTypes = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'];
    if (extension !== '.zip' || !allowedMimeTypes.includes(file.mimetype)) {
      callback(new Error('Upload a ZIP archive (.zip) only.'));
      return;
    }
    callback(null, true);
  },
}).single('sourceCode');

export function sourceCodeUploadMiddleware(req, res, next) {
  sourceCodeUpload(req, res, (error) => {
    if (!error) return next();
    const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return sendError(res, status, status === 413 ? 'ZIP archives must be 20 MB or smaller.' : error.message);
  });
}

function safeOriginalFilename(filename) {
  const basename = filename.replace(/[\\/]/g, '/').split('/').pop() || 'source-code.zip';
  const safeName = basename.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/^[. ]+|[. ]+$/g, '').slice(0, 155);
  const filenameBase = safeName || 'source-code';
  return filenameBase.toLowerCase().endsWith('.zip') ? filenameBase : `${filenameBase}.zip`;
}

function validateZipStructure(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, strictFileNames: true }, (error, zipFile) => {
      if (error) {
        reject(error);
        return;
      }
      if (zipFile.entryCount === 0 || zipFile.entryCount > MAX_ARCHIVE_ENTRIES) {
        zipFile.close();
        reject(new Error('ZIP archive must contain between 1 and 5000 entries.'));
        return;
      }
      zipFile.once('error', (zipError) => {
        zipFile.close();
        reject(zipError);
      });
      zipFile.once('end', () => {
        zipFile.close();
        resolve();
      });
      zipFile.on('entry', () => zipFile.readEntry());
      zipFile.readEntry();
    });
  });
}

export async function requireProjectSourceOwner(req, res, next) {
  try {
    const [rows] = await pool.execute(
      'SELECT user_id AS userId, status FROM projects WHERE id = ?',
      [req.params.id]
    );
    if (!rows[0] || rows[0].userId !== req.user.id) {
      return sendError(res, 404, 'Project not found.');
    }
    if (rows[0].status === 'removed') {
      return sendError(res, 409, 'Source code cannot be added to a removed project.');
    }
    return next();
  } catch (error) {
    console.error('Project source-code ownership check failed:', error);
    return sendError(res, 500, 'Unable to verify project ownership.');
  }
}

function storagePath(storageKey) {
  if (!/^[a-f0-9-]{36}\.zip$/i.test(storageKey)) {
    throw new Error('Stored source archive key is invalid.');
  }
  const resolved = path.resolve(storageDirectory, storageKey);
  if (path.dirname(resolved) !== storageDirectory) {
    throw new Error('Stored source archive key is invalid.');
  }
  return resolved;
}

async function removeStoredArchive(storageKey) {
  if (!storageKey) return;
  try {
    await unlink(storagePath(storageKey));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export async function uploadProjectSourceCode(req, res) {
  try {
    const [projects] = await pool.execute(
      'SELECT id, user_id, status FROM projects WHERE id = ?',
      [req.params.id]
    );
    const project = projects[0];
    if (!project || project.user_id !== req.user.id) {
      return sendError(res, 404, 'Project not found.');
    }
    if (project.status === 'removed') {
      return sendError(res, 409, 'Source code cannot be added to a removed project.');
    }
    if (!req.file) return sendError(res, 400, 'Choose a ZIP source-code archive to upload.');
    if (req.file.size < zipSignature.length || !req.file.buffer.subarray(0, 4).equals(zipSignature)) {
      return sendError(res, 400, 'The uploaded file is not a valid ZIP archive.');
    }
    try {
      await validateZipStructure(req.file.buffer);
    } catch {
      return sendError(res, 400, 'The uploaded file is not a valid ZIP archive.');
    }

    await mkdir(storageDirectory, { recursive: true });
    const storageKey = `${randomUUID()}.zip`;
    const destination = storagePath(storageKey);
    const originalFilename = safeOriginalFilename(req.file.originalname);
    const sha256 = createHash('sha256').update(req.file.buffer).digest('hex');
    let previousStorageKey = null;
    try {
      await writeFile(destination, req.file.buffer, { flag: 'wx', mode: 0o600 });
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [existing] = await connection.execute(
          'SELECT storage_key AS storageKey FROM project_source_code WHERE project_id = ?',
          [project.id]
        );
        previousStorageKey = existing[0]?.storageKey || null;
        await connection.execute(
          `INSERT INTO project_source_code
           (id, project_id, owner_id, storage_key, original_filename, size_bytes, sha256, submitted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(project_id) DO UPDATE SET
             owner_id = excluded.owner_id,
             storage_key = excluded.storage_key,
             original_filename = excluded.original_filename,
             size_bytes = excluded.size_bytes,
             sha256 = excluded.sha256,
             submitted_at = CURRENT_TIMESTAMP`,
          [randomUUID(), project.id, req.user.id, storageKey, originalFilename, req.file.size, sha256]
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      await removeStoredArchive(storageKey);
      throw error;
    }

    try {
      await removeStoredArchive(previousStorageKey);
    } catch (error) {
      console.error('Previous source archive cleanup failed:', error);
    }
    return sendSuccess(res, {
      sourceCode: {
        originalFilename,
        sizeBytes: req.file.size,
        sha256,
        submittedAt: new Date().toISOString(),
      },
      message: 'Private source-code archive uploaded for administrator review.',
    }, 201);
  } catch (error) {
    console.error('Private source-code upload failed:', error);
    return sendError(res, 500, 'Unable to save the private source-code archive.');
  }
}

export async function downloadProjectSourceCode(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT storage_key AS storageKey, original_filename AS originalFilename
       FROM project_source_code WHERE project_id = ?`,
      [req.params.id]
    );
    const archive = rows[0];
    if (!archive) return sendError(res, 404, 'Source code not submitted.');

    const filePath = storagePath(archive.storageKey);
    const content = await readFile(filePath).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (!content) return sendError(res, 404, 'The source-code archive is unavailable.');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', content.length);
    res.setHeader('Content-Disposition', `attachment; filename="${archive.originalFilename.replace(/["\\\r\n]/g, '_')}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(content);
  } catch (error) {
    console.error('Private source-code download failed:', error);
    return sendError(res, 500, 'Unable to download the private source-code archive.');
  }
}

export async function getOwnSourceCodeMetadata(req, res) {
  try {
    const [projects] = await pool.execute(
      'SELECT id, user_id FROM projects WHERE id = ?',
      [req.params.id]
    );
    if (!projects[0] || projects[0].user_id !== req.user.id) {
      return sendError(res, 404, 'Project not found.');
    }
    const [rows] = await pool.execute(
      `SELECT original_filename AS originalFilename, size_bytes AS sizeBytes,
        sha256, submitted_at AS submittedAt
       FROM project_source_code WHERE project_id = ? AND owner_id = ?`,
      [req.params.id, req.user.id]
    );
    return sendSuccess(res, { sourceCode: rows[0] || null });
  } catch (error) {
    console.error('Project source-code metadata retrieval failed:', error);
    return sendError(res, 500, 'Unable to load source-code submission status.');
  }
}
