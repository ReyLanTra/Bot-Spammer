// api/proxy.js
export default async function handler(req, res) {
    // Mengizinkan hak akses CORS agar bisa diakses oleh HTML frontend kamu
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Mengambil target URL asli dari query (?url=...)
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing target URL parameter.' });
    }

    const authHeader = req.headers['authorization'];

    try {
        const fetchOptions = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        // Teruskan token bot jika ada
        if (authHeader) {
            fetchOptions.headers['Authorization'] = authHeader;
        }

        // Jika metodenya POST/PUT, teruskan data body pesan isi spamnya
        if (req.method === 'POST' || req.method === 'PUT') {
            fetchOptions.body = JSON.stringify(req.body);
        }

        const discordResponse = await fetch(targetUrl, fetchOptions);
        
        let data;
        const contentType = discordResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await discordResponse.json();
        } else {
            data = await discordResponse.text();
        }

        return res.status(discordResponse.status).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
