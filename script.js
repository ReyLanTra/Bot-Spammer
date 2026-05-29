let isRunning = false;

function logMessage(text, type = 'info') {
    const container = document.getElementById('log-container');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    const timestamp = new Date().toLocaleTimeString();
    entry.innerText = `[${timestamp}] ${text}`;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
}

// Fetches available server structures via backend implementation
async function loadBotDetails() {
    const token = document.getElementById('bot-token').value.trim();
    if (!token) return logMessage("Token bot tidak boleh kosong.", "error");

    logMessage("Mengautentikasi bot dan mengambil daftar guild...", "info");
    
    try {
        // Implementation references external orchestration proxy to prevent CORS policy obstacles
        const response = await fetch('/api/guilds', {
            headers: { 'Authorization': `Bot ${token}` }
        });
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
        logMessage("Daftar server berhasil dimuat.", "success");
    } catch (err) {
        logMessage(`Gagal memuat detail bot: ${err.message}`, "error");
    }
}

// Loads channel components belonging to the chosen guild scope
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
        const response = await fetch(`/api/guilds/${guildId}/channels`, {
            headers: { 'Authorization': `Bot ${token}` }
        });
        const channels = await response.json();

        container.innerHTML = '';
        
        // Filter elements to display only text channels
        channels.filter(c => c.type === 0).forEach(channel => {
            const label = document.createElement('label');
            label.className = 'checkbox-item';
            label.innerHTML = `
                <input type="checkbox" name="target-channels" value="${channel.id}" checked>
                # ${channel.name}
            `;
            container.appendChild(label);
        });
    } catch (err) {
        container.innerHTML = '<span class="placeholder-text error-text">Gagal memuat channel.</span>';
    }
}

// Executes payload serialization and delivery parameters
async function executeBroadcasting() {
    if (isRunning) return;

    const token = document.getElementById('bot-token').value.trim();
    const channelElements = document.querySelectorAll('input[name="target-channels"]:checked');
    const channels = Array.from(channelElements).map(el => el.value);

    if (channels.length === 0) {
        return logMessage("Pilih setidaknya satu channel target.", "warn");
    }

    isRunning = true;
    const button = document.getElementById('start-btn');
    button.disabled = true;
    button.innerText = "Transmisi Berjalan...";

    logMessage(`Memulai proses pengiriman ke ${channels.length} channel target...`, "info");

    // Formulate payload values
    const payload = {
        content: document.getElementById('outside-content').value.trim(),
        embed: {
            title: document.getElementById('embed-title').value.trim(),
            description: document.getElementById('message-content').value.trim(),
            color: parseInt(document.getElementById('embed-color').value.replace("#", ""), 16)
        }
    };

    const iterations = parseInt(document.getElementById('execution-count').value) || 1;
    const delay = parseInt(document.getElementById('delay-time').value) || 2000;

    for (let currentLoop = 1; currentLoop <= iterations; currentLoop++) {
        if (!isRunning) break;

        for (const channelId of channels) {
            try {
                const response = await fetch(`/api/channels/${channelId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bot ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    logMessage(`[Siklus ${currentLoop}] Berhasil terkirim ke channel ID: ${channelId}`, "success");
                } else if (response.status === 429) {
                    logMessage(`[Rate Limit] Batasan terdeteksi pada channel ${channelId}. Menunda operasi.`, "warn");
                } else {
                    logMessage(`Gagal mengirim ke ${channelId}. Status: ${response.status}`, "error");
                }
            } catch (error) {
                logMessage(`Kesalahan jaringan pada channel ${channelId}`, "error");
            }
        }
        
        if (currentLoop < iterations) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    isRunning = false;
    button.disabled = false;
    button.innerText = "Mulai Transmisi";
    logMessage("Proses selesai.", "info");
            }
