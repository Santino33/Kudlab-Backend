import { sendTransactionalMail, type MailPurpose } from '../shared/transactional-mail.js';
export { capturedMail } from '../shared/transactional-mail.js';

// Temporary adapter while services migrate to explicit MailOutcome handling.
export function makeMailer(purpose: MailPurpose, operationId: string) {
  return async (to: string, url: string): Promise<void> => {
    const result = await sendTransactionalMail({ purpose, operationId, to, url });
    if (result.outcome !== 'accepted') throw new Error('Envío no confirmado');
  };
}
