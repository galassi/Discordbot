module.exports = {
    name: 'rc',
    description: 'Assegna il ruolo di Ricognitore',
    async execute(message) {
        const member = message.member;

        // Rimuovi i ruoli esistenti
        const rolesToRemove = [
            '「🛡」Antiaerea「🛡」',
            '「🛡」Carrista「🛡」',
            '「✈」Aviatore「✈」',
            '「🚁」Pilota Elicottero「🚁」'
        ];
        for (const roleName of rolesToRemove) {
            const role = message.guild.roles.cache.find(r => r.name === roleName);
            if (role) {
                await member.roles.remove(role); // Rimuove il ruolo se esiste
            }
        }

        // Assegna il ruolo "Ricognitore"
        const role = message.guild.roles.cache.find(r => r.name === '「🛡」Drone「🛡」');
        if (role) {
            await member.roles.add(role); // Aggiunge il ruolo "Ricognitore"
            message.reply('Hai ricevuto il ruolo di **Drone**!');
        } else {
            message.reply('Il ruolo **Drone** non è stato trovato!');
        }
    },
};
