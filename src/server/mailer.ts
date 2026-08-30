import nodemailer from "nodemailer";

import { EVENT, formatPrice } from "@/lib/event";
import type { Order } from "./store";

/**
 * Three transports, picked by whichever env vars exist:
 *   RESEND_API_KEY  → Resend HTTP API (no SMTP egress needed)
 *   SMTP_URL        → any SMTP server via nodemailer
 *   neither         → dev mode: log to the server console
 *
 * Dev mode also returns the code to the client so the flow is testable with no
 * credentials. That only ever happens outside production.
 */

export type SendResult = { delivered: boolean; transport: string };

const FROM = process.env.MAIL_FROM ?? `UTOPIA <onboarding@resend.dev>`;
const REPLY_TO = process.env.MAIL_REPLY_TO ?? EVENT.email;

export const isDevMailer = () =>
  !process.env.RESEND_API_KEY && !process.env.SMTP_URL;

async function send(to: string, subject: string, html: string, text: string): Promise<SendResult> {
  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html, text, reply_to: REPLY_TO }),
    });
    if (!response.ok) {
      throw new Error(`Resend rejected the email (${response.status})`);
    }
    return { delivered: true, transport: "resend" };
  }

  if (process.env.SMTP_URL) {
    const transporter = nodemailer.createTransport(process.env.SMTP_URL);
    await transporter.sendMail({ from: FROM, to, subject, html, text, replyTo: REPLY_TO });
    return { delivered: true, transport: "smtp" };
  }

  console.info(
    `\n──────── UTOPIA dev mail ────────\nTo: ${to}\nSubject: ${subject}\n\n${text}\n─────────────────────────────────\n`,
  );
  return { delivered: false, transport: "console" };
}

/* ----------------------------- templates ----------------------------- */

const shell = (heading: string, body: string) => `
<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#030307;font-family:Helvetica,Arial,sans-serif;color:#f4f4f8">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#0a0b14;border:1px solid #23264a;border-radius:18px">
    <tr><td style="padding:32px">
      <p style="margin:0 0 22px;font-size:11px;letter-spacing:.34em;color:#9aa4ff;text-transform:uppercase">${EVENT.host}</p>
      <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;line-height:1.15;color:#ffffff">${heading}</h1>
      ${body}
      <hr style="border:none;border-top:1px solid #23264a;margin:28px 0" />
      <p style="margin:0;font-size:12px;line-height:1.7;color:#8c8fa8">
        ${EVENT.dateLabel} · ${EVENT.timeLabel}<br />
        ${EVENT.venueName}, ${EVENT.venueCity}<br />
        <a href="${EVENT.mapsUrl}" style="color:#9aa4ff">Open in Google Maps</a>
      </p>
      <p style="margin:18px 0 0;font-size:11px;color:#63667e">
        ${EVENT.policyShort} Bags get checked at the door.
      </p>
    </td></tr>
  </table>
</body></html>`;

export async function sendVerificationCode(
  to: string,
  name: string,
  code: string,
): Promise<SendResult> {
  const firstName = name.split(" ")[0] || "there";
  const html = shell(
    "Here's your code",
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#c9cadb">
       ${firstName}, punch this into the checkout to prove the inbox is yours.
     </p>
     <p style="margin:0 0 20px;padding:18px;background:#11132a;border:1px solid #3a3f7a;border-radius:12px;text-align:center;
               font-family:'Courier New',monospace;font-size:34px;letter-spacing:.34em;color:#ffffff">${code}</p>
     <p style="margin:0;font-size:13px;line-height:1.7;color:#8c8fa8">
       Good for 10 minutes. If you didn't ask for this, someone typed your address by mistake — ignore it and nothing happens.
     </p>`,
  );
  const text = `${firstName}, your UTOPIA verification code is ${code}. It expires in 10 minutes.`;
  return send(to, `${code} is your UTOPIA code`, html, text);
}

export async function sendOrderConfirmation(order: Order, passName: string): Promise<SendResult> {
  const firstName = order.buyer.name.split(" ")[0] || "there";
  const row = (label: string, value: string) =>
    `<tr>
       <td style="padding:9px 0;font-size:11px;letter-spacing:.2em;color:#8c8fa8;text-transform:uppercase">${label}</td>
       <td style="padding:9px 0;font-size:14px;color:#f4f4f8;text-align:right">${value}</td>
     </tr>`;

  const html = shell(
    "You're on the list",
    `<p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#c9cadb">
       ${firstName}, we're holding ${order.quantity} × ${passName} for you. Keep this reference — it's what gets you through the door.
     </p>
     <p style="margin:0 0 22px;padding:16px;background:#11132a;border:1px solid #3a3f7a;border-radius:12px;text-align:center;
               font-family:'Courier New',monospace;font-size:24px;letter-spacing:.2em;color:#ffffff">${order.reference}</p>
     <table role="presentation" width="100%" style="border-collapse:collapse">
       ${row("Pass", passName)}
       ${row("Quantity", String(order.quantity))}
       ${row("Total", formatPrice(order.total))}
       ${row("Status", "Reserved — payment pending")}
     </table>
     <p style="margin:22px 0 0;font-size:13px;line-height:1.7;color:#8c8fa8">
       We'll send the payment link shortly. The hold lasts ${EVENT.holdMinutes} minutes once payment opens.
     </p>`,
  );
  const text = `${firstName}, ${order.quantity} x ${passName} reserved. Reference ${order.reference}. Total ${formatPrice(order.total)}.`;
  return send(order.buyer.email, `Reserved: ${order.reference} — UTOPIA passes`, html, text);
}
