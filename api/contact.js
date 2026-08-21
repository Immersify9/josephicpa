// Contact form notification endpoint for josephicpa.com
// Receives a submission, validates it, and emails a notification via Resend.
// The Resend API key lives in the RESEND_API_KEY environment variable and
// never reaches the browser.

const TO_ADDRESS   = "ijosephi@josephicpa.com";
const FROM_ADDRESS = "Josephi CPA Website <notifications@send.josephicpa.com>";

const ALLOWED_ORIGINS = [
  "https://josephicpa.com",
  "https://www.josephicpa.com"
];

function clean(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const origin = req.headers.origin || "";
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set");
    return res.status(500).json({ error: "Email is not configured" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

  // Honeypot: a real visitor never sees or fills this field.
  if (clean(body.website, 50) !== "") {
    return res.status(200).json({ ok: true });
  }

  const firstName    = clean(body.firstName, 99);
  const lastName     = clean(body.lastName, 99);
  const email        = clean(body.email, 199);
  const organization = clean(body.organization, 199);
  const service      = clean(body.service, 99);
  const message      = clean(body.message, 5000);

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  const fullName = `${firstName} ${lastName}`;
  const received = new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "long",
    timeStyle: "short"
  });

  const html = `
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#2C2C2C;line-height:1.6;">
      <div style="background:#0D1B2A;color:#F9F5EE;padding:18px 22px;">
        <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#C9A84C;">
          Website Inquiry
        </div>
        <div style="font-size:20px;font-weight:600;margin-top:4px;">Josephi CPA</div>
      </div>
      <table style="border-collapse:collapse;margin:22px 0;width:100%;max-width:640px;">
        <tr><td style="padding:6px 12px 6px 0;font-weight:600;width:150px;">Name</td>
            <td style="padding:6px 0;">${escapeHtml(fullName)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Email</td>
            <td style="padding:6px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Organization</td>
            <td style="padding:6px 0;">${escapeHtml(organization) || "Not provided"}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Service</td>
            <td style="padding:6px 0;">${escapeHtml(service) || "Not selected"}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Received</td>
            <td style="padding:6px 0;">${escapeHtml(received)} CT</td></tr>
      </table>
      <div style="font-weight:600;margin-bottom:6px;">Message</div>
      <div style="border-left:3px solid #C9A84C;background:#F7F5F0;padding:14px 18px;white-space:pre-wrap;">
${escapeHtml(message) || "No message provided."}
      </div>
      <p style="margin-top:22px;font-size:13px;color:#6B7280;">
        Reply directly to this email to respond to ${escapeHtml(firstName)}.
        A copy of this submission is stored in Firestore.
      </p>
    </div>
  `;

  const text = [
    "New website inquiry - Josephi CPA",
    "",
    `Name: ${fullName}`,
    `Email: ${email}`,
    `Organization: ${organization || "Not provided"}`,
    `Service: ${service || "Not selected"}`,
    `Received: ${received} CT`,
    "",
    "Message:",
    message || "No message provided."
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [TO_ADDRESS],
        reply_to: email,
        subject: `Website inquiry from ${fullName}${organization ? " - " + organization : ""}`,
        html: html,
        text: text
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Resend error:", response.status, detail);
      return res.status(502).json({ error: "Email delivery failed" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Contact endpoint error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
