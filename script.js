let isRunning = false;

// Fungsi menampilkan log ke komponen konsol UI
function logMessage(text, type = 'info') {
    const container = document.getElementById('log-container');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    
    const timestamp = new Date().toLocaleTimeString();
    entry.innerText = `[${timestamp}] ${text}`;
    
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
}

// Mengambil daftar Server (Guilds) langsung dari API Resmi Discord
async function loadBotDetails() {
    const token = document.getElementById('bot-token').value.trim();
    if (!token) return logMessage("Token bot tidak boleh kosong.", "error");

    logMessage("Menghubungkan ke API Discord...", "info");
    
    try {
        // Mengambil data langsung ke endpoint resmi Discord v10
        const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
            method: 'GET',
            headers: { 
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errData = await response.text();
            throw new Error(`Sinyal API error (${response.status}): ${errData}`);
        }

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
        logMessage(`Berhasil terhubung! Bot mendeteksi ${guilds.length} Server.`, "success");
    } catch (err) {
        logMessage(`Gagal memuat detail bot: ${err.message}`, "error");
        console.error(err);
    }
}

// Mengambil daftar Channel berdasarkan server yang dipilih langsung dari API Discord
async function loadTargetChannels() {
    const token = document.getElementById('bot-token').value.trim();
    const guildId = document.getElementById('server-select').value;
    const container = document.getElementById('channels-container');

    if (!guildId) {
        container.innerHTML = '<span class="placeholder-text">Pilih server terlebih dahulu...</span>';
        return;
    }

    container.innerHTML = '<span class="placeholder-text">Memuat daftar channel...</span>';

    try {
        const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`HTTP Error status: ${response.status}`);
        
        const channels = await response.json();
        container.innerHTML = '';
        
        // Type 0 adalah Text Channel (Saluran Teks biasa)
        const textChannels = channels.filter(c => c.type === 0);

        if (textChannels.length === 0) {
            container.innerHTML = '<span class="placeholder-text error-text">Tidak ada text channel di server ini.</span>';
            return;
        }
        
        textChannels.forEach(channel => {
            const label = document.createElement('label');
            label.className = 'checkbox-item';
            label.innerHTML = `
                <input type="checkbox" name="target-channels" value="${channel.id}" checked>
                # ${channel.name}
            `;
            container.appendChild(label);
        });
        logMessage("Daftar channel berhasil dimuat.", "success");
    } catch (err) {
        container.innerHTML = '<span class="placeholder-text error-text">Gagal memuat daftar channel.</span>';
        logMessage(`Gagal memuat channel: ${err.message}`, "error");
    }
}

// Mengirimkan pesan biner / text langsung menuju API Discord
async function executeBroadcasting() {
    if (isRunning) return;

    const token = document.getElementById('bot-token').value.trim();
    const channelElements = document.querySelectorAll('input[name="target-channels"]:checked');
    const channels = Array.from(channelElements).map(el => el.value);

    if (channels.length === 0) {
        return logMessage("Pilih minimal satu channel target!", "warn");
    }

    isRunning = true;
    const button = document.getElementById('start-btn');
    button.disabled = true;
    button.innerText = "Transmisi Berjalan...";

    const contentOutside = document.getElementById('outside-content').value.trim();
    const title = document.getElementById('embed-title').value.trim();
    const description = document.getElementById('message-content').value.trim();
    const hexColor = document.getElementById('embed-color').value;

    const iterations = parseInt(document.getElementById('execution-count').value) || 1;
    const delay = parseInt(document.getElementById('delay-time').value) || 2000;
    const numericColor = parseInt(hexColor.replace("#", ""), 16);

    logMessage(`Memulai pengiriman pesan ke ${channels.length} channel target.`, "info");

    // Membuat objek struktur data mentah JSON standar Discord
    const payload = {
        content: contentOutside || undefined,
        embeds: (title || description) ? [{
            title: title || undefined,
            description: description || undefined,
            color: numericColor,
            timestamp: new Date().toISOString()
        }] : undefined
    };

    if (!contentOutside && !title && !description) {
        payload.content = "Bot automated message transmission triggered.";
    }

    for (let currentLoop = 1; currentLoop <= iterations; currentLoop++) {
        if (!isRunning) break;

        for (const channelId of channels) {
            try {
                const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bot ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    logMessage(`[Siklus ${currentLoop}] Terkirim -> Channel ID: ${channelId}`, "success");
                } else if (response.status === 429) {
                    const rateLimit = await response.json();
                    const waitTime = (rateLimit.retry_after || 1) * 1000;
                    logMessage(`[Rate Limit] Terdeteksi! Menunda ${waitTime}ms pada channel ${channelId}`, "warn");
                    await new Promise(res => setTimeout(res, waitTime));
                } else {
                    logMessage(`Gagal kirim ke ${channelId}. Kode Status: ${response.status}`, "error");
                }
            } catch (error) {
                logMessage(`Kesalahan Jaringan pada channel ${channelId}: ${error.message}`, "error");
            }
        }
        
        if (currentLoop < iterations) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    isRunning = false;
    button.disabled = false;
    button.innerText = "Mulai Transmisi";
    logMessage("Seluruh rangkaian proses selesai.", "info");
}
