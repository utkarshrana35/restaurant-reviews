const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Makes a value safe to place inside HTML text or an attribute. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

// Email clients ignore stylesheets, so every element carries its style inline. Keeping the
// styles here means templates are written with the helpers below and contain no markup.
const STYLES = {
  page: 'margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;',
  card: 'max-width:480px;background:#ffffff;border-radius:8px;padding:32px;',
  brand: 'margin:0 0 24px;font-size:14px;font-weight:bold;color:#2563eb;',
  heading: 'margin:0 0 16px;font-size:20px;',
  paragraph: 'margin:0 0 16px;font-size:15px;line-height:22px;color:#18181b;',
  mutedParagraph: 'margin:0 0 16px;font-size:15px;line-height:22px;color:#71717a;',
  code: 'margin:0 0 16px;font-size:32px;font-weight:bold;letter-spacing:6px;',
} as const;

/** A paragraph of body text. `muted` is for secondary notes such as "you can ignore this". */
export function paragraph(text: string, { muted = false } = {}): string {
  const style = muted ? STYLES.mutedParagraph : STYLES.paragraph;
  return `<p style="${style}">${escapeHtml(text)}</p>`;
}

/** A short code shown large and spaced out, so it is easy to read and type. */
export function prominentCode(code: string): string {
  return `<p style="${STYLES.code}">${escapeHtml(code)}</p>`;
}

/**
 * Wraps content blocks (built with the helpers above) in the shared email frame. Layout uses a
 * table because email clients do not support modern CSS layout.
 */
export function emailLayout(heading: string, blocks: string[]): string {
  return `<!doctype html>
<html lang="en">
  <body style="${STYLES.page}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="${STYLES.card}">
            <tr>
              <td>
                <p style="${STYLES.brand}">Restaurant Reviews</p>
                <h1 style="${STYLES.heading}">${escapeHtml(heading)}</h1>
                ${blocks.join('\n                ')}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
