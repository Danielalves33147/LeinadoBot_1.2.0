const { Client, LocalAuth } = require('whatsapp-web.js');

const qrcode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');

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


//const senderRole = getUserRole(message.from); // Obtém o papel do remetente


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

    console.log(`Verificando cargo de: ${normalizedId}`);
    console.log(`Cargos atuais:`, userRoles);

    if (normalizedId === DONO) return roles.dono;

    const role = userRoles[normalizedId] || roles.recruta;
    console.log(`Cargo retornado para ${normalizedId}: ${role}`);
    return role;
};

const isRoleAuthorized = (userRole, allowedRoles) => {
    const hierarchy = ['Recruta', 'Comandante', 'Almirante', 'Yonkō', 'Dono'];
    const userRank = hierarchy.indexOf(userRole);

    if (userRank === -1) {
        console.error(`Cargo não reconhecido: ${userRole}`);
        return false;
    }

    // Verifica se o cargo do usuário está na lista de cargos autorizados ou superior
    return allowedRoles.some((role) => {
        const requiredRank = hierarchy.indexOf(role);
        return userRank >= requiredRank; // O usuário precisa estar no nível ou acima
    });
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
        executablePath: process.env.CHROME_BIN || null, // Caminho configurado pelo buildpack
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

const executeCommandWithRoleCheck = async (message, allowedRoles, callback) => {
    const chat = await message.getChat(); // Agora o await é válido
    const isGroup = chat.isGroup;
    const userId = isGroup ? message.author : message.from;
    const senderRole = getUserRole(userId); // Cargo do remetente

    if (!isRoleAuthorized(senderRole, allowedRoles)) {
        message.reply(
            `❌Acesso negado: Voce tentou usar o comando, mas é apenas um ${senderRole}`
        );
        console.log(
            `Acesso negado: ${userId} tentou usar o comando, mas é apenas um ${senderRole}.`
        );
        return;
    }

    console.log(`Acesso concedido: ${userId} com cargo ${senderRole}`);
    callback(); // Executa o comando se autorizado
};

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
        Yonkō: [
            '*!ban* - Remover um usuário do grupo',
            '*!todos* - Listar participantes',
            '*!addcargo* <número> <cargo> ',
            '*!removecargo* <número>',
            '*!listarcargos* - Listar usuários',
        ],
        Almirante: [
            '*!sorteio* - Fazer um sorteio',
            '*!sticker* - Cria uma figurinha',
        ],
        Comandante: [
            '*!dado* <número_de_lados>',
            '*!all* - Marcar todos os membros',
            '*!ranks* - Mostrar hierarquia',
            '*!perdi* - Contar "perdi" no grupo',
        ],
        Recruta: [
            '*!help* - Listar comandos',
            '*!ping* - Status do bot',
        ],
    };

    // Hierarquia dos cargos
    const hierarchy = ['Recruta', 'Comandante', 'Almirante', 'Yonkō'];

    // Ajusta o rank exibido se for Dono
    const adjustedRole = senderRole === 'Dono' ? 'Yonkō' : senderRole;

    const userRank = hierarchy.indexOf(adjustedRole);

    // Filtrar os comandos com base no cargo do usuário
    const availableCommands = Object.entries(commands)
        .filter(([role]) => hierarchy.indexOf(role) <= userRank) // Comandos que o cargo pode usar
        .map(([role, cmds]) => {
            // Cria blocos separados por cargo
            return `📌 *${role}*\n${cmds.join('\n')}`;
        })
        .join('\n\n'); // Separa os blocos com uma linha em branco

    // Envia os comandos disponíveis para o usuário
    message.reply(`📜 *Comandos Disponíveis (${adjustedRole}):*\n\n${availableCommands}`);
};

const handleAllCommand = async (message) => {
    try {
        const chat = await message.getChat();

        if (!chat.isGroup) {
            message.reply('O comando "!all" só pode ser usado em grupos.');
            return;
        }

        console.log(`Comando "!all" detectado no grupo: ${chat.name}`);

        // Obtém os participantes do grupo
        const participants = chat.participants;
        if (!participants || participants.length === 0) {
            message.reply('Não há participantes no grupo.');
            return;
        }

        // Mapeia os contatos para menções
        const mentions = await Promise.all(
            participants.map((participant) => client.getContactById(participant.id._serialized))
        );

        // Envia a mensagem com as menções ocultas
        await chat.sendMessage('📍​Chamando todo mundo📍​', { mentions });

        console.log(`Mensagem com menções invisíveis enviada para o grupo: ${chat.name}`);
    } catch (error) {
        console.error('Erro ao executar o comando !all:', error);
        message.reply('Algo deu errado, tente novamente!');
    }
};

