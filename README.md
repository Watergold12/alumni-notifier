# 🎂 Alumni Notifier Bot

A **Cloudflare Worker + D1 Database** project that automatically sends personalized birthday wishes to our alumni group on **Telegram**.  
The Worker runs on a daily cron schedule and looks up alumni records in the D1 database to decide who gets messages.  

---

## 🚀 Features
- ✅ Scheduled daily run at **06:00 UTC (11:30 AM IST)**
- ✅ Stores alumni info (name, birthdate, consent) in **D1 database**
- ✅ Sends personalized birthday greetings via **Telegram Bot API**
- ✅ Safe testing with `/dry-run` endpoint (no real messages sent)
- ✅ Logs each delivery in a `deliveries` table for debugging
- 🛠️ Easy to extend for **anniversaries, email, or WhatsApp** in the future

---

## 📂 Project Structure
alumni-notifier/
├─ src/
│ └─ index.ts # Worker source code
├─ migrations/
│ └─ 001_init.sql # Database schema (alumni + deliveries tables)
├─ wrangler.toml # Worker + D1 config + cron schedule
├─ package.json
├─ package-lock.json
├─ .gitignore
└─ README.md

---

## ⚙️ Setup Instructions

### 1. Clone the repo
```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
```

### 2. Install Wrangler

```
npm install -g wrangler
```
### 3. Create the D1 Database

```
wrangler d1 create alumni_db
```

### 4. Apply Migrations (tables: alumni, deliveries)

```
wrangler d1 migrations apply alumni_db
```

### 5. Add Secrets (Telegram bot)

```
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
```

### 6. Deploy worker

```
wrangler deploy
```

### 🔍 Testing
#### Preview recipients (no messages sent):

```curl https://<your-worker>.workers.dev/dry-run```

### Trigger send manually:

```curl -X POST https://<your-worker>.workers.dev/trigger```

### Check deliveries log:

```
wrangler d1 execute alumni_db \
  --command "SELECT * FROM deliveries ORDER BY created_at DESC LIMIT 10;" --remote
```

📌 Notes
- Never commit secrets (tokens, chat IDs). They are stored in Cloudflare secrets.
- Cron jobs are UTC-based. 0 6 * * * runs daily at 06:00 UTC (11:30 AM IST).
- To support anniversaries or other events, add a new column in alumni (e.g. anniversary) and extend the query in index.ts.

🤝 Contributing:
- Fork the repo
- Create a feature branch
- Submit a PR with your changes
