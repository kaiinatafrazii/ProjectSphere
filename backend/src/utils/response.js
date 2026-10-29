export function sendSuccess(res, payload = {}, statusCode = 200) {
  return res.status(statusCode).json({ success: true, ...payload });
}

export function sendError(res, statusCode = 500, message = 'Something went wrong') {
  return res.status(statusCode).json({ success: false, message });
}
