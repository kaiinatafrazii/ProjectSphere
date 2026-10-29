import { findUserById } from '../repositories/userRepository.js';
import { sendError, sendSuccess } from '../utils/response.js';

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
        skills: user.skills || [],
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
