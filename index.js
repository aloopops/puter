const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// DeepSeek API simulation
async function getDeepSeekResponse(prompt, model = 'deepseek-chat') {
    // This simulates the unofficial API that Puter uses
    const response = await axios.post('https://deepseek-api.puter.com/v1/chat/completions', {
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: true
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
        },
        responseType: 'stream'
    });
    
    return response.data;
}

// Streaming endpoint
app.get('/ai', async (req, res) => {
    try {
        const prompt = req.query.prompt;
        const model = req.query.model || 'deepseek-chat';
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        const stream = await getDeepSeekResponse(prompt, model);
        
        stream.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(line => line.trim());
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.replace('data: ', '');
                    if (data === '[DONE]') {
                        res.write('event: end\ndata: {}\n\n');
                        return res.end();
                    }
                    
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices?.[0]?.delta?.content) {
                            res.write(`data: ${JSON.stringify({ content: parsed.choices[0].delta.content })}\n\n`);
                        }
                    } catch (e) {
                        console.error('Error parsing chunk:', e);
                    }
                }
            }
        });
        
        stream.on('error', (err) => {
            console.error('Stream error:', err);
            res.write('event: error\ndata: ' + JSON.stringify({ error: err.message }) + '\n\n');
            res.end();
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Web interface
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`API endpoint: http://localhost:${port}/ai?prompt=your+question`);
});
