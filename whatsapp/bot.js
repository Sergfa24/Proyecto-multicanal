const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

const client = new Client({
  authStrategy: new LocalAuth()
});

client.on('qr', qr => {
  console.log('Escanea este QR:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Bot listo');
});

client.on('message', async msg => {
  console.log('Mensaje recibido:', msg.from, msg.body);

  try {
    const response = await axios.post('http://localhost:5678/webhook-test/whatsapp', {
      from: msg.from,
      body: msg.body
    });

    const reply = response.data.reply || 'Sin respuesta';
    await msg.reply(reply);
  
  } catch (error) {
    console.log('Error enviando a n8n:', error.response?.status || error.code || error.message);
    console.log(error.response?.data || '');
  }
});

client.initialize();