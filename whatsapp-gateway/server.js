/**
 * MediBook WhatsApp Gateway
 * Simple REST API powered by whatsapp-web.js
 * 
 * Endpoints:
 *   GET  /api/health          — Check connection status
 *   GET  /api/qr              — Get QR code as image (for scanning)
 *   POST /api/send-text       — Send a text message
 *   GET  /api/status          — Get session info
 */

const express = require('express')
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode')
const qrcodeTerminal = require('qrcode-terminal')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 2785
const API_KEY = process.env.WA_API_KEY || 'medibook2025secure'

// ─── State ───
let qrCodeData = null
let isReady = false
let clientInfo = null

// ─── WhatsApp Client ───
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: '/usr/src/app/session'  // Persisted via Docker volume
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--disable-gpu',
      '--single-process'
    ]
  }
})

// ─── Client Events ───
client.on('qr', (qr) => {
  qrCodeData = qr
  isReady = false
  console.log('\n📱 QR Code received! Scan it with WhatsApp:')
  qrcodeTerminal.generate(qr, { small: true })
  console.log('\nOr open: http://localhost:' + PORT + '/api/qr\n')
})

client.on('ready', () => {
  isReady = true
  qrCodeData = null
  clientInfo = client.info
  console.log('✅ WhatsApp connected!')
  console.log(`   Phone: ${client.info?.wid?.user || 'Unknown'}`)
  console.log(`   Name: ${client.info?.pushname || 'Unknown'}`)
  console.log(`   API ready at http://localhost:${PORT}`)
})

client.on('authenticated', () => {
  console.log('🔑 Session authenticated')
})

client.on('auth_failure', (msg) => {
  console.error('❌ Authentication failed:', msg)
  isReady = false
})

client.on('disconnected', (reason) => {
  console.log('⚠️  Disconnected:', reason)
  isReady = false
  // Auto reconnect
  setTimeout(() => {
    console.log('🔄 Attempting to reconnect...')
    client.initialize()
  }, 5000)
})

// ─── API Key Middleware ───
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' })
  }
  next()
}

// ─── Routes ───

// Health check (no auth required)
app.get('/api/health', (req, res) => {
  res.json({
    connected: isReady,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

// Get QR code as image (for admin panel)
app.get('/api/qr', async (req, res) => {
  if (isReady) {
    return res.json({ status: 'connected', message: 'Already connected, no QR needed' })
  }
  if (!qrCodeData) {
    return res.json({ status: 'waiting', message: 'Waiting for QR code... Please wait.' })
  }
  
  try {
    const qrImage = await qrcode.toDataURL(qrCodeData)
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>MediBook WhatsApp - Scan QR</title>
        <style>
          body { font-family: system-ui; background: #0a0a0a; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          h1 { color: #25D366; margin-bottom: 8px; }
          p { color: #888; margin-bottom: 24px; }
          img { border-radius: 16px; border: 2px solid #25D366; }
          .refresh { color: #25D366; margin-top: 16px; text-decoration: none; font-weight: 600; }
        </style>
        <meta http-equiv="refresh" content="10">
      </head>
      <body>
        <h1>🏥 MediBook WhatsApp</h1>
        <p>Scan this QR code with WhatsApp on your phone</p>
        <img src="${qrImage}" width="300" height="300" />
        <a class="refresh" href="/api/qr">🔄 Refresh</a>
        <p style="font-size: 12px; margin-top: 24px;">Page auto-refreshes every 10 seconds</p>
      </body>
      </html>
    `)
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR: ' + err.message })
  }
})

// Get session status
app.get('/api/status', requireApiKey, (req, res) => {
  res.json({
    connected: isReady,
    phone: clientInfo?.wid?.user || null,
    name: clientInfo?.pushname || null,
    platform: clientInfo?.platform || null
  })
})

// Send text message
app.post('/api/send-text', requireApiKey, async (req, res) => {
  if (!isReady) {
    return res.status(503).json({ error: 'WhatsApp not connected. Scan QR first.', connected: false })
  }

  const { chatId, text } = req.body

  if (!chatId || !text) {
    return res.status(400).json({ error: 'Missing chatId or text in request body' })
  }

  try {
    // Ensure chatId format: 919876543210@c.us
    const formattedId = chatId.includes('@') ? chatId : `${chatId}@c.us`
    
    // Check if number is registered on WhatsApp
    const isRegistered = await client.isRegisteredUser(formattedId)
    if (!isRegistered) {
      return res.status(404).json({ 
        error: 'This number is not registered on WhatsApp',
        chatId: formattedId 
      })
    }

    const msg = await client.sendMessage(formattedId, text)
    
    console.log(`📤 Message sent to ${formattedId.split('@')[0]}`)
    
    res.json({
      success: true,
      messageId: msg.id?.id || null,
      timestamp: msg.timestamp,
      to: formattedId
    })
  } catch (err) {
    console.error('❌ Send failed:', err.message)
    res.status(500).json({ error: 'Failed to send: ' + err.message })
  }
})

// ─── Start ───
app.listen(PORT, () => {
  console.log('\n═══════════════════════════════════')
  console.log('  MediBook WhatsApp Gateway 🏥')
  console.log('═══════════════════════════════════')
  console.log(`  API:    http://localhost:${PORT}`)
  console.log(`  QR:     http://localhost:${PORT}/api/qr`)
  console.log(`  Health: http://localhost:${PORT}/api/health`)
  console.log('═══════════════════════════════════\n')
  console.log('🔄 Initializing WhatsApp client...\n')
  
  client.initialize()
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...')
  await client.destroy()
  process.exit(0)
})