const handleAddCargoCommand = (message, args) => {
    const [rawUserId, roleKey] = args;

    // Verifica se o cargo existe
    if (!rawUserId || !roles[roleKey]) {
        message.reply('Uso correto: !addcargo @usuario <cargo>');
        return;
    }

    // Remove o "@" inicial (se existir) e normaliza o ID
    const cleanedUserId = rawUserId.startsWith('@') ? rawUserId.slice(1) : rawUserId;
    const userId = cleanedUserId.endsWith('@c.us') ? cleanedUserId : `${cleanedUserId}@c.us`;

    // Atualiza o cargo no userRoles
    userRoles[userId] = roles[roleKey];
    saveRoles(); // Salva no arquivo JSON

    message.reply(`Cargo "${roles[roleKey]}" atribuído ao usuário ${userId}.`);
    console.log(`Cargo "${roles[roleKey]}" atribuído a ${userId}`);
};

const handleRemoveCargoCommand = (message, args) => {
    const [rawUserId] = args;

    if (!rawUserId) {
        message.reply('Uso correto: !removecargo @usuario.');
        return;
    }

    // Remove o "@" inicial (se existir) e normaliza o ID
    const cleanedUserId = rawUserId.startsWith('@') ? rawUserId.slice(1) : rawUserId;
    const userId = cleanedUserId.endsWith('@c.us') ? cleanedUserId : `${cleanedUserId}@c.us`;

    // Remove o cargo do usuário
    if (!userRoles[userId]) {
        message.reply(`O usuário ${userId} não possui cargo atribuído.`);
        return;
    }

    delete userRoles[userId];
    saveRoles(); // Salva a remoção no arquivo JSON

    message.reply(`Cargo removido do usuário ${userId}.`);
};

