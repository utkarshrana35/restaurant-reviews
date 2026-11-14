import { describe, expect, it } from 'vitest';
import {
  noAccountEmail,
  passwordResetEmail,
} from '../../../src/application/emails/passwordResetEmails';

describe('passwordResetEmail', () => {
  const email = passwordResetEmail('ada@example.com', '042817');

  it('puts the code in the subject, the text part and the HTML part', () => {
    expect(email.subject).toContain('042817');
    expect(email.text).toContain('042817');
    expect(email.html).toContain('042817');
  });

  it('says when the code expires and that other devices are signed out', () => {
    for (const part of [email.text, email.html]) {
      expect(part).toContain('It expires in 10 minutes.');
      expect(part).toContain('signs you out on every other device');
    }
  });
});

describe('noAccountEmail', () => {
  it('contains no code in either part', () => {
    const email = noAccountEmail('nobody@example.com');

    expect(email.text).not.toMatch(/\b\d{6}\b/);
    expect(email.html.replace(/#[0-9a-f]{6}/gi, '')).not.toMatch(/\b\d{6}\b/);
    expect(email.html).toContain('there is no account with it');
  });
});
