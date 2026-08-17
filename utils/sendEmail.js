import nodemailer from "nodemailer";

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

/**
 * Sends an email. In development, if SMTP isn't configured, it logs to the
 * console instead of throwing, so auth flows still work without SMTP set up.
 */
export const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`[email:dev] Would send to ${to} | Subject: ${subject}`);
    console.log(html);
    return { simulated: true };
  }

  const info = await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });

  return info;
};

export const passwordResetEmailTemplate = (resetUrl, fullName) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
    <h2>Password Reset Request</h2>
    <p>Hi ${fullName},</p>
    <p>We received a request to reset your password. Click the link below to choose a new one. This link expires in ${
      process.env.RESET_TOKEN_EXPIRES_MIN || 30
    } minutes.</p>
    <p><a href="${resetUrl}" style="background:#4F46E5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Reset Password</a></p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  </div>
`;
