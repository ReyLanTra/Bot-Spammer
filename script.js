let isRunning = false;

// Otomatis mendeteksi domain Vercel tempat web kamu di-deploy
const LOCAL_PROXY = window.location.origin + "/api/proxy?url=";
const DISCORD_API = "https://discord.com/api/v10";

function logMessage(text, type = 'info') {
    const container = document.getElementById('log-container');
    if (!container) return;
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    const timestamp = new Date().toLocaleTimeString();
    entry.innerText = `[${timestamp}] ${text}`;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const themeButton = document.getElementById('theme-button');
    if (currentTheme === 'light') {
        document.documentElement.removeAttribute('data-theme');
        themeButton.innerText = "☀️ Light";
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeButton.innerText = "🌙 Dark";
    }
}

async function loadBotDetails() {
    const token = document.getElementById('bot-token').value.trim();
    if (!token) return logMessage("Token bot tidak boleh kosong.", "error");

    logMessage("Menghubungkan ke API Discord via Serverless Proxy...", "info");
    
    try {
        const targetUrl = encodeURIComponent(`${DISCORD_API}/users/@me/guilds`);
        const response = await fetch(`${LOCAL_PROXY}${targetUrl}`, {
            method: 'GET',
            headers: { 'Authorization': `Bot ${token}` }
        });

        if (!response.ok) throw new Error(`Sinyal API error (${response.status})`);

        const guilds = await response.json();
        const select = document.getElementById('server-select');
        select.innerHTML = '<option value="">-- Pilih Server --</option>';
        
        guilds.forEach(guild => {
            const opt = document.createElement('option');
            opt.value = guild.id;
            opt.innerText = guild.name;
            select.appendChild(opt);
        });

        select.disabled = false;
        document.getElementById('start-btn').disabled = false;
        logMessage(`Berhasil terhubung! Mendeteksi ${guilds.length} Server.`, "success");
    } catch (err) {
        logMessage(`Gagal memuat detail bot: ${err.message}`, "error");
    }
}

async function loadTargetChannels() {
    const token = document.getElementById('bot-token').value.trim();
    const guildId = document.getElementById('server-select').value;
    const container = document.getElementById('channels-container');

    if (!guildId) return;
    container.innerHTML = '<span class="placeholder-text">Memuat daftar channel...</span>';

    try {
        const targetUrl = encodeURIComponent(`${DISCORD_API}/guilds/${guildId}/channels`);
        const response = await fetch(`${LOCAL_PROXY}${targetUrl}`, {
            method: 'GET',
            headers: { 'Authorization': `Bot ${token}` }
        });

        if (!response.ok) throw new Error(`Status: ${response.status}`);
        
        const channels = await response.json();
        container.innerHTML = '';
        const textChannels = channels.filter(c => c.type === 0);

        if (textChannels.length === 0) {
            container.innerHTML = '<span class="placeholder-text error-text">Tidak ada text channel.</span>';
            return;
        }
        
        textChannels.forEach(channel => {
            const label = document.createElement('label');
            label.className = 'checkbox-item';
            label.innerHTML = `<input type="checkbox" name="target-channels" value="${channel.id}" checked> # ${channel.name}`;
            container.appendChild(label);
        });
        logMessage("Daftar channel berhasil dimuat.", "success");
    } catch (err) {
        container.innerHTML = '<span class="placeholder-text error-text">Gagal memuat daftar channel.</span>';
    }
}

async function executeBroadcasting() {
    if (isRunning) return;
    const token = document.getElementById('bot-token').value.trim();
    const channelElements = document.querySelectorAll('input[name="target-channels"]:checked');
    const channels = Array.from(channelElements).map(el => el.value);

    if (channels.length === 0) return logMessage("Pilih minimal satu channel target!", "warn");

    isRunning = true;
    const button = document.getElementById('start-btn');
    button.disabled = true;
    button.innerText = "Transmisi Berjalan...";

    const contentOutside = document.getElementById('outside-content').value.trim();
    const title = document.getElementById('embed-title').value.trim();
    const description = document.getElementById('message-content').value.trim();
    const numericColor = parseInt(document.getElementById('embed-color').value.replace("#", ""), 16);

    const iterations = parseInt(document.getElementById('execution-count').value) || 1;
    const delay = parseInt(document.getElementById('delay-time').value) || 2000;

    const payload = {
        content: contentOutside || undefined,
        embeds: (title || description) ? [{
            title: title || undefined,
            description: description || undefined,
            color: numericColor,
            timestamp: new Date().toISOString()
        }] : undefined
    };

    for (let currentLoop = 1; currentLoop <= iterations; currentLoop++) {
        if (!isRunning) break;
        for (const channelId of channels) {
            try {
                const targetUrl = encodeURIComponent(`${DISCORD_API}/channels/${channelId}/messages`);
                const response = await fetch(`${LOCAL_PROXY}${targetUrl}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bot ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: payload // Kirim langsung objek mentahnya
                });

                if (response.ok) {
                    logMessage(`[Siklus ${currentLoop}] Terkirim -> Channel: ${channelId}`, "success");
                } else if (response.status === 429) {
                    const rateLimit = await response.json();
                    const waitTime = (rateLimit.retry_after || 1) * 1000;
                    logMessage(`[Rate Limit] Menunda ${waitTime}ms`, "warn");
                    await new Promise(res => setTimeout(res, waitTime));
                } else {
                    logMessage(`Gagal ke ${channelId}. Status: ${response.status}`, "error");
                }
            } catch (error) {
                logMessage(`Error Jaringan pada ${channelId}`, "error");
            }
        }
        if (currentLoop < iterations) await new Promise(res => setTimeout(res, delay));
    }

    isRunning = false;
    button.disabled = false;
    button.innerText = "Mulai Transmisi";
    logMessage("Rangkaian proses selesai.", "info");
}
