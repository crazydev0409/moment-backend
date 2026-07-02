import nodemailer from 'nodemailer';
import { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword, smtpFromEmail } from '../config/config';

const transporter =
  smtpHost && smtpUser && smtpPassword
    ? nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPassword },
      })
    : null;

export const sendEmail = async (options: { to: string; subject: string; text: string; html?: string }): Promise<void> => {
  if (!transporter) {
    throw new Error('Email sending is not configured');
  }

  await transporter.sendMail({
    from: smtpFromEmail,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
};

export const sendVerificationCodeEmail = async (to: string, code: string): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Your Catch verification code',
    text: `Your verification code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
  });
};
