import nodemailer from "nodemailer";

// SMTP is configured via env vars (Gmail: smtp.gmail.com, port 465, an App Password).
// If they're absent, sendMail reports back so callers can fall back gracefully.
export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter: nodemailer.Transporter | null = null;
function getTransport() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: (Number(process.env.SMTP_PORT) || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; html: string }) {
  if (!mailConfigured()) return { sent: false as const };
  const from = process.env.MAIL_FROM || `Excel Tech POS <${process.env.SMTP_USER}>`;
  await getTransport().sendMail({ from, ...opts });
  return { sent: true as const };
}

export function resetEmailHtml(name: string, link: string) {
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;color:#1b2430">
    <div style="background:#026a40;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0">
      <h2 style="margin:0;font-size:18px">Excel Tech POS</h2>
    </div>
    <div style="border:1px solid #e3e8ee;border-top:none;padding:24px;border-radius:0 0 10px 10px">
      <p>Hi ${name || "there"},</p>
      <p>We received a request to reset your Excel Tech POS password. Click the button below to choose a new one. This link expires in <b>1 hour</b>.</p>
      <p style="text-align:center;margin:26px 0">
        <a href="${link}" style="background:#026a40;color:#fff;text-decoration:none;padding:12px 26px;border-radius:8px;font-weight:600;display:inline-block">Reset Password</a>
      </p>
      <p style="font-size:12px;color:#67737f">If the button doesn't work, paste this link into your browser:<br>
        <a href="${link}" style="color:#024d2f;word-break:break-all">${link}</a></p>
      <p style="font-size:12px;color:#67737f">If you didn't request this, you can safely ignore this email — your password stays the same.</p>
    </div>
  </div>`;
}
