import nodemailer from "nodemailer";

import { EVENT, formatPrice } from "@/lib/event";
import { passQrPayload, qrPngBuffer, qrDataUrl } from "./pass-code";
import type { Order } from "./store";

/**
 * Transports, first match wins:
 *   GMAIL_USER + GMAIL_APP_PASSWORD → Gmail SMTP (the live default)
 *   SMTP_URL                        → any SMTP server via nodemailer
 *   RESEND_API_KEY                  → Resend HTTP API
 *   none of the above               → console (dev only; codes also return to the client)
 */

export type SendResult = { delivered: boolean; transport: string };

type Attachment = { filename: string; content: Buffer; contentType?: string };

function gmailUser() {
  return process.env.GMAIL_USER?.trim() ?? "";
}

function gmailAppPassword() {
  return (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");
}

function hasGmail() {
  return Boolean(gmailUser() && gmailAppPassword());
}

function mailFrom() {
  if (process.env.MAIL_FROM?.trim()) return process.env.MAIL_FROM.trim();
  const user = gmailUser();
  if (user) return `UTOPIA <${user}>`;
  return `UTOPIA <onboarding@resend.dev>`;
}

function mailReplyTo() {
  if (process.env.MAIL_REPLY_TO?.trim()) return process.env.MAIL_REPLY_TO.trim();
  return gmailUser() || EVENT.email;
}

export const isDevMailer = () =>
  !hasGmail() && !process.env.SMTP_URL && !process.env.RESEND_API_KEY;

async function sendViaSmtp(
  transporter: nodemailer.Transporter,
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments: Attachment[],
  transport: string,
): Promise<SendResult> {
  try {
    await transporter.sendMail({
      from: mailFrom(),
      to,
      subject,
      html,
      text,
      replyTo: mailReplyTo(),
      attachments: attachments.map((file) => ({
        filename: file.filename,
        content: file.content,
        contentType: file.contentType,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP send failed";
    throw new Error(`Gmail/SMTP rejected the email: ${message}`);
  }
  return { delivered: true, transport };
}

async function send(
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments: Attachment[] = [],
): Promise<SendResult> {
  if (hasGmail()) {
    return sendViaSmtp(
      nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: gmailUser(), pass: gmailAppPassword() },
      }),
      to,
      subject,
      html,
      text,
      attachments,
      "gmail",
    );
  }

  if (process.env.SMTP_URL) {
    return sendViaSmtp(
      nodemailer.createTransport(process.env.SMTP_URL),
      to,
      subject,
      html,
      text,
      attachments,
      "smtp",
    );
  }

  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailFrom(),
        to,
        subject,
        html,
        text,
        reply_to: mailReplyTo(),
        attachments: attachments.map((file) => ({
          filename: file.filename,
          content: file.content.toString("base64"),
          content_type: file.contentType,
        })),
      }),
    });
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { message?: string };
        if (body.message) detail = body.message;
      } catch {
        // keep the status code if Resend didn't return JSON
      }
      throw new Error(`Resend rejected the email: ${detail}`);
    }
    return { delivered: true, transport: "resend" };
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

