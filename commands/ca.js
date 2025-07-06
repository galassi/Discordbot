module.exports = {
    name: 'ca',
    description: 'Assegna il ruolo di Carrista',
    async execute(message) {
        const member = message.member;

        // Rimuovi i ruoli esistenti
        const rolesToRemove = [
            '「🚁」Pilota Elicottero「🚁」',
            '「✈」Aviatore「✈」',
            '「🛡」Antiaerea「🛡」',
            '「🛡」Drone「🛡」'
        ];
        for (const roleName of rolesToRemove) {
            const role = message.guild.roles.cache.find(r => r.name === roleName);
            if (role) await member.roles.remove(role); // Rimuove il ruolo se esiste
        }

        // Assegna il ruolo "Carrista"
        const role = message.guild.roles.cache.find(r => r.name === '「🛡」Carrista「🛡」');
        if (role) {
            await member.roles.add(role); // Aggiunge il ruolo "Carrista"
            message.reply('Hai ricevuto il ruolo di **Carrista**!');
        } else {
            message.reply('Il ruolo **Carrista** non è stato trovato!');
        }
    },
};
