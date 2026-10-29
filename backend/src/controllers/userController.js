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
        avatarUrl: user.avatar_url || user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=500&q=80',
        createdAt: user.created_at || user.createdAt,
      },
    });
  } catch (error) {
    console.error('Profile retrieval failed:', error);
    return sendError(res, 500, 'Unable to load profile right now.');
  }
}

export async function updateOwnProfile(req, res) {
  const { name, bio, location, skills } = req.body || {};
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedBio = typeof bio === 'string' ? bio.trim() : '';
  const normalizedLocation = typeof location === 'string' ? location.trim() : '';
  if (!normalizedName || normalizedName.length > 100) {
    return sendError(res, 400, 'Name is required and must be 100 characters or fewer.');
  }
  if (normalizedBio.length > 1000 || normalizedLocation.length > 100) {
    return sendError(res, 400, 'Bio or location exceeds the allowed length.');
  }
  if (!Array.isArray(skills) || skills.length > 20 || skills.some((skill) => typeof skill !== 'string' || skill.trim().length > 40)) {
    return sendError(res, 400, 'Skills must contain up to 20 short text values.');
  }

  try {
    await pool.execute(
      'UPDATE users SET name = ?, bio = ?, location = ?, skills = ? WHERE id = ?',
      [normalizedName, normalizedBio, normalizedLocation, JSON.stringify(skills.map((skill) => skill.trim()).filter(Boolean)), req.user.id]
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
        avatarUrl: user.avatar_url || user.avatarUrl,
        createdAt: user.created_at || user.createdAt,
      },
    });
  } catch (error) {
    console.error('Profile update failed:', error);
    return sendError(res, 500, 'Unable to update your profile right now.');
  }
}
