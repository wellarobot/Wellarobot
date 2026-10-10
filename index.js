import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import pino from 'pino';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
let sock = null;
let isConnected = false;
let settings = { welcomeMessage: true };

try {
  if (fs.existsSync('./settings.json')) {
    settings = JSON.parse(fs.readFileSync('./settings.json', 'utf-8'));
  }
} catch(e){}

function saveSettings(){
  fs.writeFileSync('./settings.json', JSON.stringify(settings));
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ["Tanzania Bot", "Chrome", "1.0"]
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
      else isConnected = false;
    } else if (connection === 'open') {
      console.log('✅ Bot Connected!');
      isConnected = true;
    }
  });

  // WELCOME MESSAGE na TAG
  sock.ev.on('group-participants.update', async (update) => {
    if (!settings.welcomeMessage) return;
    if (update.action === 'add') {
      for (let participant of update.participants) {
        try {
          const meta = await sock.groupMetadata(update.id);
          const text = `Karibu sana @${participant.split('@')[0]} kwenye *${meta.subject}* 🎉\n\nTunafurahi kukuona hapa!`;
          await sock.sendMessage(update.id, { text, mentions: [participant] });
        } catch(err){ console.log(err) }
      }
    }
  });
}
startBot();

app.get('/', (req,res) => res.json({ status: isConnected? 'connected' : 'disconnected' }));

// Hii ndio Lovable yako inaita ukibonyeza "Pata Pairing Code"
app.post('/pairing-code', async (req,res) => {
  try {
    let { number } = req.body; // 255749520061
    let cleanNumber = number.replace(/[^0-9]/g, '');
    if (!sock) { await startBot(); await new Promise(r=>setTimeout(r,2000)); }
    if (isConnected) return res.json({ code: 'ALREADY_CONNECTED' });
    const code = await sock.requestPairingCode(cleanNumber);
    const formatted = code.slice(0,4) + '-' + code.slice(4);
    res.json({ code: formatted });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/settings', (req,res) => {
  if (typeof req.body.welcomeMessage === 'boolean') {
    settings.welcomeMessage = req.body.welcomeMessage;
    saveSettings();
  }
  res.json(settings);
});
app.get('/settings', (req,res) => res.json(settings));

app.listen(PORT, () => console.log(`🚀 Running on ${PORT}`));
