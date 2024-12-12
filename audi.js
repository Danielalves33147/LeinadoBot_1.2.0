const speech = require('@google-cloud/speech');
const fs = require('fs');

const client = new speech.SpeechClient({
    keyFilename: './path/to/your-key.json' // Insira o caminho da chave JSON
});

async function transcribeAudio(audioPath) {
    const audio = fs.readFileSync(audioPath).toString('base64');
    const request = {
        audio: { content: audio },
        config: {
            encoding: 'LINEAR16', // Ou 'OGG_OPUS', dependendo do formato
            sampleRateHertz: 16000,
            languageCode: 'pt-BR', // Português Brasileiro
        },
    };

    const [response] = await client.recognize(request);
    const transcription = response.results.map(result => result.alternatives[0].transcript).join('\n');
    return transcription;
}

module.exports = transcribeAudio;
