# WhatsApp Gateway — Setup Guide

## Overview

MediBook uses a **custom WhatsApp gateway** built with `whatsapp-web.js` to send appointment notifications. It runs as a Docker container on your server.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A dedicated WhatsApp number for the hospital (any smartphone with WhatsApp)

---

## Step 1: Build & Start the Container

From the project root, run:

```bash
docker compose -f docker-compose.openwa.yml up -d --build
```

This will:
1. Build the gateway image (first time takes ~2 minutes)
2. Start the container on port **2785**
3. Begin initializing WhatsApp Web

---

## Step 2: Link Your WhatsApp

1. Open your browser: **http://localhost:2785/api/qr**
2. A **QR code** page will appear (auto-refreshes every 10 seconds)
3. Open WhatsApp on your phone → **Settings → Linked Devices → Link a Device**
4. Scan the QR code
5. Wait for "Connected" status

> ✅ The session is saved in a Docker volume. You only scan **once** — it persists across container restarts.

---

## Step 3: Verify the Connection

Check the health endpoint:

```bash
curl http://localhost:2785/api/health
```

Expected response:
```json
{
  "connected": true,
  "uptime": 120.5,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

## Step 4: Send a Test Message

```bash
curl -X POST http://localhost:2785/api/send-text ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: medibook2025secure" ^
  -d "{\"chatId\": \"919876543210@c.us\", \"text\": \"Hello from MediBook! 🏥\"}"
```

Replace `919876543210` with a real phone number (country code + number, no `+`).

---

## Step 5: Configure Your App

### `.env` file (project root)
```env
OPENWA_API_KEY=medibook2025secure
OPENWA_SESSION_ID=medibook-hospital
VITE_OPENWA_GATEWAY_URL=http://localhost:2785
```

### Supabase Edge Function Secrets (for production)
```bash
supabase secrets set OPENWA_BASE_URL=http://your-server-ip:2785
supabase secrets set OPENWA_API_KEY=medibook2025secure
supabase secrets set OPENWA_SESSION_ID=medibook-hospital
```

---

## Docker Desktop GUI Setup

If you prefer the GUI instead of the command line:

1. Open Docker Desktop
2. Go to **Images** → search for the built image
3. Click **Run** and fill in:

| Setting | Value |
|---------|-------|
| Container name | `medibook-whatsapp` |
| Host port | `2785` |
| Container port | `2785` |
| Volume host path | *(any folder)* |
| Volume container path | `/usr/src/app/session` |

**Environment Variables:**

| Variable | Value |
|----------|-------|
| `PORT` | `2785` |
| `WA_API_KEY` | `medibook2025secure` |

4. Click **Run**
5. Open http://localhost:2785/api/qr → scan QR

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | No | Check connection status |
| `GET` | `/api/qr` | No | QR code page for linking |
| `GET` | `/api/status` | API Key | Session details |
| `POST` | `/api/send-text` | API Key | Send a text message |

### Send Text Request Body
```json
{
  "chatId": "919876543210@c.us",
  "text": "Your appointment is tomorrow at 10:00 AM"
}
```

---

## Monitoring

```bash
# Check container status
docker ps -f name=medibook-whatsapp

# View logs
docker logs medibook-whatsapp --tail 50 -f

# Restart
docker compose -f docker-compose.openwa.yml restart

# Rebuild (after code changes)
docker compose -f docker-compose.openwa.yml up -d --build
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| QR not appearing | Wait 30s, check `docker logs medibook-whatsapp` |
| Container crashes | Check Docker memory (needs ~512MB). Run `docker logs medibook-whatsapp` |
| "Not connected" error | Open `/api/qr` and re-scan QR code |
| "Not registered" error | The phone number doesn't have WhatsApp installed |
| Session expires | Re-scan QR at `/api/qr`. Don't log out the linked device from WhatsApp mobile |

---

## Important Notes

⚠️ **WhatsApp Terms**: This uses unofficial WhatsApp Web automation. For high-volume commercial use, consider the [official Meta WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/).

⚠️ **Rate Limits**: Keep messages to legitimate appointment notifications only. Avoid bulk/spam messaging.

⚠️ **Security**: Change the default API key (`medibook2025secure`) to a strong random string in production.
