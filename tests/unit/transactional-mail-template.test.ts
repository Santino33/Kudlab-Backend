import { describe, expect, it } from 'vitest';
import { renderTransactionalMail } from '../../src/modules/usuarios/shared/transactional-mail.template.js';

describe('transactional email presentation', () => {
  it.each([
    ['invitation', 'Activa tu cuenta de Kudlab', 'Activar mi cuenta'],
    ['email-change', 'Confirma tu cambio de correo en Kudlab', 'Confirmar mi correo'],
    ['password-recovery', 'Recupera tu acceso a Kudlab', 'Recuperar mi acceso'],
  ] as const)('renders an accessible %s email with a plain-text alternative', (purpose, subject, button) => {
    const url = 'https://kudlab.example/action?token=fictitious';
    const result = renderTransactionalMail(purpose, url);
    expect(result.subject).toBe(subject);
    expect(result.text).toContain(url);
    expect(result.text).toContain('ignora este mensaje');
    expect(result.html).toContain('lang="es"');
    expect(result.html).toContain('name="viewport"');
    expect(result.html).toContain('role="presentation"');
    expect(result.html).toContain('max-width:600px');
    expect(result.html).toContain(`<a href="${url}"`);
    expect(result.html).toContain(button);
    expect(result.html).toContain('Si el botón no funciona');
    expect(result.html).toContain('ignora este mensaje');
    expect(result.html).not.toMatch(/<script|<form|<iframe|<img|@import|url\(/i);
    expect([...result.html.matchAll(/href="([^"]+)"/g)].map((match) => match[1])).toEqual([url, url]);
  });
  it('escapes URL attributes and visible text without altering the plain-text link', () => {
    const url = 'https://kudlab.example/action?token="\'><img src=x onerror=alert(1)>&other=value';
    const { html, text } = renderTransactionalMail('invitation', url);
    const escaped = 'https://kudlab.example/action?token=&quot;&#39;&gt;&lt;img src=x onerror=alert(1)&gt;&amp;other=value';
    expect(html).toContain(`href="${escaped}"`);
    expect(html).toContain(`>${escaped}</a>`);
    expect(html).not.toContain('<img');
    expect(html).not.toContain(url);
    expect(text).toContain(url);
  });
});
