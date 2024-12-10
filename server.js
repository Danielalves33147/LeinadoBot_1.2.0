const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const qrImagePath = path.join(__dirname, 'qrcode.png'); // Caminho do QR Code gerado

// Rota para exibir o QR Code
app.get('/qrcode', (req, res) => {
    if (fs.existsSync(qrImagePath)) {
        res.sendFile(qrImagePath); // Envia a imagem do QR Code para o navegador
    } else {
        res.send('<h1>QR Code não gerado ainda. Aguarde...</h1>'); // Mensagem amigável
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}.`);
});
