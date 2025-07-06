module.exports = {
    name: 'el',
    description: 'Assegna il ruolo di Pilota Elicottero',
    async execute(message) {
        const member = message.member;

        // Rimuovi i ruoli esistenti
        const rolesToRemove = [
            '「🛡」Antiaerea「🛡」',
            '「🛡」Carrista「🛡」',
            '「✈」Aviatore「✈」',
            '「🛡」Drone「🛡」'
        ];
        for (const roleName of rolesToRemove) {
            const role = message.guild.roles.cache.find(r => r.name === roleName);
            if (role) await member.roles.remove(role); // Rimuove il ruolo se esiste
        }

        // Assegna il ruolo "Pilota Elicottero"
        const role = message.guild.roles.cache.find(r => r.name === '「🚁」Pilota Elicottero「🚁」');
        if (role) {
            await member.roles.add(role); // Aggiunge il ruolo "Pilota Elicottero"
            message.reply('Hai ricevuto il ruolo di **Pilota Elicottero**!');
        } else {
            message.reply('Il ruolo **Pilota Elicottero** non è stato trovato!');
        }
    },
};
