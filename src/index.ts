/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

interface Env {
  alumni_db: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

interface Person {
  id: string;
  first_name: string | null;
  birthdate: string | null;
  consent: number | null;
}

type DeliveryStatus = "pending" | "sent" | "failed";

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    if (url.pathname === "/dry-run") return handleDryRun(env);
    if (url.pathname === "/trigger" && req.method === "POST") return runAndReturnSummary(env);
    if (url.pathname === "/debug-env") {
      return new Response(JSON.stringify({
        ALUMNI_DB_exists: !!env.alumni_db,
        TELEGRAM_BOT_TOKEN_exists: !!env.TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID_exists: !!env.TELEGRAM_CHAT_ID
      }, null, 2), { headers: { "Content-Type": "application/json" }});
    }
    return new Response("OK - Worker alive. Use /dry-run or schedule via Cron.", { status: 200 });
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    await runAndReturnSummary(env);
  }
};

async function getTodaysRecipients(env: Env): Promise<Person[]> {
  if (!env.alumni_db) {
    console.error("ALUMNI_DB binding is undefined! Check wrangler.toml / Dashboard bindings.");
    return [];
  }

  const sql = `
    SELECT id, first_name, birthdate, consent
    FROM alumni
    WHERE consent = 1
      AND birthdate IS NOT NULL
      AND (
        CASE
          WHEN substr(birthdate,5,1) = '-' THEN substr(birthdate,6,2) || '-' || substr(birthdate,9,2)  -- YYYY-MM-DD -> MM-DD
          WHEN substr(birthdate,3,1) = '-' THEN substr(birthdate,4,2) || '-' || substr(birthdate,1,2)  -- DD-MM-YYYY -> MM-DD
          ELSE NULL
        END
      ) = strftime('%m-%d', 'now', 'localtime')
  `;
  const res = await env.alumni_db.prepare(sql).all<Person>();
  return (res && res.results) || [];
}


function buildMessageForPerson(person: Person): string {
  const name = person.first_name ?? "Alumnus";
  return `🎂 Happy Birthday ${name}! 🎉\nWarm wishes from KPRIET Alumni.`;
}

async function sendTelegramMessage(env: Env, text: string) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = JSON.stringify({ chat_id: chatId, text: text, parse_mode: "HTML" });

  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  const textResp = await r.text();
  return { ok: r.ok, status: r.status, body: textResp };
}

async function logDelivery(env: Env, alumniId: string, channel: "telegram" | "whatsapp" | "email", status: DeliveryStatus, providerResponse: string | null) {
  const id = crypto.randomUUID();
  const insert = `
    INSERT INTO deliveries (id, alumni_id, channel, provider_response, status, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `;
  await env.alumni_db.prepare(insert).bind(id, alumniId, channel, providerResponse, status).run();
}

async function runAndReturnSummary(env: Env) {
  const recipients = await getTodaysRecipients(env);
  if (!recipients || recipients.length === 0) {
    return new Response(JSON.stringify({ sent: 0, details: [] }), { status: 200 });
  }

  const results: any[] = [];
  for (const p of recipients) {
    const msg = buildMessageForPerson(p);
    try {
      const resp = await sendTelegramMessage(env, msg);
      const status: DeliveryStatus = resp.ok ? "sent" : "failed";
      await logDelivery(env, p.id, "telegram", status, resp.body);
      results.push({ id: p.id, name: p.first_name, status, raw: resp.body });
    } catch (err: any) {
      await logDelivery(env, p.id, "telegram", "failed", String(err));
      results.push({ id: p.id, name: p.first_name, status: "failed", error: String(err) });
    }
  }

  return new Response(JSON.stringify({ sent: recipients.length, details: results }, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

async function handleDryRun(env: Env) {
  const recipients = await getTodaysRecipients(env);
  const previews = recipients.map(p => ({ id: p.id, name: p.first_name, message: buildMessageForPerson(p) }));
  return new Response(JSON.stringify({ count: previews.length, previews }, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
