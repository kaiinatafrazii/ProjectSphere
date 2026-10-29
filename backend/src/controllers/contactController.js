import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/db.js';
import { sendError, sendSuccess } from '../utils/response.js';

export async function submitContactMessage(req, res) {
  const { name, email, subject, message, website } = req.body;

  if (typeof website === 'string' && website.trim()) {
    return sendSuccess(res, { message: 'Your message has been received.' }, 201);
  }

  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedSubject = typeof subject === 'string' ? subject.trim() : '';
  const normalizedMessage = typeof message === 'string' ? message.trim() : '';

  if (!normalizedName || !normalizedEmail || !normalizedSubject || !normalizedMessage) {
    return sendError(res, 400, 'Complete all required contact fields.');
  }
  if (normalizedName.length > 100 || normalizedEmail.length > 255 || normalizedSubject.length > 180 || normalizedMessage.length > 5000) {
    return sendError(res, 400, 'One or more contact fields exceed the allowed length.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return sendError(res, 400, 'Enter a valid email address.');
  }

  try {
    await pool.execute(
      'INSERT INTO contact_messages (id, name, email, subject, message) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), normalizedName, normalizedEmail, normalizedSubject, normalizedMessage]
    );
    return sendSuccess(res, { message: 'Your message has been received.' }, 201);
  } catch (error) {
    console.error('Contact form submission failed:', error);
    return sendError(res, 500, 'We could not send your message right now. Please try again later.');
  }
}