export async function sendLoginCode(to: string, code: string): Promise<SendResult> {
  const html = shell(
    "Log in to your passes",
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#c9cadb">
       Punch this into the site to see your UTOPIA reservations. Staff don't use this screen.
     </p>
     <p style="margin:0 0 20px;padding:18px;background:#11132a;border:1px solid #3a3f7a;border-radius:12px;text-align:center;
               font-family:'Courier New',monospace;font-size:34px;letter-spacing:.34em;color:#ffffff">${code}</p>
     <p style="margin:0;font-size:13px;line-height:1.7;color:#8c8fa8">
       Good for 10 minutes. If you didn't ask for this, ignore it.
     </p>`,
  );
  const text = `Your UTOPIA login code is ${code}. It expires in 10 minutes.`;
  return send(to, `${code} is your UTOPIA login code`, html, text);
}

export async function sendOrderConfirmation(order: Order, passName: string): Promise<SendResult> {
  const firstName = order.buyer.name.split(" ")[0] || "there";
  const row = (label: string, value: string) =>
    `<tr>
       <td style="padding:9px 0;font-size:11px;letter-spacing:.2em;color:#8c8fa8;text-transform:uppercase">${label}</td>
       <td style="padding:9px 0;font-size:14px;color:#f4f4f8;text-align:right">${value}</td>
     </tr>`;

  const html = shell(
    "Pay on UPI, then we lock it in",
    `<p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#c9cadb">
       ${firstName}, we're holding ${order.quantity} × ${passName}. Pay the total from the checkout QR
       (same amount, same UPI ID). Once we see the credit, your pass lands in this inbox.
     </p>
     <p style="margin:0 0 22px;padding:16px;background:#11132a;border:1px solid #3a3f7a;border-radius:12px;text-align:center;
               font-family:'Courier New',monospace;font-size:24px;letter-spacing:.2em;color:#ffffff">${order.reference}</p>
     <table role="presentation" width="100%" style="border-collapse:collapse">
       ${row("Pass", passName)}
       ${row("Quantity", String(order.quantity))}
       ${row("Total", formatPrice(order.total))}
       ${row("Status", "Waiting for UPI · we'll confirm")}
     </table>
     <p style="margin:22px 0 0;font-size:13px;line-height:1.7;color:#8c8fa8">
       Put ${order.reference} in the UPI note if the app asks. Don't screenshot a random QR from Instagram — only the one in checkout.
     </p>`,
  );
  const text = `${firstName}, ${order.quantity} x ${passName} reserved. Reference ${order.reference}. Total ${formatPrice(order.total)}. Pay via UPI from checkout — we email the pass after we confirm the credit.`;
  return send(order.buyer.email, `Pay UPI: ${order.reference} — UTOPIA`, html, text);
}

export async function sendPassApproved(order: Order, passName: string): Promise<SendResult> {
  const firstName = order.buyer.name.split(" ")[0] || "there";
  const passCode = order.passCode ?? "------";
  const payload = passQrPayload(order);
  let qrSrc = "";
  const attachments: Attachment[] = [];
  try {
    const png = await qrPngBuffer(payload);
    attachments.push({ filename: `utopia-pass-${order.reference}.png`, content: png, contentType: "image/png" });
    qrSrc = await qrDataUrl(payload);
  } catch (error) {
    console.error("[utopia] pass QR render failed", error);
  }

  const qrBlock = qrSrc
    ? `<p style="margin:22px 0 8px;text-align:center">
         <img src="${qrSrc}" alt="UTOPIA pass QR" width="220" height="220" style="width:220px;height:220px;border-radius:16px;background:#ffffff;padding:10px" />
       </p>`
    : "";

  const html = shell(
    "Your pass is ready",
    `<p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#c9cadb">
       ${firstName}, payment checked. ${order.quantity} × ${passName} is yours.
       Show the QR at the door — it carries your name and a code that only works for you.
     </p>
     <p style="margin:0 0 6px;font-size:11px;letter-spacing:.24em;color:#8c8fa8;text-transform:uppercase;text-align:center">Name on the pass</p>
     <p style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#ffffff;text-align:center">${order.buyer.name}</p>
     <p style="margin:0 0 8px;padding:16px;background:#11132a;border:1px solid #3a3f7a;border-radius:12px;text-align:center;
               font-family:'Courier New',monospace;font-size:34px;letter-spacing:.34em;color:#ffffff">${passCode}</p>
     <p style="margin:0 0 8px;font-size:12px;text-align:center;color:#8c8fa8">DOOR CODE · ${order.reference}</p>
     ${qrBlock}
     <p style="margin:12px 0 0;font-size:12px;line-height:1.7;color:#8c8fa8;text-align:center">
       Screenshot this. The QR is also attached as a PNG if the picture above doesn't load.
     </p>`,
  );
  const text = `${firstName}, you're confirmed. ${order.quantity} x ${passName}. Name: ${order.buyer.name}. Door code: ${passCode}. Reference ${order.reference}. Show the QR (attached) at Ouzo.`;
  return send(order.buyer.email, `Your UTOPIA pass — ${passCode}`, html, text, attachments);
}

export async function sendPassRejected(
  order: Order,
  passName: string,
  reason?: string,
): Promise<SendResult> {
  const firstName = order.buyer.name.split(" ")[0] || "there";
  const html = shell(
    "We couldn't confirm this one",
    `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#c9cadb">
       ${firstName}, your reservation for ${order.quantity} × ${passName} (${order.reference})
       didn't clear on our side${reason ? ` — ${reason}` : ""}.
     </p>
     <p style="margin:0;font-size:13px;line-height:1.7;color:#8c8fa8">
       If you think this is a mistake, reply to this email with your UPI proof (UTR / screenshot) and we'll take another look.
     </p>`,
  );
  const text = `${firstName}, we couldn't confirm ${order.reference}${reason ? ` (${reason})` : ""}. Reply with UPI proof if this looks wrong.`;
  return send(order.buyer.email, `Couldn't confirm: ${order.reference}`, html, text);
}

export async function sendEntryNotice(order: Order): Promise<SendResult> {
  const firstName = order.buyer.name.split(" ")[0] || "there";
  const html = shell(
    "You're in. That's the party.",
    `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#c9cadb">
       ${firstName}, door scanned your pass. Welcome to UTOPIA — food's that way, mocktails the other,
       and nobody here is drinking so you don't have to pretend you are either.
     </p>
     <p style="margin:0;padding:16px;background:#11132a;border:1px solid #3a3f7a;border-radius:12px;text-align:center;
               font-family:'Courier New',monospace;font-size:18px;letter-spacing:.16em;color:#ffffff">${order.reference}</p>
     <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#8c8fa8">
       If this wasn't you, reply to this email right now.
     </p>`,
  );
  const text = `${firstName}, you're in. Door scanned your UTOPIA pass (${order.reference}). See you on the floor.`;
  return send(order.buyer.email, `You're in — welcome to UTOPIA`, html, text);
}
