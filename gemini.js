const axios = require('axios');

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText';
const API_KEY = 'AIzaSyAoY9W80AieB4hNX5ri-aZ-FCTtt6gp8Gs';

async function testGeminiAPI() {
    try {
        const body = {
            prompt: { text: "Conte uma piada" },
            temperature: 0.7,
            maxOutputTokens: 50,
        };

        const response = await axios.post(`${BASE_URL}?key=${API_KEY}`, body, {
            headers: { 'Content-Type': 'application/json' },
        });

        console.log('Resposta da API:', response.data);
    } catch (error) {
        console.error('Erro ao consultar a API Gemini:', error.response?.data || error.message);
    }
}

testGeminiAPI();
