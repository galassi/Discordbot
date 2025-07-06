const { EmbedBuilder } = require('discord.js'); // Importa EmbedBuilder
const sql = require('mssql'); // Importa mssql
const { getPool, updatePuntiSqb } = require('../db'); // Importa correttamente dal modulo db.js

module.exports = {
    name: 'sqbpoint',
    description: 'Mostra la lista dei membri e il loro Personal Clan Rating',
    async execute(message) {
        try {
            console.log("[DEBUG] Esecuzione comando +sqbpoint avviata da:", message.author.tag);
            console.log("[DEBUG] ID canale messaggio:", message.channel.id, "| Nome canale:", message.channel.name);
            console.log("[DEBUG] ID server:", message.guild.id, "| Nome server:", message.guild.name);
            console.log("[DEBUG] ID utente:", message.author.id);

            console.log("[INFO] Chiamando updatePuntiSqb per aggiornare i punti SQB...");
            await updatePuntiSqb(message.client); // Passa il client per la sincronizzazione dei nickname
            console.log("[SUCCESS] Aggiornamento dei punti SQB completato con successo!");

            console.log(`[INFO] Recupero aggiornato delle informazioni dell'utente: ${message.author.tag}`);
            const member = await message.guild.members.fetch(message.author.id); // Aggiorna completamente il membro

            console.log("[INFO] Recupero aggiornato del canale vocale dell'utente...");
            const voiceChannel = member.voice.channel;
            if (!voiceChannel) {
                console.warn(`[WARN] L'utente ${message.author.tag} non è in un canale vocale.`);
                return message.reply("Non sei in un canale vocale. Devi essere in un canale vocale per usare questo comando.");
            }

            console.log(`[INFO] Canale vocale trovato: ${voiceChannel.name}`);

            const membersInVoiceChannel = voiceChannel.members;
            console.log(`[INFO] Membri attuali nel canale vocale "${voiceChannel.name}":`);
            membersInVoiceChannel.forEach(memberData => {
                console.log(`- ${memberData.user.tag} (ID: ${memberData.id})`);
            });

            const memberDetails = [];
            const pool = await getPool();

            for (const [memberId, memberData] of membersInVoiceChannel) {
                console.log(`[INFO] Verifica membro nel database: ${memberData.user.tag}`);
                const iddiscord = memberData.id;

                try {
                    const checkQuery = await pool.request()
                        .input('iddiscord', sql.Char(19), iddiscord)
                        .query(`
                            SELECT idwarthunder, puntisqb
                            FROM dbo.giocatori
                            WHERE iddiscord = @iddiscord
                        `);

                    const result = checkQuery.recordset[0];
                    if (result) {
                        console.log(`[SUCCESS] Dati recuperati per ${memberData.user.tag}: ${JSON.stringify(result)}`);
                        memberDetails.push({
                            nickname: memberData.displayName,
                            idwarthunder: result.idwarthunder,
                            puntisqb: result.puntisqb,
                        });
                    } else {
                        console.warn(`[WARN] Nessun dato trovato per ${memberData.user.tag} nel database.`);
                    }
                } catch (dbError) {
                    console.error(`[ERROR] Errore durante la query per ${memberData.user.tag}: ${dbError.message}`);
                }
            }

            if (memberDetails.length === 0) {
                console.warn(`[WARN] Nessun membro valido trovato nel canale vocale "${voiceChannel.name}".`);
                return message.reply("Non sono stati trovati membri con un ID Discord valido nel canale vocale.");
            }

            console.log("[INFO] Generazione dell'embed con i dettagli aggiornati...");
            const embed = new EmbedBuilder()
                .setTitle('comando +sqbpoint')
                .setColor('#00FF00')
                .setDescription(`Membri nel tuo canale vocale "${voiceChannel.name}" e i loro punti SQB:`)
                .setTimestamp();

            memberDetails.forEach((member) => {
                embed.addFields({
                    name: `Membro: ${member.nickname}`,
                    value: `ID WarThunder: ${member.idwarthunder}\nPunti SQB: ${member.puntisqb}`,
                });
            });

            const botCommandsChannel = message.guild.channels.cache.find(ch => ch.name === 'bot-comandi');
            if (botCommandsChannel) {
                console.log(`[INFO] Invio dei dati nel canale comandi: ${botCommandsChannel.name}`);
                botCommandsChannel.send({ embeds: [embed] });
            } else {
                console.warn("[WARN] Canale bot-comandi non trovato. Invio nel canale corrente.");
                message.channel.send({ embeds: [embed] });
            }

        } catch (error) {
            console.error(`[ERROR] Errore durante l'esecuzione del comando: ${error.message}`);
            console.error('[ERROR] Stack trace:', error.stack);
            message.reply('Si è verificato un errore durante l\'esecuzione del comando.');
        }
    },
};
