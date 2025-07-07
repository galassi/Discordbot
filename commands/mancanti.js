const { EmbedBuilder } = require('discord.js');
const sql = require('mssql');
const { getPool } = require('../db');

module.exports = {
    name: 'mancanti',
    description: 'Mostra la lista dei membri con meno di 1200 punti SQB',
    async execute(message) {
        try {
            // Aggiorna i punti SQB di tutti i membri prima di mostrare la lista
            const { updatePuntiSqb } = require('../db');
            await updatePuntiSqb(message.client);

            const pool = await getPool();
            let result;
            try {
                const query = `SELECT namediscord, idwarthunder, puntisqb
                        FROM dbo.giocatori
                        WHERE puntisqb IS NOT NULL
                        AND TRY_CAST(puntisqb AS INT) IS NOT NULL
                        AND TRY_CAST(puntisqb AS INT) < 1200
                        ORDER BY TRY_CAST(puntisqb AS INT) ASC`;
                result = await pool.request().query(query);
            } catch (queryError) {
                return message.reply('Errore durante la query SQL: ' + queryError.message);
            }

            if (!result || !result.recordset || result.recordset.length === 0) {
                return message.reply('Nessun membro trovato con meno di 1200 punti SQB.');
            }

            // Discord embed: max 25 fields per embed
            const maxFields = 25;
            let embeds = [];
            let currentEmbed = new EmbedBuilder()
                .setTitle('Membri con meno di 1200 punti SQB')
                .setColor('#FF0000')
                .setDescription('Ecco la lista dei membri:')
                .setTimestamp();
            let fieldCount = 0;

            result.recordset.forEach((member, idx) => {
                let punti = (member.puntisqb === null || member.puntisqb === undefined) ? 'N/A' : member.puntisqb;
                // Cast a numero se possibile
                if (punti !== 'N/A') {
                    punti = Number(punti);
                    if (isNaN(punti)) punti = 'N/A';
                }
                currentEmbed.addFields({
                    name: `Discord: ${member.namediscord}`,
                    value: `ID WarThunder: ${member.idwarthunder}\nPunti SQB: ${punti}`,
                });
                fieldCount++;
                if (fieldCount === maxFields || idx === result.recordset.length - 1) {
                    embeds.push(currentEmbed);
                    // Prepara nuovo embed se ci sono altri membri
                    if (idx !== result.recordset.length - 1) {
                        currentEmbed = new EmbedBuilder()
                            .setTitle('Membri con meno di 1200 punti SQB (continua)')
                            .setColor('#FF0000')
                            .setTimestamp();
                        fieldCount = 0;
                    }
                }
            });

            const botCommandsChannel = message.guild.channels.cache.get(process.env.BOT_COMANDI);
            for (const emb of embeds) {
                if (botCommandsChannel) {
                    await botCommandsChannel.send({ embeds: [emb] });
                } else {
                    await message.channel.send({ embeds: [emb] });
                }
            }
        } catch (error) {
            console.error(`[ERROR] Errore durante l'esecuzione del comando +mancanti: ${error.message}`);
            message.reply('Si è verificato un errore durante l\'esecuzione del comando.');
        }
    },
};
