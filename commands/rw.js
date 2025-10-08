module.exports = {
    name: 'rw',
    description: 'Invia un messaggio ai membri con specifici ruoli (raid warning)',

    async execute(message) {
        // Permetti solo agli utenti con un certo ruolo di usare il comando
        const requiredRoleId = '1391057660844970004';
        const member = await message.guild.members.fetch(message.author.id);
        if (!member.roles.cache.has(requiredRoleId)) {
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

        // Identifica i ruoli specifici IRIX e IRIX2
        const roleIrix = message.guild.roles.cache.find(role => role.name === '「🟦」IRIX「🟦」');
        const roleIrix2 = message.guild.roles.cache.find(role => role.name === '「🟪」IRIX 2「🟪」');

        if (!roleIrix && !roleIrix2) {
            return message.reply('I ruoli IRIX o IRIX2 non esistono nel server.');
        }

        try {
            // Recupera tutti i membri del server
            const members = await message.guild.members.fetch();
        
            let successCount = 0;
            let failedMembers = [];
            let totalTargetMembers = 0;
        
            // Usa un ciclo for...of per gestire l'iterazione asincrona
            for (const member of members.values()) {
                // Verifica se il membro ha uno dei ruoli IRIX o IRIX2
                const hasIrixRole = member.roles.cache.has(roleIrix?.id);
                const hasIrix2Role = member.roles.cache.has(roleIrix2?.id);

                if (hasIrixRole || hasIrix2Role) {
                    totalTargetMembers++;
                    try {
                        // Invia il messaggio al membro
                        await member.send(`🚨 **AVVISO MEMBRI IRIX** 🚨\n\n${raidMessage}`);
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
                replyMessage = 'Non ho trovato membri con i ruoli IRIX o IRIX2 da contattare.';
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
