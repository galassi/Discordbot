const { Client } = require('discord.js');
const sql = require('mssql');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

// Configurazione del database
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
    }
};

// Configura un pool di connessioni condiviso
let pool;
async function getPool() {
    try {
        if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_SERVER || !process.env.DB_NAME) {
            throw new Error('Mancano alcune variabili d\'ambiente necessarie per il database');
        }

        console.log('Tentativo di connessione al database...');
        console.log(`Server: ${process.env.DB_SERVER}`);
        console.log(`Database: ${process.env.DB_NAME}`);
        
        if (!pool) {
            pool = await sql.connect(config);
            console.log('Pool di connessione creato con successo');
        }
        return pool;
    } catch (err) {
        console.error('Errore nella creazione del pool di connessione:', err);
        throw err;
    }
}

// Funzione per controllare e inserire i membri con i ruoli specificati
async function checkAndInsertMembers(client) {
    try {
        const pool = await getPool();
        console.log("Connessione al database riuscita!");

        // Preleva tutti i nickname War Thunder dal canale e li mette in una mappa temporanea
        const warThunderNickMap = new Map();
        const channelId = process.env.WT_CHANNEL_ID;
        if (channelId) {
            try {
                const channel = await client.channels.fetch(channelId);
                if (channel && channel.isTextBased()) {
                    let lastId;
                    let allMessages = [];
                    while (true) {
                        const options = { limit: 100 };
                        if (lastId) options.before = lastId;
                        const messages = await channel.messages.fetch(options);
                        if (messages.size === 0) break;
                        allMessages = allMessages.concat(Array.from(messages.values()));
                        lastId = messages.last().id;
                        if (messages.size < 100) break;
                    }
                    for (const msg of allMessages.reverse()) {
                        if (msg.author.bot) continue;
                        const iddiscord = msg.author.id;
                        const idwarthunder = msg.content.trim().substring(0, 30);
                        warThunderNickMap.set(iddiscord, idwarthunder);
                    }
                }
            } catch (err) {
                console.error('Errore nel recupero dei nickname War Thunder dal canale:', err.message);
            }
        }

        const guild = client.guilds.cache.get(process.env.DISCORD_SERVER);
        if (!guild) {
            throw new Error('Server Discord non trovato');
        }
        const members = await guild.members.fetch();
        console.log(`Totale membri nel server: ${members.size}`);

        // Ottieni tutti i membri attuali con ruoli Irix
        const currentIrixMembers = new Set();
        for (const [memberID, member] of members) {
            if (member.roles.cache.some(role => 
                role.name === '「⚔️」IRIX「⚔️」'
            )) {
                currentIrixMembers.add(memberID);
            }
        }
        console.log(`Membri con ruoli Irix trovati: ${currentIrixMembers.size}`);

        // Ottieni tutti i membri dal database
        const dbMembers = await pool.request()
            .query('SELECT iddiscord, namediscord FROM dbo.giocatori');
        console.log(`Membri attualmente nel database: ${dbMembers.recordset.length}`);

        // Rimuovi i membri che non sono più nel server o non hanno più i ruoli Irix
        let membriRimossi = 0;
        for (const dbMember of dbMembers.recordset) {
            const discordId = dbMember.iddiscord.trim();
            const member = await guild.members.fetch(discordId).catch(() => null);
            
            if (!member || !currentIrixMembers.has(discordId)) {
                await pool.request()
                    .input('iddiscord', sql.VarChar(19), discordId)
                    .query('DELETE FROM dbo.giocatori WHERE iddiscord = @iddiscord');
                console.log(`🔴 Rimosso giocatore ${dbMember.namediscord.trim()} (${discordId}) - ${!member ? 'non più nel server' : 'senza ruoli Irix'}`);
                membriRimossi++;
            }
        }
        console.log(`Totale membri rimossi: ${membriRimossi}`);

        // Aggiungi nuovi membri con ruoli Irix
        let membriAggiunti = 0;
        for (const [memberID, member] of members) {
            if (member.roles.cache.some(role => 
                role.name === '「⚔️」IRIX「⚔️」'
            )) {
                const checkDuplicateQuery = await pool.request()
                    .input('iddiscord', sql.VarChar(19), memberID)
                    .query('SELECT COUNT(*) AS count FROM dbo.giocatori WHERE iddiscord = @iddiscord');

                const isDuplicate = checkDuplicateQuery.recordset[0].count > 0;

                const idwarthunder = warThunderNickMap.get(memberID) || null;

                if (!isDuplicate) {
                    // Se esiste un nickname War Thunder per questo utente, inseriscilo
                    await pool.request()
                        .input('iddiscord', sql.VarChar(19), memberID)
                        .input('namediscord', sql.VarChar(30), member.nickname || member.user.username)
                        .input('idwarthunder', sql.VarChar(30), idwarthunder)
                        .query('INSERT INTO dbo.giocatori (iddiscord, namediscord, idwarthunder) VALUES (@iddiscord, @namediscord, @idwarthunder)');
                    console.log(`🟢 Aggiunto nuovo giocatore: ${member.nickname || member.user.username} (${memberID})${idwarthunder ? ` con idwarthunder: ${idwarthunder}` : ''}`);
                    membriAggiunti++;
                } else if (idwarthunder) {
                    // Se il membro è già presente e ha un nickname War Thunder, aggiorna il campo
                    await pool.request()
                        .input('iddiscord', sql.VarChar(19), memberID)
                        .input('idwarthunder', sql.VarChar(30), idwarthunder)
                        .query('UPDATE dbo.giocatori SET idwarthunder = @idwarthunder WHERE iddiscord = @iddiscord');
                    console.log(`✏️ Aggiornato idwarthunder per ${member.nickname || member.user.username} (${memberID}): ${idwarthunder}`);
                }
            }
        }
        console.log(`Totale membri aggiunti: ${membriAggiunti}`);

        console.log("Check, inserimento e rimozione completati con successo!");
    } catch (err) {
        console.error('Errore durante la connessione o l\'inserimento:', err.message);
        console.error('Stack trace:', err.stack);
    }
}


