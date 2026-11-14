import { describe, expect, it } from 'vitest';
import { escapeHtml, paragraph, prominentCode } from '../../../src/application/emails/emailLayout';
import {
  alreadyRegisteredEmail,
  otpEmail,
} from '../../../src/application/emails/registrationEmails';

describe('otpEmail', () => {
  const email = otpEmail('ada@example.com', '042817');

  it('puts the code in the subject, the text part and the HTML part', () => {
    expect(email.subject).toContain('042817');
    expect(email.text).toContain('042817');
    expect(email.html).toContain('042817');
  });

  it('sends a complete HTML document alongside the plain text', () => {
    expect(email.html).toMatch(/^<!doctype html>/);
    expect(email.html).toContain('It expires in 10 minutes.');
    expect(email.text).toContain('It expires in 10 minutes.');
  });
});

describe('alreadyRegisteredEmail', () => {
  it('contains no code in either part', () => {
    const email = alreadyRegisteredEmail('ada@example.com');

    expect(email.text).not.toMatch(/\b\d{6}\b/);
    expect(email.html.replace(/#[0-9a-f]{6}/gi, '')).not.toMatch(/\b\d{6}\b/);
    expect(email.html).toContain('an account already exists');
  });
});

describe('escapeHtml', () => {
  it('neutralises markup characters', () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;',
    );
  });
});

describe('email content helpers', () => {
  it('escape the text they are given, so content can never inject markup', () => {
    expect(paragraph('<b>bold</b> & more')).toContain('&lt;b&gt;bold&lt;/b&gt; &amp; more');
    expect(prominentCode('<1>')).toContain('&lt;1&gt;');
  });

  it('style muted paragraphs differently from normal ones', () => {
    expect(paragraph('note', { muted: true })).not.toBe(paragraph('note'));
  });
});
