import nodemailer from 'nodemailer';

let cachedTransport = null;

function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  if (!host || !user || !password || !from) return null;
  if (!cachedTransport) {
    const port = Number(process.env.SMTP_PORT || 587);
    cachedTransport = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: { user, pass: password },
    });
  }
  return cachedTransport;
}

export async function sendEmail({ to, subject, text, html }) {
  const transport = getTransport();
  if (!transport) return false;
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text, html });
  return true;
}
