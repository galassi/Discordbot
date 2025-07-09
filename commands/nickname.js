const { getPool } = require('../db');
const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    name: 'nickname',
    description: 'Mostra quanti nickname War Thunder dalla pagina web non sono assegnati a un profilo Discord',
    async execute(message) {
        try {
            // Usa l'URL dalla variabile d'ambiente WEBPAGE1
            const url = process.env.WEBPAGE1.replace(/(^'|'$|^"|"$)/g, '');
            const response = await axios.get(url);
            const $ = cheerio.load(response.data);

            // Estrai i nickname dalla pagina web (stesso selettore di db.js)
            const webNicknames = [];
            $('.squadrons-members__grid-item:has(a)').each((index, element) => {
                const nameElement = $(element).find('a').text().trim();
                if (nameElement) webNicknames.push(nameElement);
            });
            console.log(`[DEBUG] Nicknames trovati sul sito: ${webNicknames.length}`);

            // Recupera tutti gli idwarthunder e iddiscord dal database
            const pool = await getPool();
            const dbResult = await pool.request().query('SELECT idwarthunder, iddiscord FROM dbo.giocatori');
            // Normalizza i nickname del database e crea un Set per confronto case-insensitive e senza spazi
            const dbNickSet = new Set(
                dbResult.recordset
                    .map(row => row.idwarthunder)
                    .filter(Boolean)
                    .map(nick => nick.trim().toLowerCase())
            );
            console.log(`[DEBUG] Nicknames trovati nel database (normalizzati): ${dbNickSet.size}`);

            // Trova i nickname presenti sul sito ma non trovati nel database (case-insensitive, senza spazi)
            const notAssigned = webNicknames.filter(nick => !dbNickSet.has(nick.trim().toLowerCase()));
            console.log(`[DEBUG] Nicknames non assegnati (non trovati nel database): ${notAssigned.length}`);

            // Risposta embed multipla per mostrare tutti i nickname (Discord max 25 field per embed)
            const { EmbedBuilder } = require('discord.js');
            if (notAssigned.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('Nick War Thunder non assegnati a un profilo Discord')
                    .setColor('#00FF00')
                    .setDescription('Tutti i nickname War Thunder risultano assegnati a un profilo Discord.')
                    .setTimestamp();
                await message.channel.send({ embeds: [embed] });
                return;
            }

            // Suddividi i nickname in gruppi da 25
            const chunkSize = 25;
            for (let i = 0; i < notAssigned.length; i += chunkSize) {
                const chunk = notAssigned.slice(i, i + chunkSize);
                const embed = new EmbedBuilder()
                    .setTitle('Nick War Thunder non assegnati a un profilo Discord')
                    .setColor('#FF9900')
                    .setDescription(`Trovati ${notAssigned.length} nickname non assegnati:`)
                    .setTimestamp()
                    .addFields({
                        name: `Nicknames ${i + 1} - ${i + chunk.length}`,
                        value: chunk.join(', ')
                    });
                await message.channel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('[ERROR] Errore nel comando +nickname:', error);
            message.reply('Si è verificato un errore durante il controllo dei nickname.');
        }
    },
};
