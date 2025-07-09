const { getPool, updatePuntiSqb } = require('../db');

module.exports = {
    name: 'reminder',
    description: 'Invia un messaggio privato a tutti i membri con meno di 1200 punti SQB',
    async execute(message) {
        try {
            // Permetti solo agli utenti con un certo ruolo di usare il comando
            const requiredRoleId = '1391057660844970004';
            const member = await message.guild.members.fetch(message.author.id);
            if (!member.roles.cache.has(requiredRoleId)) {
                return message.reply('Non hai i permessi per utilizzare questo comando!');
            }

            // Aggiorna i punti SQB di tutti i membri prima di inviare i reminder
            await updatePuntiSqb(message.client);
            const pool = await getPool();
            const result = await pool.request().query(`
                SELECT iddiscord, namediscord, idwarthunder, puntisqb
                FROM dbo.giocatori
                WHERE puntisqb IS NOT NULL
                AND TRY_CAST(puntisqb AS INT) IS NOT NULL
                AND TRY_CAST(puntisqb AS INT) < 1200
                ORDER BY TRY_CAST(puntisqb AS INT) ASC
            `);

            if (!result.recordset || result.recordset.length === 0) {
                return message.reply('Nessun membro trovato con meno di 1200 punti SQB.');
            }

            let successCount = 0;
            let failedMembers = [];
            for (const memberData of result.recordset) {
                // Salta se il punteggio è null o non numerico
                if (memberData.puntisqb === null || memberData.puntisqb === undefined || isNaN(Number(memberData.puntisqb))) {
                    continue;
                }
                try {
                    const member = await message.guild.members.fetch(memberData.iddiscord).catch(() => null);
                    if (!member) {
                        failedMembers.push(memberData.namediscord || memberData.iddiscord);
                        continue;
                    }
                    const punti = Number(memberData.puntisqb);
                    const dmMessage = `Ciao ${member.displayName || member.user.username},\n\nTi ricordiamo che per partecipare alle attività della Squadriglia è necessario raggiungere almeno 1200 punti SQB.\n\nIl tuo punteggio attuale: **${punti}**\n\nSe hai domande o hai bisogno di aiuto, contatta lo staff!`;
                    await member.send(dmMessage);
                    successCount++;
                } catch (err) {
                    failedMembers.push(memberData.namediscord || memberData.iddiscord);
                }
            }

            let replyMessage = `📨 Reminder inviato a tutti i membri sotto i 1200 punti SQB.\n` +
                `✅ Messaggi inviati con successo: ${successCount}/${result.recordset.length}`;
            if (failedMembers.length > 0) {
                const failedList = failedMembers.length > 10
                    ? failedMembers.slice(0, 10).join(', ') + ` e altri ${failedMembers.length - 10} membri`
                    : failedMembers.join(', ');
                replyMessage += `\n❌ Non ho potuto inviare il messaggio a ${failedMembers.length} membri:\n${failedList}\n⚠️ Questo può accadere se i membri hanno i DM disabilitati o hanno bloccato il bot.`;
            }
            await message.reply(replyMessage);
        } catch (error) {
            console.error(`[ERROR] Errore durante il debug del comando +reminder: ${error.message}`);
            message.reply('Si è verificato un errore durante il debug del comando.');
        }
    },
};
