const { Client, LocalAuth } = require('whatsapp-web.js');

const qrcode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');

const puppeteer = require('puppeteer-core');

const axios = require('axios');
// Configuração da API
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText';

const API_KEY = 'AIzaSyAoY9W80AieB4hNX5ri-aZ-FCTtt6gp8Gs';

// Configurações do servidor e variáveis
const app = express();
const PORT = process.env.PORT || 3000;
let qrGenerated = false;
let qrImagePath = ''; // Caminho do QR Code gerado
const rolesFilePath = path.join(__dirname, 'userRoles.json');
const DONO = '557191165170@c.us'; // Número do Dono

let perdiCounter = 0;


// Tabela de pessoas específicas (IDs de usuários)
const specificUsers = [
    '557191165170@c.us', // Daniel
    '557182903278@c.us', // Melky
    '557199670849@c.us', // Michael
    '557181984714@c.us', // Marcos
    '557181766942@c.us'  // Matheus
];


// Cargos disponíveis
const roles = {
    recruta: 'Recruta',
    comandante: 'Comandante',
    almirante: 'Almirante',
    yonko: 'Yonkō',
    dono: 'Dono',
};

// Funções auxiliares para gerenciar cargos
const loadRoles = () => {
    if (fs.existsSync(rolesFilePath)) {
        const data = fs.readFileSync(rolesFilePath);
        return JSON.parse(data);
    }
    return {};
};

const saveRoles = () => {
    fs.writeFileSync(rolesFilePath, JSON.stringify(userRoles, null, 4));
};

const getUserRole = (userId) => {
    const normalizedId = userId.endsWith('@c.us') ? userId : `${userId}@c.us`;
    if (normalizedId === DONO) return 'Dono'; // Força o Dono a ser reconhecido
    return userRoles[normalizedId] || 'Recruta';
};

const isRoleAuthorized = (userRole, requiredRole) => {
    const hierarchy = ['Recruta', 'Comandante', 'Almirante', 'Yonkō', 'Dono'];
    return hierarchy.indexOf(userRole) >= hierarchy.indexOf(requiredRole);
};

const fetchGeminiResponse = async (prompt) => {
    try {
        // Corpo da solicitação para a API Gemini
        const body = {
            prompt: { text: prompt },
            temperature: 0.7, // Grau de criatividade
            maxOutputTokens: 100, // Tamanho máximo da resposta
        };

        // Envia a solicitação
        const response = await axios.post(`${BASE_URL}?key=${API_KEY}`, body, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Retorna o texto gerado
        return response.data.candidates[0]?.output || 'Sem resposta disponível.';
    } catch (error) {
        console.error('Erro ao consultar a API Gemini:', error.response?.data || error.message);
        throw new Error('Não foi possível obter uma resposta da API Gemini.');
    }
};


// Carregar as informações dos cargos e adicionar o Dono explicitamente
const userRoles = loadRoles();
if (!userRoles[DONO]) {
    userRoles[DONO] = roles.dono; // Adiciona o Dono ao arquivo de roles, se necessário
    saveRoles();
}


const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        // executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Ajuste o caminho conforme necessário
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
    
});




// Gera e salva o QR Code em um arquivo
const handleQrCode = async (qr) => {
    qrImagePath = path.join(__dirname, 'qrcode.png');
    await qrcode.toFile(qrImagePath, qr);
    qrGenerated = true;
    console.log('QR Code gerado. Acesse /qrcode para visualizá-lo no navegador.');
};

// Funções de Comando
const handlePingCommand = (message) => {
    message.reply('🏓 Pong! Estou funcionando corretamente.');
};

// Função para lidar com o comando !gpt
const handleGeminiCommand = async (message, chat) => {
    try {
        // Remove o prefixo do comando para usar como entrada para o Gemini
        const inputText = message.body.replace('!dsa', '').trim();

        // Caso não tenha texto após o comando
        if (!inputText) {
            message.reply('Por favor, insira uma mensagem para que eu possa responder.');
            return;
        }

        // Obtém a resposta da API Gemini
        const geminiResponse = await fetchGeminiResponse(inputText);

        // Envia a resposta para o chat
        message.reply(`🤖 Resposta da IA:\n${geminiResponse}`);
    } catch (error) {
        // Caso ocorra um erro
        message.reply('Houve um erro ao processar sua solicitação.');
        console.error('Erro no handleGeminiCommand:', error.message);
    }
};

// Variável global para contar o número de vezes que o comando foi acionado

const handlePerdiCommand = async (message) => {
    try {
        // Obtém o chat associado à mensagem
        const chat = await message.getChat();

        // Incrementa o contador
        perdiCounter += 1;

        // Gera a mensagem com as menções
        const mentionText = `Perdemos ${perdiCounter} vez(es), e subindo! 😔\nMarcando:`;
        const mentions = await Promise.all(
            specificUsers.map((id) => client.getContactById(id))
        );

        // Envia a mensagem mencionando as pessoas da tabela
        await chat.sendMessage(`${mentionText} ${mentions.map((user) => `@${user.id.user}`).join(' ')}`, {
            mentions
        });

        console.log(`Mensagem enviada com ${mentions.length} menções.`);
    } catch (error) {
        console.error('Erro ao executar o comando !perdi:', error.message);
        await message.reply('❌ Não foi possível executar o comando no momento.');
    }
};


