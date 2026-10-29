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
    await pool.execute(
      `UPDATE users SET name = ?, bio = ?, location = ?, skills = ?,
       avatar_url = CASE WHEN ? THEN ? ELSE avatar_url END WHERE id = ?`,
      [
        normalizedName,
        normalizedBio,
        normalizedLocation,
        JSON.stringify(skills.map((skill) => skill.trim()).filter(Boolean)),
        avatarProvided ? 1 : 0,
        normalizedAvatarUrl || null,
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
        avatarUrl: user.avatar_url || user.avatarUrl || null,
        createdAt: user.created_at || user.createdAt,
      },
    });
  } catch (error) {
    console.error('Profile update failed:', error);
    return sendError(res, 500, 'Unable to update your profile right now.');
  }
}
