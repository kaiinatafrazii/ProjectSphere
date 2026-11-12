import { findUserById } from '../repositories/userRepository.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { pool } from '../config/db.js';

export async function getUserProfile(req, res) {
  try {
    const user = await findUserById(req.params.id || req.user.id);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    return sendSuccess(res, {
      user: {
        id: user.id,
        name: user.name,
        bio: user.bio || '',
        location: user.location || '',
        skills: typeof user.skills === 'string' ? JSON.parse(user.skills) : user.skills || [],
        role: user.role || 'student',
        username: user.username || null,
        githubUrl: user.github_url || null,
        linkedinUrl: user.linkedin_url || null,
        websiteUrl: user.website_url || null,
        avatarUrl: user.avatar_url || user.avatarUrl || null,
        createdAt: user.created_at || user.createdAt,
      },
    });
  } catch (error) {
    console.error('Profile retrieval failed:', error);
    return sendError(res, 500, 'Unable to load profile right now.');
  }
}

export async function updateOwnProfile(req, res) {
  const { name, bio, location, skills, avatarUrl } = req.body || {};
  const avatarProvided = Object.hasOwn(req.body || {}, 'avatarUrl');
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedBio = typeof bio === 'string' ? bio.trim() : '';
  const normalizedLocation = typeof location === 'string' ? location.trim() : '';
  const normalizedAvatarUrl = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
  const optionalProfileFields = [
    ['username', 'username'],
    ['githubUrl', 'github_url'],
    ['linkedinUrl', 'linkedin_url'],
    ['websiteUrl', 'website_url'],
  ];
  const normalizedProfileFields = {};
  for (const [field, column] of optionalProfileFields) {
    if (!Object.hasOwn(req.body || {}, field)) continue;
    const value = req.body[field];
    if (typeof value !== 'string') return sendError(res, 400, `${field} must be text.`);
    const normalized = value.trim();
    if (field === 'username' && normalized && !/^[a-zA-Z0-9._-]{3,30}$/.test(normalized)) {
      return sendError(res, 400, 'Username must be 3-30 characters using letters, numbers, dots, underscores, or hyphens.');
    }
    if (field !== 'username' && normalized) {
      if (normalized.length > 500) return sendError(res, 400, 'Profile links must be 500 characters or fewer.');
      try {
        const parsed = new URL(normalized);
        if (process.env.NODE_ENV === 'production' ? parsed.protocol !== 'https:' : !['http:', 'https:'].includes(parsed.protocol)) {
          return sendError(res, 400, 'Profile links must use HTTPS.');
        }
      } catch {
        return sendError(res, 400, 'Enter a valid profile URL.');
      }
    }
    normalizedProfileFields[column] = field === 'username' ? normalized.toLowerCase() || null : normalized || null;
  }
  if (avatarProvided && typeof avatarUrl !== 'string') {
    return sendError(res, 400, 'Profile photo must be a URL or resized JPEG image.');
  }
  if (!normalizedName || normalizedName.length > 100) {
    return sendError(res, 400, 'Name is required and must be 100 characters or fewer.');
  }
  if (normalizedBio.length > 1000 || normalizedLocation.length > 100) {
    return sendError(res, 400, 'Bio or location exceeds the allowed length.');
  }
  if (!Array.isArray(skills) || skills.length > 20 || skills.some((skill) => typeof skill !== 'string' || skill.trim().length > 40)) {
    return sendError(res, 400, 'Skills must contain up to 20 short text values.');
  }
  const isHttpImage = normalizedAvatarUrl.length <= 2048 && (() => {
    if (!normalizedAvatarUrl) return true;
    try {
      const parsed = new URL(normalizedAvatarUrl);
      return process.env.NODE_ENV === 'production'
        ? parsed.protocol === 'https:'
        : ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  })();
  const uploadedImageMatch = normalizedAvatarUrl.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
  const uploadedImage = uploadedImageMatch ? Buffer.from(uploadedImageMatch[1], 'base64') : null;
  const isUploadedImage = Boolean(
    uploadedImage &&
    normalizedAvatarUrl.length <= 700000 &&
    uploadedImage.length <= 512000 &&
    uploadedImage.length >= 4 &&
    uploadedImage[0] === 0xff &&
    uploadedImage[1] === 0xd8 &&
    uploadedImage[2] === 0xff
  );
  if (avatarProvided && normalizedAvatarUrl && !isHttpImage && !isUploadedImage) {
    return sendError(res, 400, 'Profile photo must be a valid HTTP(S) image URL or a resized JPEG image.');
  }

  try {
    if (Object.hasOwn(normalizedProfileFields, 'username') && normalizedProfileFields.username) {
      const [existingNames] = await pool.execute(
        'SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id <> ?',
        [normalizedProfileFields.username, req.user.id]
      );
      if (existingNames.length) return sendError(res, 409, 'That username is already in use.');
    }
    await pool.execute(
      `UPDATE users SET name = ?, bio = ?, location = ?, skills = ?,
       avatar_url = CASE WHEN ? THEN ? ELSE avatar_url END,
       username = CASE WHEN ? THEN ? ELSE username END,
       github_url = CASE WHEN ? THEN ? ELSE github_url END,
       linkedin_url = CASE WHEN ? THEN ? ELSE linkedin_url END,
       website_url = CASE WHEN ? THEN ? ELSE website_url END WHERE id = ?`,
      [
        normalizedName,
        normalizedBio,
        normalizedLocation,
        JSON.stringify(skills.map((skill) => skill.trim()).filter(Boolean)),
        avatarProvided ? 1 : 0,
        normalizedAvatarUrl || null,
        Object.hasOwn(normalizedProfileFields, 'username') ? 1 : 0,
        normalizedProfileFields.username,
        Object.hasOwn(normalizedProfileFields, 'github_url') ? 1 : 0,
        normalizedProfileFields.github_url,
        Object.hasOwn(normalizedProfileFields, 'linkedin_url') ? 1 : 0,
        normalizedProfileFields.linkedin_url,
        Object.hasOwn(normalizedProfileFields, 'website_url') ? 1 : 0,
        normalizedProfileFields.website_url,
        req.user.id,
      ]
    );
    const user = await findUserById(req.user.id);
    if (!user) return sendError(res, 404, 'User not found.');
    return sendSuccess(res, {
      user: {
        id: user.id,
        name: user.name,
        bio: user.bio || '',
        location: user.location || '',
        skills: typeof user.skills === 'string' ? JSON.parse(user.skills) : user.skills || [],
        role: user.role || 'student',
        username: user.username || null,
        githubUrl: user.github_url || null,
        linkedinUrl: user.linkedin_url || null,
        websiteUrl: user.website_url || null,
        avatarUrl: user.avatar_url || user.avatarUrl || null,
        createdAt: user.created_at || user.createdAt,
      },
    });
  } catch (error) {
    console.error('Profile update failed:', error);
    return sendError(res, 500, 'Unable to update your profile right now.');
  }
}
