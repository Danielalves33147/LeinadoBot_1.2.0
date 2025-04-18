const { Client, LocalAuth } = require('whatsapp-web.js');
const { Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const qrcodeTerminal = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Configurações do servidor e variáveis
const app = express();
const PORT = process.env.PORT || 3000;
const rolesFilePath = path.join(__dirname, 'userRoles.json');
let qrCodeActive = false;

//const senderRole = getUserRole(message.from); // Obtém o papel do remetente
let menosumaCounter = 31;
let perdiCounter = 5;
let qrImagePath = path.join(__dirname, 'qrcode.png'); // Alterado de const para let


// Caminho absoluto
const DONO = '557191165170@c.us'; // Número do Dono
const GROUP_ID = '120363372145683104@g.us'; //Mensagens para testar durabilidade

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

    //console.log(`Verificando cargo de: ${normalizedId}`);
    //console.log(`Cargos atuais:`, userRoles);

    if (normalizedId === DONO) return roles.dono;

    const role = userRoles[normalizedId] || roles.recruta;
    //console.log(`Cargo retornado para ${normalizedId}: ${role}`);
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

// Carregar as informações dos cargos e adicionar o Dono explicitamente
const userRoles = loadRoles();
if (!userRoles[DONO]) {
    userRoles[DONO] = roles.dono; // Adiciona o Dono ao arquivo de roles, se necessário
    saveRoles();
};

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "bot-session",
        dataPath: "./wwebjs_auth", // Diretório persistente para Railway
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',         // Resolvido: Adicione esta flag
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--no-zygote',
            '--single-process',
        ],
    },
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

    //console.log(`Acesso concedido: ${userId} com cargo ${senderRole}`);
    callback(); // Executa o comando se autorizado
};
// Funções de Comando
const handlePingCommand = async (message, client) => {
    // Responde ao remetente original
    message.reply('🏓 Pong! Estou funcionando corretamente.');

    // Envia uma mensagem no grupo de testes
    try {
       // await client.sendMessage(GROUP_ID, '🏓 Pong! O comando "ping" foi acionado.');
       // console.log(`Mensagem enviada ao grupo de testes com ID: ${GROUP_ID}`);
    } catch (error) {
       // console.error('Erro ao enviar mensagem no grupo de testes:', error);
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

        //console.log(`Mensagem enviada com ${mentions.length} menções.`);
    } catch (error) {
        //console.error('Erro ao executar o comando !perdi:', error.message);
        await message.reply('❌ Não foi possível executar o comando no momento.');
    }
};

