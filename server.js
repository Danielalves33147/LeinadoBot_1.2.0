const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Rotas básicas
app.get('/', (req, res) => {
    res.send('Servidor está funcionando!');
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
