module.exports = {
    name: 'aa',  // Nome del comando
    description: 'Assegna il ruolo di Antiaerea',  // Descrizione del comando
    async execute(message) {
        // Prendi il membro che ha scritto il comando
        const member = message.member;

        // Prendi tutti i ruoli da rimuovere
        const rolesToRemove = [
            '「🚁」Pilota Elicottero「🚁」',
            '「✈」Aviatore「✈」',
            '「🛡」Carrista「🛡」',
            '「🛡」Drone「🛡」',
            '「🛡」Antiaerea「🛡」' // Include lo stesso ruolo per evitare doppioni
        ];

        // Rimuovi i ruoli
        for (const roleName of rolesToRemove) {
            const role = message.guild.roles.cache.find(r => r.name === roleName);
            if (role) await member.roles.remove(role); // Rimuove il ruolo se esiste
        }

        // Aggiungi il ruolo "Antiaerea"
        const role = message.guild.roles.cache.find(r => r.name === '「🛡」Antiaerea「🛡」');
        if (role) {
            await member.roles.add(role); // Aggiunge il ruolo "Antiaerea"
            message.reply('Hai ricevuto il ruolo di **Antiaerea**!');
        } else {
            message.reply('Il ruolo **Antiaerea** non è stato trovato!');
        }
    },
};
