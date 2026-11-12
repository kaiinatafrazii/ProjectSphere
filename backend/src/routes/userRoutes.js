import express from 'express';
import { getUserProfile, updateOwnProfile } from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';
import { listSavedProjects } from '../controllers/bookmarkController.js';
import { listUserNotifications, markAllNotificationsRead, updateNotificationReadState } from '../controllers/notificationController.js';

const router = express.Router();

router.get('/me', requireAuth, (req, res) => getUserProfile({ params: { id: req.user.id }, user: req.user }, res));
router.put('/me', requireAuth, updateOwnProfile);
router.get('/me/bookmarks', requireAuth, listSavedProjects);
router.get('/me/notifications', requireAuth, listUserNotifications);
router.patch('/me/notifications/read-all', requireAuth, markAllNotificationsRead);
router.patch('/me/notifications/:id', requireAuth, updateNotificationReadState);
router.get('/:id', getUserProfile);

export default router;
