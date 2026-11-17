export interface Mail {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Strips line breaks so user input can never inject extra headers or recipients. */
export const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

/** Resend over HTTPS, called from the Node runtime. */
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async send(mail: Mail): Promise<void> {
    const res = await this.fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: [oneLine(mail.to)],
        subject: oneLine(mail.subject).slice(0, 200),
        text: mail.text,
        ...(mail.replyTo ? { reply_to: oneLine(mail.replyTo) } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
  }
}

/** Keeps mail in memory: tests, CI and local development. */
export class MemoryMailer implements Mailer {
  readonly sent: Mail[] = [];
  async send(mail: Mail): Promise<void> {
    this.sent.push(mail);
  }
}