const handleHelpCommand = (message, senderRole) => {
    const commands = {
        Dono: [
            '!addcargo <número> <cargo> - Atribui um cargo',
            '!removecargo <número> - Remove um cargo',
            '!listarcargos - Lista usuários com cargos',
        ],
        Yonkō: [
            '!all - Marca todos os membros ativos no grupo',
            '!sorteio - Realiza um sorteio no grupo',
        ],
        Almirante: [
            '!sticker - Cria um sticker com a mídia enviada',
            '!dado <número_de_lados> - Rola um dado',
        ],
        Recruta: [
            '!help - Lista os comandos disponíveis',
            '!ping - Verifica o status do bot',
        ],
    };

    const availableCommands = Object.entries(commands)
        .filter(([role]) => isRoleAuthorized(senderRole, role))
        .flatMap(([_, cmds]) => cmds)
        .join('\n');

    message.reply(`📜 *Comandos Disponíveis:* 📜\n${availableCommands}`);
};

const handleAllCommand = async (message, chat) => {
    try {
        if (!chat.isGroup) {
            message.reply('O comando "!all" só pode ser usado em grupos.');
            return;
        }

        console.log(`Comando "!all" detectado no grupo: ${chat.name}`);

        // Obtém os participantes do grupo
        const participants = chat.participants;
        if (!participants || participants.length === 0) {
            message.reply('Não foi possível acessar os participantes do grupo.');
            return;
        }

        // Cria uma lista de menções
        const mentions = await Promise.all(
            participants.map(async (participant) => {
                const contact = await client.getContactById(participant.id._serialized);
                return contact;
            })
        );

        const mentionText = '📢 Menção a todos os membros do grupo!';
        
        // Envia a mensagem mencionando todos os participantes
        await chat.sendMessage(mentionText, { mentions });
        console.log(`Menção enviada para os participantes do grupo: ${chat.name}`);
    } catch (error) {
        console.error('Erro ao mencionar participantes no grupo:', error);
        message.reply('Houve um erro ao tentar mencionar todos no grupo.');
    }
};

const handleAddCargoCommand = (message, args) => {
    const [userId, roleKey] = args;
    if (!userId || !roles[roleKey]) {
        message.reply('Uso correto: !addcargo <número> <cargo>');
        return;
    }

    userRoles[userId] = roles[roleKey];
    saveRoles();
    message.reply(`Cargo "${roles[roleKey]}" atribuído ao usuário ${userId}.`);
};

const handleRemoveCargoCommand = (message, args) => {
    const [userId] = args;
    if (!userId || !userRoles[userId]) {
        message.reply('Uso correto: !removecargo <número>.');
        return;
    }

    delete userRoles[userId];
    saveRoles();
    message.reply(`Cargo removido do usuário ${userId}.`);
};

const handleListarCargosCommand = (message) => {
    const rolesList = Object.entries(userRoles)
        .map(([userId, role]) => `- ${userId}: ${role}`)
        .join('\n');

    if (!rolesList) {
        message.reply('Nenhum usuário possui cargos atribuídos.');
    } else {
        message.reply(`Lista de usuários com cargos:\n${rolesList}`);
    }
};

const handleDadoCommand = (message, args) => {
    const faces = parseInt(args[0], 10);
    if (isNaN(faces) || faces <= 1) {
        message.reply('Uso: !dado <número_de_lados>. Por exemplo: !dado 6');
        return;
    }
    const resultado = Math.floor(Math.random() * faces) + 1;
    message.reply(`🎲 D${faces} : ${resultado}`);
};

const handleSorteioCommand = async (message, chat) => {
    try {
        if (!chat.participants) {
            message.reply('Não foi possível acessar os participantes do grupo.');
            return;
        }

        const participants = chat.participants;
        const memberIds = participants.map((participant) => participant.id._serialized);
        const sorteado = memberIds[Math.floor(Math.random() * memberIds.length)];

        message.reply(`🎉 O sorteado foi: ${sorteado}`);
        console.log(`Sorteio realizado no grupo: ${chat.name}`);
    } catch (error) {
        console.error('Erro ao realizar o sorteio no grupo:', error);
        message.reply('Houve um erro ao realizar o sorteio.');
    }
};

const handleStickerCommand = async (message) => {
    const media = await message.downloadMedia();
    if (!media) {
        message.reply('Não consegui processar a mídia. Certifique-se de que está enviando uma imagem ou vídeo.');
        return;
    }

    await message.reply(media, undefined, { sendMediaAsSticker: true });
    console.log('Sticker gerado com sucesso.');
};

