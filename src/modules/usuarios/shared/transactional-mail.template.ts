import type { MailPurpose } from './transactional-mail.js';

const content = {
  invitation: {
    subject: 'Activa tu cuenta de Kudlab', label: 'Bienvenido a Kudlab', title: 'Todo empieza con tu cuenta.',
    action: 'Para activar tu cuenta, abre este enlace y establece tu contraseña.', button: 'Activar mi cuenta',
  },
  'email-change': {
    subject: 'Confirma tu cambio de correo en Kudlab', label: 'Verificación de correo', title: 'Confirma tu nueva dirección.',
    action: 'Para confirmar tu nuevo correo, abre este enlace.', button: 'Confirmar mi correo',
  },
  'password-recovery': {
    subject: 'Recupera tu acceso a Kudlab', label: 'Recuperación de acceso', title: 'Vuelve a tu cuenta con seguridad.',
    action: 'Para recuperar tu acceso, abre este enlace y establece una nueva contraseña.', button: 'Recuperar mi acceso',
  },
} as const;

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function renderTransactionalMail(purpose: MailPurpose, url: string) {
  const message = content[purpose];
  const link = escapeHtml(url);
  return {
    subject: message.subject,
    text: `Kudlab\n\n${message.action}\n${url}\n\nSi no reconoces esta solicitud, ignora este mensaje.`,
    html: `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${message.subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f6fa;color:#172b3a;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${message.action}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f6fa;">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
        <tr><td style="padding:0 12px 24px;">
          <span style="font-size:28px;font-weight:700;letter-spacing:-1px;color:#134e4a;">Kudlab<span style="color:#0f766e;">.</span></span>
          <p style="margin:6px 0 0;font-size:13px;color:#526779;">Acompañamos el aprendizaje.</p>
        </td></tr>
        <tr><td style="padding:36px 28px;background-color:#ffffff;border:1px solid #dce5ed;border-top:4px solid #0f766e;border-radius:12px;">
          <p style="margin:0 0 16px;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#0f766e;">${message.label}</p>
          <h1 style="margin:0 0 20px;font-size:28px;line-height:36px;font-weight:700;letter-spacing:-0.5px;color:#172b3a;">${message.title}</h1>
          <p style="margin:0 0 28px;font-size:16px;line-height:26px;color:#43586a;">${message.action}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            <tr><td align="center" bgcolor="#0f766e" style="border-radius:8px;mso-padding-alt:16px 24px;">
              <a href="${link}" style="display:inline-block;padding:16px 24px;border:1px solid #0f766e;border-radius:8px;font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">${message.button}</a>
            </td></tr>
          </table>
          <p style="margin:0;padding:16px;background-color:#f0f7f6;border-left:3px solid #0f766e;border-radius:4px;font-size:14px;line-height:22px;color:#34544f;">Si no reconoces esta solicitud, ignora este mensaje. No compartas este enlace ni tu contraseña.</p>
          <div style="margin-top:28px;padding-top:24px;border-top:1px solid #e5ebf0;">
            <p style="margin:0 0 8px;font-size:12px;line-height:20px;color:#526779;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
            <p style="margin:0;font-size:12px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;"><a href="${link}" style="color:#0f766e;text-decoration:underline;">${link}</a></p>
          </div>
        </td></tr>
        <tr><td align="center" style="padding:24px 16px;font-size:12px;line-height:20px;color:#526779;">Mensaje automático de Kudlab para gestionar tu acceso de forma segura.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}
