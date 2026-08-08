import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

let transporter: Transporter | null | undefined;

/** Lazily built and cached. Returns null (and logs once) when SMTP isn't configured. */
function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    logger.warn("SMTP not configured — notification emails will be skipped");
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  return transporter;
}

export interface EmailRecipient {
  email: string;
  full_name?: string | null;
}

export interface SmtpOverride {
  host: string;
  port?: number;
  user: string;
  password: string;
  from?: string;
  secure?: boolean;
}

function buildTransporter(override: SmtpOverride): Transporter {
  return nodemailer.createTransport({
    host: override.host,
    port: override.port ?? 587,
    secure: override.secure ?? false,
    auth: { user: override.user, pass: override.password },
  });
}

const TYPE_LABEL: Record<string, string> = {
  attendance: "Attendance",
  homework: "Homework",
  marks: "Marks",
  van: "Van Update",
  announcement: "Announcement",
  emergency: "Emergency Alert",
};

/**
 * Sends one notification to many recipients as a single BCC'd email
 * (a school-wide announcement to 500 users should be one SMTP call, not
 * 500). Never throws — logs and returns on any failure so a mail outage
 * never blocks the API request that triggered it.
 */
export async function sendNotificationEmail(
  notification: { type: string; title: string; message: string; priority: string },
  recipients: EmailRecipient[],
  override?: SmtpOverride
): Promise<void> {
  const client = override ? buildTransporter(override) : getTransporter();
  if (!client) return;

  const emails = Array.from(new Set(recipients.map((r) => r.email).filter(Boolean)));
  if (emails.length === 0) return;

  const label = TYPE_LABEL[notification.type] ?? "Notification";
  const isUrgent = notification.priority === "critical";
  const from = override?.from ?? env.SMTP_FROM;

  try {
    await client.sendMail({
      from,
      to: from,
      bcc: emails,
      subject: `${isUrgent ? "[URGENT] " : ""}${label}: ${notification.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px;">
          <p style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;
            background:${isUrgent ? "#fee2e2" : "#eff6ff"};color:${isUrgent ? "#991b1b" : "#1d4ed8"};">
            ${label}
          </p>
          <h2 style="margin:12px 0 4px;">${escapeHtml(notification.title)}</h2>
          <p style="color:#334155;white-space:pre-wrap;">${escapeHtml(notification.message)}</p>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
            Sent by your school's management system. Log in to view details.
          </p>
        </div>
      `,
    });
  } catch (err) {
    logger.error({ err, notificationType: notification.type }, "Failed to send notification email");
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
