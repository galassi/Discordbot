const { EmbedBuilder } = require('discord.js');
const {
    inserisciGiocatori,
    getRuoloGiocatore,
    getGiocatoriVivi,
    svuotaGioco
} = require('../modules/minigameDB');

module.exports = {
    name: 'lupus',
    description: 'Avvia una partita di Lupus in Fabula',
    async execute(message, args) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('Devi essere in un canale vocale per avviare il gioco.');
        }

        const members = voiceChannel.members;
        if (members.size < 8) {
            return message.reply('Servono almeno 8 persone per iniziare.');
        }

        // Test DM permissions before starting the game
        const cannotDMUsers = [];
        for (const [memberId, member] of members) {
            try {
                const testEmbed = new EmbedBuilder()
                    .setTitle('Test messaggio')
                    .setDescription('Verifica permessi DM per Lupus in Fabula');
                await member.send({ embeds: [testEmbed] });
            } catch (error) {
                if (error.code === 50007) {
                    cannotDMUsers.push(member.user.tag);
                }
            }
        }

        if (cannotDMUsers.length > 0) {
            return message.reply(`Non posso iniziare il gioco perché i seguenti giocatori hanno i DM bloccati:\n${cannotDMUsers.join('\n')}\n\nPer giocare, questi giocatori devono abilitare i messaggi diretti nelle loro impostazioni privacy di Discord (click destro sul server → Impostazioni Privacy → Messaggi Diretti).`);
        }

        try {
            // Inizializza il gioco
            await svuotaGioco();
            await inserisciGiocatori(members);

            // Invia il messaggio iniziale
            const embed = new EmbedBuilder()
                .setTitle('🐺 Lupus in Fabula')
                .setDescription('La partita è iniziata! Ho inviato a tutti i giocatori il loro ruolo in privato.')
                .addFields(
                    { name: 'Giocatori', value: `${members.size} giocatori partecipanti` },
                    { name: 'Ruoli', value: members.size >= 12 ?
                        '- 4 Umani\n- 2 Lupi\n- 1 Veggente\n- 1 Medium\n- 1 Indemoniato\n- 1 Guardia del corpo\n- 1 Gufo' :
                        members.size >= 11 ?
                        '- 5 Umani\n- 2 Lupi\n- 1 Veggente\n- 1 Medium\n- 1 Indemoniato\n- 1 Guardia del corpo' :
                        members.size >= 10 ?
                        '- 5 Umani\n- 2 Lupi\n- 1 Veggente\n- 1 Medium\n- 1 Indemoniato' :
                        members.size >= 9 ?
                        '- 5 Umani\n- 2 Lupi\n- 1 Veggente\n- 1 Medium' :
                        '- 5 Umani\n- 2 Lupi\n- 1 Veggente' }
                )
                .setColor('#ff0000')
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

            // Invia i ruoli in privato
            const failedDMs = [];
            for (const [memberId, member] of members) {
                const ruolo = await getRuoloGiocatore(memberId);
                if (ruolo) {
                    const roleEmbed = new EmbedBuilder()
                        .setTitle('🎭 Il tuo ruolo')
                        .setColor(ruolo.ruoli === 'lupo' ? '#ff0000' : ruolo.ruoli === 'veggente' ? '#4b0082' : ruolo.ruoli === 'medium' ? '#800080' : ruolo.ruoli === 'guardia' ? '#0000ff' : ruolo.ruoli === 'gufo' ? '#ffa500' : '#008000');
                    
                    switch (ruolo.ruoli) {
                        case 'lupo':
                            roleEmbed.setDescription('🐺 Sei un **Lupo Mannaro**!\n\n' +
                                'Il tuo obiettivo è eliminare tutti gli umani insieme all\'altro lupo.\n' +
                                'Durante la notte potrai votare chi uccidere.\n\n' +
                                '**Devi restare in silenzio durante la notte!**');
                            // Trova e comunica chi è l'altro lupo
                            const altriLupi = (await getGiocatoriVivi())
                                .filter(p => p.ruoli === 'lupo' && p.iddiscord !== memberId)
                                .map(p => p.username);
                            if (altriLupi.length > 0) {
                                roleEmbed.addFields({ 
                                    name: 'Il tuo compagno lupo è:', 
                                    value: altriLupi.join(', ') 
                                });
                            }
                            break;
                        case 'veggente':
                            roleEmbed.setDescription('🔮 Sei il **Veggente**!\n\n' +
                                'Ogni notte potrai scoprire se un giocatore è un Lupo Mannaro oppure no.\n' +
                                'Usa questa informazione per aiutare il villaggio, ma fai attenzione a non rivelare troppo presto la tua identità!\n\n' +
                                '**Devi restare in silenzio durante la notte!**');
                            break;
                        case 'medium':
                            roleEmbed.setDescription('👻 Sei il **Medium**!\n\n' +
                                'Ogni notte potrai scoprire se l\'ultimo giocatore eliminato durante il giorno era un lupo mannaro o no.\n' +
                                'Usa questa informazione per aiutare il villaggio, ma fai attenzione a non rivelare troppo presto la tua identità!\n\n' +
                                '**Devi restare in silenzio durante la notte!**');
                            break;
                        case 'guardia':
                            roleEmbed.setDescription('🛡️ Sei la **Guardia del Corpo**!\n\n' +
                                'Ogni notte puoi proteggere un altro giocatore dall\'attacco dei lupi mannari.\n' +
                                'Se i lupi attaccano il giocatore che hai protetto, non morirà.\n' +
                                'Non puoi mai proteggere te stesso!\n\n' +
                                '**Devi restare in silenzio durante la notte!**');
                            break;
                        case 'umano':
                            roleEmbed.setDescription('👨‍🌾 Sei un **Umano**!\n\n' +
                                'Devi collaborare con gli altri umani per scoprire chi sono i lupi mannari.\n' +
                                'Durante il giorno, discuti con gli altri e vota chi sospetti.\n\n' +
                                '**Devi restare in silenzio durante la notte!**');
                            break;
                        case 'indemoniato':
                            roleEmbed.setDescription('😈 Sei l\'**Indemoniato**!\n\n' +
                                'Sei un umano posseduto che parteggia per i lupi mannari.\n' +
                                'Vinci se vincono i lupi, ma non sai chi sono!\n' +
                                'Cerca di confondere il villaggio e aiutare i lupi senza farti scoprire.\n\n' +
                                '**Devi restare in silenzio durante la notte!**');
                            break;
                        case 'gufo':
                            roleEmbed.setDescription('🦉 Sei il **Gufo**!\n\n' +
                                'Sei un umano che può influenzare le votazioni del villaggio.\n' +
                                'Durante la notte scegli un giocatore da "gufare".\n' +
                                'Dopo le votazioni del giorno, il giocatore che hai gufato entrerà di diritto tra gli indiziati.\n' +
                                'Se il giocatore gufato era già tra gli indiziati, il tuo potere non avrà effetto.\n\n' +
                                '**Devi restare in silenzio durante la notte!**');
                            break;
                    }
                    
                    try {
                        await member.send({ embeds: [roleEmbed] });
                    } catch (dmError) {
                        if (dmError.code === 50007) {
                            failedDMs.push(member.user.tag);
                        }
                    }
                }
            }

            if (failedDMs.length > 0) {
                await svuotaGioco(); // Pulisci il gioco se ci sono errori
                return message.reply(`Il gioco è stato annullato perché non ho potuto inviare i ruoli ai seguenti giocatori:\n${failedDMs.join('\n')}\n\nPer giocare, questi giocatori devono abilitare i messaggi diretti nelle loro impostazioni privacy di Discord.`);
            }

            // Inizia la prima notte usando il ButtonHandler tramite l'evento message
            message.client.emit('startNight', message);

        } catch (error) {
            console.error('Errore durante l\'avvio del gioco:', error);
            message.reply('Si è verificato un errore durante l\'avvio del gioco.');
            await svuotaGioco(); // Pulisci il gioco in caso di errori
        }
    }
};