const handleListParticipantsCommand = async (message, chat) => {
    try {
        if (!chat.isGroup) {
            message.reply('O comando "!todos" só pode ser usado em grupos.');
            return;
        }

        console.log(`Comando "!todos" detectado no grupo: ${chat.name}`);

        // Obtém os participantes do grupo
        const participants = chat.participants;
        if (!participants || participants.length === 0) {
            message.reply('Não há participantes no grupo.');
            return;
        }

        // Gera a lista de menções
        const mentions = participants.map((participant) => participant.id._serialized);
        const mentionText = `📋 *Participantes do Grupo "${chat.name}"* 📋\n\n` +
            participants
                .map((participant) => `@${participant.id.user}`)
                .join('\n');

        // Envia a mensagem com as menções
        await chat.sendMessage(mentionText, { mentions });
        console.log(`Lista de participantes enviada para o grupo: ${chat.name}`);
    } catch (error) {
        console.error('Erro ao listar participantes no grupo:', error);
        message.reply('Houve um erro ao tentar listar os participantes do grupo.');
    }
};

const cleanDebugLog = () => {
    const debugLogPath = path.join(__dirname, '.wwebjs_auth', 'session', 'Default', 'chrome_debug.log');
    try {
        if (fs.existsSync(debugLogPath)) {
            fs.unlinkSync(debugLogPath);
            console.log('Arquivo chrome_debug.log removido para evitar conflitos.');
        }
    } catch (err) {
        console.error('Erro ao limpar chrome_debug.log:', err);
    }
};

// Antes de iniciar o cliente:
cleanDebugLog();

// Eventos do cliente
client.on('qr', async (qr) => {
    await handleQrCode(qr);
});

client.on('ready', () => {
    console.log('Bot conectado e pronto para uso!');
});

client.on('message', async (message) => {
    try {
        if (!message.body.startsWith('!')) return;

        const chat = await message.getChat();
        const isGroup = chat.isGroup || chat.id._serialized.endsWith('@g.us');
        const senderRole = getUserRole(message.author || message.from);

        console.log(`Comando recebido de: ${message.from}`);
        console.log(`Comando: ${message.body}`);
        console.log(`É grupo: ${isGroup}`);
        console.log(`Cargo do remetente: ${senderRole}`);

        const [command, ...args] = message.body.split(' ');

        switch (command) {
            case '!all':
                await handleAllCommand(message, chat);
                break;

            case '!dsa':
                await handleGeminiCommand(message, chat);
                break;
            
            case '!dado':
                handleDadoCommand(message, args);
                break;

            case '!perdi':
                handlePerdiCommand(message);
                // await handleAllCommand(message, chat);
                break;    
                
            case '!addcargo':
                if (senderRole !== 'Dono') {
                    message.reply('Somente o Dono pode atribuir cargos.');
                    break;
                }
                handleAddCargoCommand(message, args);
                break;

            case '!removecargo':
                if (senderRole !== 'Dono') {
                    message.reply('Somente o Dono pode remover cargos.');
                    break;
                }
                handleRemoveCargoCommand(message, args);
                break;

            case '!listarcargos':
                if (senderRole !== 'Dono') {
                    message.reply('Somente o Dono pode listar os cargos.');
                    break;
                }
                handleListarCargosCommand(message);
                break;

            case '!help':
                handleHelpCommand(message, senderRole);
                break;

            case '!todos':
                    await handleListParticipantsCommand(message, chat);
                    break;
                

            case '!sorteio':
                if (!isRoleAuthorized(senderRole, 'Almirante')) {
                    message.reply('Você não tem permissão para usar este comando.');
                    break;
                }
                await handleSorteioCommand(message, chat);
                break;

            case '!sticker':
                if (!message.hasMedia) {
                    message.reply('Envie uma imagem ou vídeo junto com o comando "!sticker" para criar um sticker.');
                    break;
                }
                await handleStickerCommand(message);
                break;

                case '!ping':
                    handlePingCommand(message);
                    break;

            default:
                message.reply('Comando não reconhecido. Use !help para ver a lista de comandos disponíveis.');
                break;
        }
    } catch (error) {
        console.error('Erro ao processar a mensagem:', error);
    }
});

// Inicializa o cliente do WhatsApp
client.initialize();

// Rota para exibir o QR Code
app.get('/qrcode', (req, res) => {
    if (qrGenerated && fs.existsSync(qrImagePath)) {
        res.sendFile(qrImagePath);
    } else {
        res.send('QR Code ainda não gerado. Aguarde...');
    }
});

// Evento para detectar erros críticos e reiniciar o cliente
client.on('disconnected', (reason) => {
    console.error(`Cliente desconectado: ${reason}. Tentando reiniciar...`);
    try {
        client.destroy().then(() => {
            cleanDebugLog(); // Certifica-se de limpar o log antes de reiniciar
            client.initialize();
        });
    } catch (err) {
        console.error('Erro ao reiniciar o cliente:', err);
    }
});

// Inicia o servidor Express
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}.`);
});
