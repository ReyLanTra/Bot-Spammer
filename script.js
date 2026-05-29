let isRunning = false;

// Menggunakan CORS Proxy publik yang stabil untuk menembus proteksi browser lokal
const PROXY_URL = "";
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

// Fitur Pengubah Tema yang dipindahkan dari HTML agar tidak error
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const themeButton = document.getElementById('theme-button');
    
    if (currentTheme === 'light') {
        document.documentElement.removeAttribute('data-theme');
        themeButton.innerText = "☀️ Light";
        logMessage("Tema dialihkan ke Dark Mode.", "info");
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeButton.innerText = "🌙 Dark";
        logMessage("Tema dialihkan ke Light Mode.", "info");
    }
}

// Mengambil daftar Server (Guilds) melalui Proxy
async function loadBotDetails() {
    const token = document.getElementById('bot-token').value.trim();
    if (!token) return logMessage("Token bot tidak boleh kosong.", "error");

    logMessage("Menghubungkan ke API Discord via Proxy...", "info");
    
    try {
        // Menembak API lewat gabungan URL Proxy + API Discord
        const response = await fetch(`${PROXY_URL}${DISCORD_API}/users/@me/guilds`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 403) {
            throw new Error("Akses Proxy diblokir. Harap aktifkan izin sementara pada cors-anywhere.");
        }

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
        if (err.message.includes("fetch")) {
            logMessage("Tips: Jika pertama kali, buka https://cors-anywhere.herokuapp.com/corsdemo di browser lalu klik tombol aktifkan.", "warn");
        }
    }
}

// Mengambil daftar Channel melalui Proxy
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
        const response = await fetch(`${PROXY_URL}${DISCORD_API}/guilds/${guildId}/channels`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`HTTP Error status: ${response.status}`);
        
        const channels = await response.json();
        container.innerHTML = '';
        
        // Filter text channel (Type 0)
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

// Menjalankan misi transmisi pesan massal ke channel terpilih
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

    logMessage(`Memulai transmisi ke ${channels.length} channel target.`, "info");

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
        payload.content = "Bot automated transmission active.";
    }

    for (let currentLoop = 1; currentLoop <= iterations; currentLoop++) {
        if (!isRunning) break;

        for (const channelId of channels) {
            try {
                const response = await fetch(`${PROXY_URL}${DISCORD_API}/channels/${channelId}/messages`, {
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
