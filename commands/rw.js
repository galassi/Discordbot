module.exports = {
    name: 'rw',
    description: 'Invia un messaggio ai membri con specifici ruoli (raid warning)',

    async execute(message) {
        // Verifica che l'utente che ha invocato il comando sia il tuo ID
        const userIdToCheck = '195166332847652864'; // Sostituisci con il tuo ID
        if (message.author.id !== userIdToCheck) {
            return message.reply('Non hai i permessi per utilizzare questo comando!');
        }

        // Estrai il messaggio da inviare (dopo il comando /rw)
        const raidMessage = message.content.slice(4).trim();
        if (!raidMessage) {
            return message.reply('Per favore, inserisci un messaggio da inviare. Esempio: /rw Attenzione! Raid in corso!');
        }

        // Controlla la lunghezza del messaggio
        if (raidMessage.length > 2000) {
            return message.reply('Il messaggio è troppo lungo. Deve essere inferiore a 2000 caratteri.');
        }

        // Identifica i ruoli specifici
        const roleSkal = message.guild.roles.cache.find(role => role.name === '「⚔️」SKAL「⚔️」');
        const roleSkalNoSqb = message.guild.roles.cache.find(role => role.name === '「⚔️」SKAL NO SQB「⚔️」');

        if (!roleSkal && !roleSkalNoSqb) {
            return message.reply('I ruoli specificati non esistono nel server.');
        }

        try {
            // Recupera tutti i membri del server
            const members = await message.guild.members.fetch();
        
            let successCount = 0;
            let failedMembers = [];
            let totalTargetMembers = 0;
        
            // Usa un ciclo for...of per gestire l'iterazione asincrona
            for (const member of members.values()) {
                // Verifica se il membro ha uno dei ruoli specificati
                const hasSkalRole = member.roles.cache.has(roleSkal?.id);
                const hasSkalNoSqbRole = member.roles.cache.has(roleSkalNoSqb?.id);
        
                if (hasSkalRole || hasSkalNoSqbRole) {
                    totalTargetMembers++;
                    try {
                        // Invia il messaggio al membro
                        await member.send(`🚨 **AVVISO MEMBRI SKAL** 🚨\n\n${raidMessage}`);
                        successCount++;
                    } catch (err) {
                        console.error(`Errore nell'invio del messaggio a ${member.user.tag}:`, err);
                        failedMembers.push(member.user.tag);
                    }
                }
            }
        
            // Prepara il messaggio di risposta
            let replyMessage = '';
            
            if (totalTargetMembers === 0) {
                replyMessage = 'Non ho trovato membri con i ruoli SKAL da contattare.';
            } else {
                replyMessage = `📨 Risultato dell'invio:\n` +
                             `✅ Messaggi inviati con successo: ${successCount}/${totalTargetMembers}\n`;
                
                if (failedMembers.length > 0) {
                    const failedList = failedMembers.length > 10 
                        ? failedMembers.slice(0, 10).join(', ') + ` e altri ${failedMembers.length - 10} membri`
                        : failedMembers.join(', ');
                    
                    replyMessage += `❌ Non ho potuto inviare il messaggio a ${failedMembers.length} membri:\n` +
                                  `${failedList}\n` +
                                  `⚠️ Questo può accadere se i membri hanno i DM disabilitati o hanno bloccato il bot.`;
                }
            }
            
            await message.reply(replyMessage);
            
        } catch (err) {
            console.error('Errore nel recupero dei membri:', err);
            await message.reply('❌ Si è verificato un errore durante l\'esecuzione del comando. ' +
                              'Per favore, riprova più tardi o contatta un amministratore se il problema persiste.');
        }
    }
};
