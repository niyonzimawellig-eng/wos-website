// Vercel serverless function: ohereza email na SMS nyuma y'uko application ibitswe.
// Urufunguzo rw'ibanga (keys) ruba muri Vercel > Settings > Environment Variables, ntabwo ruba muri index.html.

const nodemailer = require("nodemailer");

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SUPPORT_PHONES = "0794055078 / 0732156033";
const SUPPORT_EMAIL = "niyonzimawellig@gmail.com";

function normPhone(p) {
  const d = String(p || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+250")) return d;
  if (d.startsWith("250")) return "+" + d;
  if (d.startsWith("0")) return "+250" + d.slice(1);
  if (/^7\d{8}$/.test(d)) return "+250" + d;
  return null;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function sendEmail(row, dateStr) {
  if (!row.email) return "skipped";
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return "not_configured";

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
  });

  const html =
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #dbeafe;border-radius:12px;overflow:hidden">' +
    '<div style="background:#0b3b9e;color:#fff;padding:18px 22px;border-bottom:4px solid #facc15"><b style="font-size:20px">WOS</b> &nbsp; Wellig Online Services</div>' +
    '<div style="padding:22px;color:#1e293b">' +
    '<h2 style="color:#16a34a;margin:0 0 10px">Application Submitted</h2>' +
    '<p>Muraho <b>' + esc(row.full_name) + '</b>,</p>' +
    '<p>Application yawe yakiriwe neza muri <b>Wellig Online Services (WOS)</b>. Ikipe yacu irayisuzuma, turakuvugisha vuba.</p>' +
    '<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">' +
    '<tr><td style="padding:8px;background:#f1f6ff;font-weight:bold">Service</td><td style="padding:8px">' + esc(row.service_name) + '</td></tr>' +
    '<tr><td style="padding:8px;background:#f1f6ff;font-weight:bold">Reference No.</td><td style="padding:8px">' + esc(row.reference) + '</td></tr>' +
    '<tr><td style="padding:8px;background:#f1f6ff;font-weight:bold">Status</td><td style="padding:8px">Received</td></tr>' +
    '<tr><td style="padding:8px;background:#f1f6ff;font-weight:bold">Date</td><td style="padding:8px">' + esc(dateStr) + '</td></tr>' +
    '</table>' +
    '<p style="font-size:13px;color:#475569">Ubufasha / Support: ' + SUPPORT_PHONES + ' &bull; ' + SUPPORT_EMAIL + '</p>' +
    '</div></div>';

  await transporter.sendMail({
    from: '"Wellig Online Services (WOS)" <' + process.env.GMAIL_USER + '>',
    to: row.email,
    subject: "WOS - Application received (" + row.reference + ")",
    html
  });
  return "sent";
}

async function sendSms(row) {
  const to = normPhone(row.phone);
  if (!to) return "skipped";
  if (!process.env.AT_USERNAME || !process.env.AT_API_KEY) return "not_configured";

  const first = String(row.full_name || "").split(" ")[0];
  const message =
    "WOS: Muraho " + first + ", application yawe ya " + row.service_name +
    " yakiriwe neza. Nimero: " + row.reference + ". Turakuvugisha vuba. Ubufasha: 0794055078";

  const base = process.env.AT_USERNAME === "sandbox"
    ? "https://api.sandbox.africastalking.com"
    : "https://api.africastalking.com";

  const body = new URLSearchParams({ username: process.env.AT_USERNAME, to, message });
  if (process.env.AT_SENDER) body.set("from", process.env.AT_SENDER);

  const r = await fetch(base + "/version1/messaging", {
    method: "POST",
    headers: {
      apiKey: process.env.AT_API_KEY,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!r.ok) throw new Error("SMS HTTP " + r.status);
  return "sent";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SUPA_URL || !SUPA_KEY) return res.status(500).json({ error: "Server not configured" });

  const ref = req.body && req.body.reference;
  if (typeof ref !== "string" || !/^WOS-[A-Z0-9]{8}$/.test(ref)) {
    return res.status(400).json({ error: "Bad reference" });
  }

  // Fata umurongo ukanawushyireho "notified = true" icyarimwe (birinda kohereza kabiri)
  const claim = await fetch(
    SUPA_URL + "/rest/v1/applications?reference=eq." + encodeURIComponent(ref) + "&notified=eq.false",
    {
      method: "PATCH",
      headers: {
        apikey: SUPA_KEY,
        Authorization: "Bearer " + SUPA_KEY,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ notified: true })
    }
  );
  if (!claim.ok) return res.status(502).json({ error: "Database error" });
  const rows = await claim.json();
  if (!rows.length) return res.status(404).json({ error: "Not found or already sent" });

  const row = rows[0];
  const dateStr = new Date(row.created_at || Date.now()).toLocaleDateString("en-GB",
    { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Kigali" });

  const [e, s] = await Promise.allSettled([sendEmail(row, dateStr), sendSms(row)]);
  if (e.status === "rejected") console.error("Email error:", e.reason);
  if (s.status === "rejected") console.error("SMS error:", s.reason);

  return res.status(200).json({
    email: e.status === "fulfilled" ? e.value : "failed",
    sms: s.status === "fulfilled" ? s.value : "failed"
  });
};
