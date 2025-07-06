module.exports = {
    name: 'av',
    description: 'Assegna il ruolo di Aviatore',
    async execute(message) {
        const member = message.member;

        // Rimuovi i ruoli esistenti
        const rolesToRemove = [
            '「🚁」Pilota Elicottero「🚁」',
            '「🛡」Antiaerea「🛡」',
            '「🛡」Carrista「🛡」',
            '「🛡」Drone「🛡」'
        ];
        for (const roleName of rolesToRemove) {
            const role = message.guild.roles.cache.find(r => r.name === roleName);
            if (role) await member.roles.remove(role); // Rimuove il ruolo se esiste
        }

        // Assegna il ruolo "Aviatore"
        const role = message.guild.roles.cache.find(r => r.name === '「✈」Aviatore「✈」');
        if (role) {
            await member.roles.add(role); // Aggiunge il ruolo "Aviatore"
            message.reply('Hai ricevuto il ruolo di **Aviatore**!');
        } else {
            message.reply('Il ruolo **Aviatore** non è stato trovato!');
        }
    },
};
