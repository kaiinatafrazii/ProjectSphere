import { sendError } from '../utils/response.js';

export function errorHandler(error, req, res, next) {
  console.error(error);
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';
  return sendError(res, statusCode, message);
}
