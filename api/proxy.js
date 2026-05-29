// api/proxy.js
export const config = {
    api: {
        bodyParser: false, // Disabling automatic body parsing to allow raw binary stream pass-through
    },
};

export default async function handler(req, res) {
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

        // Forward the raw unparsed request stream directly to the external destination
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: headers,
            body: req.method === 'POST' ? req : undefined
        });

        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        return res.status(response.status).json(data);
    } catch (error) {
        return res.status(500).json({ error: `Proxy routing failure: ${error.message}` });
    }
}