// Variável global para contar o número de vezes que o comando foi acionado
const handleMenosUmaCommand = async (message) => {
    try {
        // Obtém o chat associado à mensagem
        const chat = await message.getChat();

        // Incrementa o contador
        menosumaCounter += 1;

        // Gera a mensagem com as menções
        const mentionText = `O devorador ataca novamente!\n - 1 \n Vítimas  - ${menosumaCounter}\n\n`;
        const mentions = await Promise.all(
            specificUsers.map((id) => client.getContactById(id))
        );

        // Envia a mensagem mencionando as pessoas da tabela
        await chat.sendMessage(`${mentionText} ${mentions.map((user) => `@${user.id.user}`).join(' ')}`, {
            mentions
        });

        //console.log(`Mensagem enviada com ${mentions.length} menções.`);
    } catch (error) {
        //console.error('Erro ao executar o comando !perdi:', error.message);
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
            '*!todos* - Listar participantes',
        ],
        Comandante: [
            '*!all* - Marcar todos os membros',
            '*!ranks* - Mostrar hierarquia',
            '*!perdi* - Contar "perdi" no grupo',
        ],
        Recruta: [
            '*!help* - Listar comandos',
            '*!ping* - Status do bot',
            '*!s* - Cria uma figurinha',
            '*!dado* <número_de_lados>'
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

const handleIOSMentions = async (chat, participants) => {
    try {
        // Filtra apenas os IDs que pertencem a iOS (pode precisar de ajustes baseados no formato do ID)
        const iosParticipants = participants.filter(participant => participant.id._serialized.includes('@s.whatsapp.net'));

        if (iosParticipants.length === 0) {
            console.log('Nenhum participante de iOS identificado.');
            return;
        }

        // Obtém contatos e formata para menções
        const iosMentions = iosParticipants.map(participant => participant.id._serialized);

        // Envia uma mensagem com as menções para iOS
        await chat.sendMessage('📍​Chamando usuários iOS📍​', {
            mentions: iosMentions.map(id => ({ id })),
        });

        console.log('Mensagem enviada para usuários de iOS.');
    } catch (error) {
        console.error('Erro ao marcar usuários de iOS:', error);
    }
};

const handleAllCommand = async (message) => {
    try {
        const chat = await message.getChat();

        if (!chat.isGroup) {
            message.reply('O comando "!all" só pode ser usado em grupos.');
            return;
        }

        // Obtém os participantes do grupo
        const participants = chat.participants;
        if (!participants || participants.length === 0) {
            message.reply('Não há participantes no grupo.');
            return;
        }

        // Mapeia os contatos para menções
        const resolvedContacts = await Promise.all(
            participants.map(async (participant) => {
                const contact = await client.getContactById(participant.id._serialized);
                return contact.isWAContact ? contact.id._serialized : null;
            })
        );

        // Remove valores nulos/indefinidos
        const mentions = resolvedContacts.filter(Boolean);

        // Verifica se existem menções válidas
        if (mentions.length === 0) {
            message.reply('Nenhum participante válido encontrado.');
            return;
        }

        // Envia a mensagem com as menções corretas
        await chat.sendMessage('📍​Chamando todo mundo📍​', {
            mentions: mentions, // Agora está correto
        });

        console.log(`Mensagem enviada para o grupo: ${chat.name}`);
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
    //console.log(`Cargo "${roles[roleKey]}" atribuído a ${userId}`);
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
                //console.error(`Erro ao buscar o contato ${userId}:`, error);
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
        //console.log(`Sorteio realizado no grupo: ${chat.name || 'Sem Nome'}, Sorteado: ${contactName}`);
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
    //console.log('Sticker gerado com sucesso.');
};

const handleListParticipantsCommand = async (message, chat) => {
    try {
        if (!chat.isGroup) {
            message.reply('O comando "!todos" só pode ser usado em grupos.');
            return;
        }

        //console.log(`Comando "!todos" detectado no grupo: ${chat.name}`);

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
        //console.log(`Lista de participantes enviada para o grupo: ${chat.name}`);
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

        //console.log(`Usuário ${userId} (${mentionText}) removido do grupo.`);
    } catch (error) {
        console.error('Erro ao executar o comando !ban:', error);
        message.reply('❌ Não foi possível remover o usuário. Verifique as permissões e tente novamente.');
    }
};

const handleNativePollCommand = async (message) => {
    const chat = await message.getChat();

    // Verifica se o comando foi enviado em um grupo
    if (!chat.isGroup) {
        message.reply('⚠️ O comando "!enquete" só pode ser usado em grupos.');
        return;
    }

    // Data atual
    const currentDate = new Date().toLocaleDateString('pt-BR');

    // Pergunta e opções da enquete
    const question = `Lista Volta : ${currentDate}`;
    const options = [
        'Senai',
        'Sesi',
        'IFBA',
        'IFBA',
        'IFBA',
        'UFBA',
        'Grau',
        'UNEB',
        'Derba ',
        'UNINTER ',
    ];

    try {
        // Cria a enquete
        const poll = new Poll(question, options);

        // Envia a enquete
        await chat.sendMessage(poll);

        // Abre a janela de chat para garantir que a enquete seja visível
        await client.interface.openChatWindow(chat.id._serialized);

        //console.log('Enquete enviada com sucesso:', { question, options });
    } catch (error) {
        console.error('Erro ao enviar a enquete:', error.message);
        message.reply('❌ Houve um erro ao criar a enquete. Certifique-se de que a API suporta esse recurso.');
    }
};

const cleanDebugLog = () => {
    const debugLogPath = path.join(__dirname, '.wwebjs_auth', 'session', 'Default', 'chrome_debug.log');
    try {
        if (fs.existsSync(debugLogPath)) {
            fs.unlinkSync(debugLogPath);
            //console.log('Arquivo chrome_debug.log removido para evitar conflitos.');
        }
    } catch (err) {
        console.error('Erro ao limpar chrome_debug.log:', err);
    }
};

// Função para gerar e exibir o QR Code
const generateQRCode = async (qr) => {
    try {
        qrImagePath = path.join(__dirname, 'qrcode.png');
        await qrcode.toFile(qrImagePath, qr); // Gera a imagem do QR Code
        qrCodeActive = true;
        console.log('QR Code gerado. Escaneie para conectar.');
    } catch (err) {
        console.error('Erro ao gerar o QR Code:', err);
    }
};

// Antes de iniciar o cliente:
cleanDebugLog()



// // Função principal para monitorar a conexão e enviar mensagens
// setInterval(async () => {
//     const currentDateTime = new Date().toLocaleString(); // Data e hora atual
//     console.log(`[${currentDateTime}] Verificando conexão do cliente...`);

//     if (!client.info || !client.info.pushname) {
//         console.log(`[${currentDateTime}] Cliente desconectado. Tentando reconectar...`);
//         try {
//             await client.destroy(); // Encerra a sessão
//             client.initialize();    // Reinicia o cliente

//             // Envia mensagem no grupo informando a desconexão e tentativa de reconexão
//             await client.sendMessage(GROUP_ID, `⚠️ O bot foi desconectado e está tentando reconectar... [${currentDateTime}]`);
//         } catch (error) {
//             console.error(`[${currentDateTime}] Erro ao tentar reconectar:`, error);
//         }
//     } else {
//         console.log(`[${currentDateTime}] Cliente está ativo.`);

//         // Envia mensagem no grupo confirmando que o bot está online
//         await client.sendMessage(GROUP_ID, `✅ O bot está ativo e funcionando normalmente. [${currentDateTime}]`);
//     }
// }, 14400000); // A cada 4 horas

// Eventos do cliente
client.on('qr', async (qr) => {
    console.log('Novo QR Code gerado.');
    qrCodeActive = true;
    try {
        await qrcode.toFile('./qrcode.png', qr); // Salva o QR Code como imagem
        console.log(qr);
    } catch (err) {
        console.error('Erro ao gerar o QR Code:', err);
    }
});

client.on('ready', () => {
    console.log('Bot conectado e pronto para uso.');
    qrCodeActive = false; // Desativa o QR Code quando o cliente está pronto
});
 
client.on('disconnected', async (reason) => {
    console.error(`Cliente desconectado: ${reason}`);
    console.log('Tentando reconectar automaticamente...');

    try {
        client.initialize(); // Reinicializa o cliente sem destruir a sessão
    } catch (err) {
        console.error('Erro ao tentar reconectar:', err);
    }
});


client.on('message', async (message) => {
    try {
        if (!message.body.startsWith('!')) return;

        // Inicializa o chat
        const chat = await message.getChat();
        const isGroup = chat.isGroup;

        // Obtenha o ID do autor corretamente
        const userId = isGroup ? message.author : message.from;

        if (isGroup) {
            // Obtém o nome do grupo
            const chat = await message.getChat();
            groupName = chat.name; // O nome do grupo
        }

        // Obtenha o cargo do autor
        const senderRole = getUserRole(userId);

        // Logs para depuração
        console.log(`Usuario: ${userId}`);
        console.log(`Cargo: ${senderRole}`);
        console.log(`Comando: ${message.body}`);
        console.log(`Grupo: ${groupName}`);
        //console.log(`Usuário: ${userId}, Cargo: ${senderRole}`);


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
                executeCommandWithRoleCheck(message, ['Yonkō', 'Dono','Almirante'], () => {
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
        
            case '!s':
                // Apenas Almirante e acima podem usar
                executeCommandWithRoleCheck(message, ['Almirante', 'Yonkō', 'Dono','Recruta'], () => {
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
                executeCommandWithRoleCheck(message, ['Comandante', 'Almirante', 'Yonkō', 'Dono', 'Recruta'], () => {
                    handleDadoCommand(message, args);
                });
                break;
        
            case '!perdi':
                // Apenas Comandante e acima podem usar
                executeCommandWithRoleCheck(message, ['Comandante', 'Almirante', 'Yonkō', 'Dono'], () => {
                    handlePerdiCommand(message);
                });
                break;

            case '!menosuma':
                    // Apenas Comandante e acima podem usar
                    executeCommandWithRoleCheck(message, ['Comandante', 'Almirante', 'Yonkō', 'Dono'], () => {
                        handleMenosUmaCommand(message);
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
                handlePingCommand(message, client);
                break;

            case '!enquete':
                handleNativePollCommand(message);
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

let lastQRCodeBase64 = null;
// Rota para exibir o QR Code no navegador
client.on('qr', async (qr) => {
    console.log('Novo QR Code gerado.');
    qrCodeActive = true;
    
    // Gera e salva em base64 (em memória)
    qrcode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error('Erro ao gerar QR base64:', err);
            return;
        }
        lastQRCodeBase64 = url;
    });

    // Também exibe no terminal
    qrcodeTerminal.generate(qr, { small: true });
});

app.get('/qrcode', (req, res) => {
    if (qrCodeActive && lastQRCodeBase64) {
        res.send(`
            <html>
                <body style="text-align:center;">
                    <h2>Escaneie o QR Code abaixo:</h2>
                    <img src="${lastQRCodeBase64}" alt="QR Code" />
                </body>
            </html>
        `);
    } else {
        res.send('<h1>QR Code expirado ou bot já conectado.</h1>');
    }
});

process.on('SIGTERM', () => {
    console.log('Recebido SIGTERM. Finalizando o processo...');
    client.destroy() // Fecha a conexão com o WhatsApp
        .then(() => {
            console.log('Cliente desconectado. Finalizando processo.');
            process.exit(0); // Finaliza o processo com sucesso
        })
        .catch((err) => {
            console.error('Erro ao desconectar o cliente:', err);
            process.exit(1); // Finaliza com erro
        });
});

// Inicia o servidor Express
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});


client.on('qr', async (qr) => {
    console.log('Novo QR Code gerado.');
    qrCodeActive = true;
    
    qrcode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error('Erro ao gerar QR base64:', err);
            return;
        }
        lastQRCodeBase64 = url;
    });

    qrcodeTerminal.generate(qr, { small: true });
});

app.get('/qrcode', (req, res) => {
    if (qrCodeActive && lastQRCodeBase64) {
        res.send(`
            <html>
                <body style="text-align:center;">
                    <h2>Escaneie o QR Code abaixo:</h2>
                    <img src="${lastQRCodeBase64}" alt="QR Code" />
                </body>
            </html>
        `);
    } else {
        res.send('<h1>QR Code expirado ou bot já conectado.</h1>');
    }
});

client.on('disconnected', async (reason) => {
    console.error(`Cliente desconectado: ${reason}`);
    try {
        await client.destroy();
        await client.initialize(); // reinicia a sessão
    } catch (err) {
        console.error('Erro ao tentar reconectar:', err);
    }
});


