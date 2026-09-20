const express = require('express');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

const app = express();
app.use(cors({origin: "*"}));
app.use(express.json());

let sock;
let latestCode = "";
let botOnline = false;

async function connectBot(phoneNumber) {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    const { version } = await fetchLatestBaileysVersion();
    sock = makeWASocket({ version, auth: state, browser: ["Tanzania Dating", "Chrome", "1.0"] });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', ({connection}) => {
        if(connection === 'open') botOnline = true;
        if(connection === 'close') botOnline = false;
    });
    // Karibu ujumbe
    sock.ev.on('group-participants.update', async (a) => {
        if(a.action === 'add'){
            await sock.sendMessage(a.id, { text: `Karibu @${a.participants[0].split('@')[0]} kwenye TANZANIA DATING ❤️`, mentions: a.participants });
        }
    });
    if(phoneNumber && !state.creds.registered){
        await new Promise(r=>setTimeout(r,3000));
        latestCode = await sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g,''));
        return latestCode;
    }
    return latestCode;
}

app.get('/', (req,res)=> res.send('TANZANIA DATING BOT LIVE'));
app.get('/status', (req,res)=> res.json({online: botOnline}));
app.post('/pair', async (req,res)=>{
    try{
        const code = await connectBot(req.body.number);
        res.json({code: code, pairingCode: code});
    }catch(e){ res.status(500).json({error: e.message, code: latestCode}); }
});

app.listen(process.env.PORT || 3000, ()=> connectBot());