const handleListarCargosCommand = async (message) => {
    const rolesList = await Promise.all(
        Object.entries(userRoles).map(async ([userId, role]) => {
            try {
                const contact = await client.getContactById(userId);
                const contactName = contact.pushname || contact.name || contact.number; // Nome, pushname ou número
                return `- ${contactName}: ${role}`;
            } catch (error) {
                console.error(`Erro ao buscar o contato ${userId}:`, error);
                return `- ${userId}: ${role}`; // Retorna o número caso não encontre o contato
            }
        })
    );

    if (rolesList.length === 0) {
        message.reply('Nenhum usuário possui cargos atribuídos.');
    } else {
        message.reply(`📜*Lista de usuários com cargos:*📜\n${rolesList.join('\n')}`);
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

        // Lista de participantes do grupo
        const participants = chat.participants;

        // Seleciona um participante aleatoriamente
        const sorteado = participants[Math.floor(Math.random() * participants.length)];

        // Obtém informações detalhadas do contato sorteado
        const contact = await client.getContactById(sorteado.id._serialized);
        const contactName = contact.pushname || contact.name || contact.number; // Nome, pushname ou número

        // Envia a mensagem com o nome do sorteado
        message.reply(`🎉 O sorteado foi: ${contactName}`);
        console.log(`Sorteio realizado no grupo: ${chat.name || 'Sem Nome'}, Sorteado: ${contactName}`);
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

const handleRanksCommand = (message) => {
    const hierarchy = ['Recruta', 'Comandante', 'Almirante', 'Yonkō', 'Dono'];
    return hierarchy.join('\n');
};

const handleBanCommand = async (message, args, senderRole) => {
    try {
        const chat = await message.getChat();

        if (!chat.isGroup) {
            message.reply('O comando "!ban" só pode ser usado em grupos.');
            return;
        }

        if (args.length === 0 || !args[0].startsWith('@')) {
            message.reply('Uso correto: !ban @usuario.');
            return;
        }

        // Remove o "@" inicial e normaliza o ID do usuário a ser banido
        const userId = args[0].slice(1) + '@c.us';

        // Verifica se o usuário está no grupo
        const participant = chat.participants.find((p) => p.id._serialized === userId);
        if (!participant) {
            message.reply(`Usuário : ${args[0]} não encontrado.`);
            return;
        }

        // Verifica se o remetente tem autorização para banir (Yonkō ou superior)
        if (!isRoleAuthorized(senderRole, ['Yonkō', 'Dono'])) {
            message.reply('Você não tem permissão para usar este comando.');
            return;
        }

        // Obtém o contato do participante
        const contact = await client.getContactById(userId);

        // Remove o participante
        await chat.removeParticipants([userId]);

        // Gera a menção no formato correto usando o participante do grupo
        const mentionText = `@${contact.id.user}`; // `contact.id.user` é o que o WhatsApp usa para marcação

        // Envia a mensagem com a marcação
        await chat.sendMessage(`✅ O usuário ${mentionText} foi catar coquinho.`, {
            mentions: [contact],
        });

        console.log(`Usuário ${userId} (${mentionText}) removido do grupo.`);
    } catch (error) {
        console.error('Erro ao executar o comando !ban:', error);
        message.reply('❌ Não foi possível remover o usuário. Verifique as permissões e tente novamente.');
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

client.on('qr', async (qr) => {
    console.log('QR Code gerado. Copie o texto abaixo e cole em um gerador de QR Code:');
    console.log(qr);

    try {
        qrImagePath = path.join(__dirname, 'qrcode.png');
        await qrcode.toFile(qrImagePath, qr); // Gera o arquivo de imagem
        qrGenerated = true;
    } catch (error) {
        console.error('Erro ao gerar o QR Code:', error);
    }
});

client.on('ready', () => {
    console.log('Bot conectado e pronto para uso!');
});

client.on('message', async (message) => {
    try {
        if (!message.body.startsWith('!')) return;

        // Inicializa o chat
        const chat = await message.getChat();
        const isGroup = chat.isGroup;

        // Obtenha o ID do autor corretamente
        const userId = isGroup ? message.author : message.from;

        // Obtenha o cargo do autor
        const senderRole = getUserRole(userId);

        // Logs para depuração
        console.log(`Comando recebido de: ${userId}, Cargo: ${senderRole}`);
        console.log(`Comando: ${message.body}`);
        console.log(`É grupo: ${isGroup}`);
        console.log(`Usuário: ${userId}, Cargo: ${senderRole}`);
        // Processar comandos
        const [command, ...args] = message.body.split(' ');

        switch (command) {
            case '!ban':
                // Apenas Yonkō e Dono podem usar
                executeCommandWithRoleCheck(message, ['Yonkō', 'Dono'], () => {
                    handleBanCommand(message, args, senderRole);
                });
                break;
        
            case '!todos':
                // Apenas Yonkō e acima podem listar participantes
                executeCommandWithRoleCheck(message, ['Yonkō', 'Dono'], () => {
                    handleListParticipantsCommand(message, chat);
                });
                break;
        
            case '!addcargo':
                // Apenas Yonkō e Dono podem usar
                executeCommandWithRoleCheck(message, ['Yonkō', 'Dono'], () => {
                    handleAddCargoCommand(message, args);
                });
                break;
        
            case '!removecargo':
                // Apenas Yonkō e Dono podem usar
                executeCommandWithRoleCheck(message, ['Yonkō', 'Dono'], () => {
                    handleRemoveCargoCommand(message, args);
                });
                break;
        
            case '!listarcargos':
                // Apenas Yonkō e Dono podem listar cargos
                executeCommandWithRoleCheck(message, ['Yonkō', 'Dono'], () => {
                    handleListarCargosCommand(message);
                });
                break;
        
            case '!sorteio':
                // Apenas Almirante e acima podem usar
                executeCommandWithRoleCheck(message, ['Almirante', 'Yonkō', 'Dono'], () => {
                    handleSorteioCommand(message, chat);
                });
                break;
        
            case '!sticker':
                // Apenas Almirante e acima podem usar
                executeCommandWithRoleCheck(message, ['Almirante', 'Yonkō', 'Dono'], () => {
                    handleStickerCommand(message);
                });
                break;
        
            case '!all':
                // Apenas Comandante e acima podem marcar todos
                executeCommandWithRoleCheck(message, ['Comandante', 'Almirante', 'Yonkō', 'Dono'], () => {
                    handleAllCommand(message);
                });
                break;
        
            case '!dado':
                // Apenas Comandante e acima podem rolar dados
                executeCommandWithRoleCheck(message, ['Comandante', 'Almirante', 'Yonkō', 'Dono'], () => {
                    handleDadoCommand(message, args);
                });
                break;
        
            case '!perdi':
                // Apenas Comandante e acima podem usar
                executeCommandWithRoleCheck(message, ['Comandante', 'Almirante', 'Yonkō', 'Dono'], () => {
                    handlePerdiCommand(message);
                });
                break;
        
            case '!ranks':
                // Apenas Comandante e acima podem consultar hierarquia
                executeCommandWithRoleCheck(message, ['Comandante', 'Almirante', 'Yonkō', 'Dono'], () => {
                    const ranks = handleRanksCommand();
                    message.reply(`📜 Cargos Disponíveis 📜\n\n${ranks}`);
                });
                break;
        
            case '!help':
                // Todos podem acessar o !help
                handleHelpCommand(message, senderRole);
                break;
        
            case '!ping':
                // Todos podem usar o !ping
                handlePingCommand(message);
                break;
        
            default:
                // Comando não reconhecido
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
        res.sendFile(qrImagePath); // Envia a imagem do QR Code para o navegador
    } else {
        res.send('<h1>QR Code ainda não gerado. Aguarde...</h1>'); // Mensagem amigável
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
