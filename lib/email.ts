// Transactional email via Resend (https://resend.com — free tier, 3,000/month).
// Set RESEND_API_KEY, and EMAIL_FROM to an address on a domain you've verified
// in Resend (e.g. "Veltriance <notifications@veltriance.com>"). Until a domain
// is verified Resend only delivers to your own account email.

export type EmailResult = { sent: true } | { sent: false; reason: string };

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(opts: { to: string; subject: string; text: string; replyTo?: string }): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "Email isn't configured on the server (RESEND_API_KEY)." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Veltriance <onboarding@resend.dev>",
        to: [opts.to], subject: opts.subject, text: opts.text,
        ...(opts.replyTo && { reply_to: opts.replyTo }),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { sent: false, reason: `Email provider error ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "Email failed" };
  }
}
