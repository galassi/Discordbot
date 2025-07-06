// Funzione per formattare l'ora in modo leggibile
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// Funzione per controllare gli utenti che giocano a War Thunder
async function checkWarThunder(client) {
    console.log('Esecuzione della funzione checkWarThunder...');

    // Recupera il primo server
    const guild = client.guilds.cache.first();
    if (!guild) {
        console.error('Errore: Nessun server trovato.');
        return;
    }
    console.log(`Server trovato: ${guild.name}`);

    // Recupera l'utente da notificare              
    const userIdToNotify = '195166332847652864'; // Sostituisci con il tuo ID utente
    const userToNotify = await client.users.fetch(userIdToNotify).catch(error => {
        console.error('Errore nel recuperare l\'utente per notifiche:', error);
        return null;
    });

    // Recupera tutti i membri
    const members = await guild.members.fetch();
    console.log(`Membri totali nel server: ${members.size}`);

    members.forEach(member => {
        // Controlla se il membro ha il ruolo SKAL
        const roleSKAL = guild.roles.cache.find(role => role.name === '「⚔️」SKAL「⚔️」' || role.name === '「⚔️」SKAL NO SQB「⚔️」')
        if (!roleSKAL || !member.roles.cache.has(roleSKAL.id)) return;
    
        // Controlla se il membro ha una presenza valida
        if (!member.presence) return;
    
        // Recupera le attività
        const activities = member.presence.activities || [];
        const isPlayingWarThunder = activities.some(activity => activity.name === 'War Thunder' && activity.type === 0);
    
        if (isPlayingWarThunder) {
            if (!member.voice.channel) {
                const currentTime = formatTime(Date.now());
                console.log(`${member.user.username} sta giocando a War Thunder e non è in un canale vocale.`);
                if (userToNotify) {
                    userToNotify.send(`🎮 **${member.user.username}** sta giocando a War Thunder e non è in un canale vocale alle ${currentTime}.`);
                }
            }
        }
    });
}

// Imposta un timer per controllare ogni 30 minuti
function setupPeriodicCheck(client) {
    console.log('Configurazione del controllo periodico...');
    // checkWarThunder(client);
    setInterval(() => {
        console.log('Timer attivato. Esecuzione della funzione checkWarThunder...');
        checkWarThunder(client);
    }, 30 * 60 * 1000); // 30 minuti
}

// Esporta le funzioni per usarle nel file principale
module.exports = {
    setupPeriodicCheck
};
