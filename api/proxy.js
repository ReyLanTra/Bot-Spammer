// api/proxy.js
export const config = {
    api: {
        bodyParser: false, // Mematikan parser bawaan agar data binary file gambar diteruskan secara mentah
    },
};

export default async function handler(req, res) {
    // Pengaturan Header CORS agar frontend dapat mengakses endpoint ini
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing target URL parameter.' });
    }

    try {
        const headers = {};
        if (req.headers['authorization']) {
            headers['Authorization'] = req.headers['authorization'];
        }
        if (req.headers['content-type']) {
            headers['Content-Type'] = req.headers['content-type'];
        }

        // Konfigurasi pengambilan data untuk Vercel Serverless v18+
        const fetchOptions = {
            method: req.method,
            headers: headers,
        };

        // Jika metode POST, kirimkan stream body dan tambahkan duplex: 'half'
        if (req.method === 'POST') {
            fetchOptions.body = req;
            fetchOptions.duplex = 'half'; // <--- PERBAIKAN UTAMA: Wajib ada untuk streaming body di Node.js terbaru
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
        return res.status(500).json({ error: `Proxy routing failure: ${error.message}` });
    }
}
