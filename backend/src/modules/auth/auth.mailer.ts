import { createTransport, type Transporter } from 'nodemailer';
import { env } from '../../config/env';

/**
 * Transactional mail for the registration OTP.
 *
 * SMTP is the only sender: Firebase Authentication sends sign-in links, not the
 * six-digit code this flow shows in the modal. Any SMTP account works — Gmail
 * with an App Password, Brevo/Resend's SMTP bridge, MailHog locally, etc.
 *
 * When SMTP is not configured the function falls back to the development log
 * (and the service echoes the code back only while `OTP_DEBUG` is on).
 */

let transport: Transporter | null = null;

export function isSmtpConfigured(): boolean {
  // A host alone is not enough: Gmail (and every transactional provider) needs
  // credentials too. Until all three are present the OTP falls back to the dev
  // log/code instead of returning a 502 on every registration attempt.
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

function getTransport(): Transporter {
  if (!transport) {
    transport = createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      ...(env.smtpUser
        ? { auth: { user: env.smtpUser, pass: env.smtpPass } }
        : {}),
    });
  }
  return transport;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function sendRegistrationOtp(input: {
  email: string;
  name: string;
  code: string;
  expiresMinutes: number;
}): Promise<boolean> {
  if (!isSmtpConfigured()) {
    if (env.otpDebug) {
      // Deliberately loud: developers need the code when no mailbox is wired.
      console.warn(`[auth] SMTP is not configured. OTP for ${input.email}: ${input.code}`);
    }
    return false;
  }

  const safeName = escapeHtml(input.name);
  const subject = 'Mã xác thực đăng ký Engorace';
  const text = [
    `Xin chào ${input.name},`,
    '',
    `Mã xác thực đăng ký Engorace của bạn là: ${input.code}`,
    '',
    `Mã có hiệu lực ${input.expiresMinutes} phút và chỉ dùng được một lần.`,
    'Nếu bạn không yêu cầu tạo tài khoản, hãy bỏ qua email này.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="vi">
  <body style="margin:0;padding:24px;background:#eaf9ff;font-family:'Segoe UI',Arial,sans-serif;color:#0e3542;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#f1fbff;border:1px solid #cde8f4;border-radius:16px;overflow:hidden;">
      <tr>
        <!-- Cyan app blue; the wordmark sits on a white chip so its three brand
             colours stay readable (the light-theme logo palette). -->
        <td style="padding:22px 28px;background:#19b6f0;">
          <span style="display:inline-block;padding:6px 10px;border-radius:8px;background:#ffffff;">
            <strong style="font-size:20px;letter-spacing:-0.02em;">
              <span style="color:#009ecb;">Eng</span><span style="color:#5caf6b;">o</span><span style="color:#d9820b;">race</span>
            </strong>
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <p style="margin:0 0 12px;font-size:15px;">Xin chào <strong>${safeName}</strong>,</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">Dùng mã dưới đây để hoàn tất đăng ký tài khoản Engorace:</p>
          <p style="margin:0 0 18px;padding:16px 20px;border:2px solid #00c7ff;border-left:6px solid #f59e0b;border-radius:12px;background:#ffffff;font-size:32px;font-weight:800;letter-spacing:0.28em;text-align:center;font-variant-numeric:tabular-nums;color:#006e8f;">${input.code}</p>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#4c7383;">Mã có hiệu lực <strong>${input.expiresMinutes} phút</strong> và chỉ dùng được một lần.</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#4c7383;">Nếu bạn không yêu cầu tạo tài khoản, hãy bỏ qua email này.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await getTransport().sendMail({
    from: env.mailFrom,
    to: input.email,
    subject,
    text,
    html,
  });
  return true;
}