// Sincronizza i nickname War Thunder dal canale Discord
async function syncWarThunderNicknames(client) {
    try {
        const channelId = process.env.WT_CHANNEL_ID;
        if (!channelId) {
            console.error('WT_CHANNEL_ID non impostato nelle variabili d\'ambiente.');
            return;
        }
        const pool = await getPool();
        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
            console.error('Canale War Thunder non trovato o non testuale.');
            return;
        }

        // Scarica tutti i messaggi (max 100 per chiamata, quindi ciclo per tutti)
        let lastId;
        let allMessages = [];
        while (true) {
            const options = { limit: 100 };
            if (lastId) options.before = lastId;
            const messages = await channel.messages.fetch(options);
            if (messages.size === 0) break;
            allMessages = allMessages.concat(Array.from(messages.values()));
            lastId = messages.last().id;
            if (messages.size < 100) break;
        }

        // Per ogni messaggio, aggiorna il database
        for (const msg of allMessages.reverse()) { // reverse per tenere l'ultimo nickname scritto
            if (msg.author.bot) continue;
            const iddiscord = msg.author.id;
            const idwarthunder = msg.content.trim().substring(0, 30);

            // Aggiorna solo se l'utente è già nel database
            const check = await pool.request()
                .input('iddiscord', sql.VarChar(19), iddiscord)
                .query('SELECT COUNT(*) as count FROM dbo.giocatori WHERE iddiscord = @iddiscord');
            if (check.recordset[0].count === 0) continue;

            // Aggiorna il nickname (l'ultimo scritto sovrascrive eventuali precedenti)
            await pool.request()
                .input('iddiscord', sql.VarChar(19), iddiscord)
                .input('idwarthunder', sql.VarChar(30), idwarthunder)
                .query('UPDATE dbo.giocatori SET idwarthunder = @idwarthunder WHERE iddiscord = @iddiscord');
        }
        console.log('Sincronizzazione nickname War Thunder completata!');
    } catch (err) {
        console.error('Errore nella sincronizzazione dei nickname War Thunder:', err.message);
    }
}

// Funzione per aggiornare i punti SQB nel database
async function updatePuntiSqb(client) {
    try {
        // Sincronizza i nickname prima di aggiornare i punti
        await syncWarThunderNicknames(client);

        const pool = await getPool();
        console.log("[INFO] Avvio aggiornamento punti SQB...");

        const url = process.env.WEBPAGE1;
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        console.log("Contenuto HTML caricato correttamente. Inizio estrazione dei dati:");

        const members = [];
        $('.squadrons-members__grid-item:has(a)').each((index, element) => {
            const nameElement = $(element).find('a').text().trim();
            const ratingElement = $(element).next().text().trim();

            if (nameElement && !isNaN(parseInt(ratingElement))) {
                members.push({ idwarthunder: nameElement, rating: parseInt(ratingElement) });
                //console.log(`Membro estratto: ID WarThunder - ${nameElement}, Punti SQB - ${ratingElement}`);
            } else {
                console.log(`Elemento non valido trovato: ID WarThunder - ${nameElement}, Rating - ${ratingElement}`);
            }
        });

        if (members.length === 0) {
            console.log("Nessun membro valido trovato nella pagina.");
            return;
        }

        console.log(`Totale membri validi estratti: ${members.length}`);

        for (const member of members) {
            const { idwarthunder, rating } = member;

            const checkQuery = await pool.request()
                .input('idwarthunder', sql.Char(30), idwarthunder)
                .query(`
                    SELECT iddiscord, puntisqb 
                    FROM dbo.giocatori 
                    WHERE idwarthunder = @idwarthunder
                `);

            //console.log(`Risultato query per ${idwarthunder}:`, checkQuery.recordset);

            const row = checkQuery.recordset[0];
            if (row) {
                const iddiscord = row.iddiscord;
                const oldRating = row.puntisqb;

                if (oldRating !== rating) {
                    await pool.request()
                        .input('iddiscord', sql.Char(19), iddiscord)
                        .input('puntisqb', sql.Int, rating)
                        .query(`
                            UPDATE dbo.giocatori
                            SET puntisqb = @puntisqb
                            WHERE iddiscord = @iddiscord
                        `);

                    //console.log(`Aggiornato punti SQB per ${idwarthunder} (Discord ID: ${iddiscord}): Vecchio - ${oldRating}, Nuovo - ${rating}`);
                } else {
                    //console.log(`Nessun aggiornamento necessario per ${idwarthunder}: Punti SQB invariati (${oldRating}).`);
                }
            } else {
                //console.log(`Membro ${idwarthunder} non trovato nel database. Nessun aggiornamento eseguito.`);
            }
        }

        console.log("Aggiornamento punti SQB completato!");

    } catch (err) {
        console.error('Errore nell\'aggiornare i punti SQB:', err.message);
        console.error('Stack trace:', err.stack);
    }
}

module.exports = { checkAndInsertMembers, updatePuntiSqb, getPool, syncWarThunderNicknames };