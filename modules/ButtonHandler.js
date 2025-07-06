const { getRuoloGiocatore, eliminaGiocatore, getGiocatoriVivi, checkGameOver, cambiaFase, svuotaGioco } = require('./minigameDB');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

class ButtonHandler {
    constructor() {
        this.votes = new Map();
        this.lupiVotes = new Map();
        this.guardiaVote = null;
        this.veggenteUsed = false;
        this.botCommandsChannel = null;
        this.lastEliminatedPlayer = null;
        this.lastEliminatedRole = null;
        this.gufoVote = null;
        this.nightNumber = 1;
        this.dayPhaseStarted = false; // Nuovo flag per tracciare se la fase giorno è già iniziata
    }

    // Helper method to get or find bot-comandi channel
    async getBotCommandsChannel(message) {
        if (!this.botCommandsChannel) {
            this.botCommandsChannel = message.guild.channels.cache.find(ch => ch.name === 'bot-comandi');
        }
        return this.botCommandsChannel;
    }

    async handleButton(interaction) {
        const customId = interaction.customId;

        if (customId === 'startDay') {
            await this.handleStartDay(interaction);
        } else if (customId.startsWith('vote_')) {
            await this.handleVote(interaction);
        } else if (customId.startsWith('lupo_')) {
            await this.handleLupoVote(interaction);
        } else if (customId.startsWith('veggente_')) {
            await this.handleVeggenteAction(interaction);
        } else if (customId === 'medium_check') {
            await this.handleMediumAction(interaction);
        } else if (customId.startsWith('guardia_')) {
            await this.handleGuardiaVote(interaction);
        } else if (customId.startsWith('gufo_')) {
            await this.handleGufoVote(interaction);
        }
    }

    async handleStartDay(interaction) {
        if (!await this.isGameMaster(interaction.user.id)) {
            return interaction.reply({ 
                content: 'Solo il game master può far iniziare il giorno', 
                flags: ['Ephemeral']
            });
        }

        // Reset votes for new day
        this.votes.clear();
        this.veggenteUsed = false;

        const giocatoriVivi = await getGiocatoriVivi();
        const botCommandsChannel = await this.getBotCommandsChannel(interaction.message);
        
        // Announce day phase in bot-comandi
        if (botCommandsChannel) {
            await botCommandsChannel.send('☀️ **È iniziata la fase GIORNO!** Discutete e votate chi sospettate!');
        }

        await interaction.message.edit({ components: [] }); // Remove buttons
        await this.startDay(interaction.message);
    }

    async handleVote(interaction) {
        const voterId = interaction.user.id;
        const targetId = interaction.customId.split('_')[1];

        const voter = await getRuoloGiocatore(voterId);
        if (!voter || voter.stato !== 'vivo') {
            return interaction.reply({ 
                content: '🚫 Solo i giocatori vivi possono votare!', 
                flags: ['Ephemeral']
            });
        }

        if (this.votes.has(voterId)) {
            return interaction.reply({ 
                content: '❌ Hai già votato! Non puoi cambiare il tuo voto.', 
                flags: ['Ephemeral']
            });
        }

        const target = await getRuoloGiocatore(targetId);
        this.votes.set(voterId, targetId);

        // Log when a player votes without revealing their choice
        console.log(`[VOTE] ${voter.username} ha votato`);

        await interaction.reply({ 
            content: `✅ Hai votato per eliminare **${target.username}**. Il tuo voto è stato registrato.`, 
            flags: ['Ephemeral']
        });

        // Check if everyone has voted
        const vivi = await getGiocatoriVivi();
        // Log remaining players who haven't voted
        const nonVotanti = vivi.filter(p => !this.votes.has(p.iddiscord));
        console.log(`[VOTE] Mancano ancora ${nonVotanti.length} voti`);

        if (this.votes.size === vivi.length) {
            await this.concludeVoting(interaction.message);
        }
    }

    async handleLupoVote(interaction) {
        const voterId = interaction.user.id;
        const targetId = interaction.customId.split('lupo_')[1];

        const voter = await getRuoloGiocatore(voterId);
        if (!voter || voter.ruoli !== 'lupo') {
            return interaction.reply({ 
                content: '🚫 Solo i lupi mannari possono scegliere una vittima durante la notte!', 
                flags: ['Ephemeral']
            });
        }

        // Controlla se c'è già un voto da un altro lupo
        const altriVotiLupi = Array.from(this.lupiVotes.entries())
            .filter(([id, _]) => id !== voterId);

        if (altriVotiLupi.length > 0) {
            const altroVoto = altriVotiLupi[0][1];
            if (altroVoto !== targetId) {
                return interaction.reply({ 
                    content: '🐺 I lupi devono essere d\'accordo sulla vittima! Un altro lupo ha scelto una vittima diversa.',
                    flags: ['Ephemeral']
                });
            }
        }

        this.lupiVotes.set(voterId, targetId);
        const targetPlayer = await interaction.message.guild.members.fetch(targetId).catch(() => null);
        await interaction.reply({ 
            content: `🐺 Hai scelto di attaccare **${targetPlayer?.displayName || 'il giocatore'}** questa notte. Aspetta che anche l'altro lupo confermi la scelta...`, 
            flags: ['Ephemeral']
        });

        // Check if all wolves have voted
        const lupi = (await getGiocatoriVivi()).filter(p => p.ruoli === 'lupo');
        if (this.lupiVotes.size === lupi.length) {
            await this.concludeLupiVoting(interaction.message);
        }
    }

    async handleVeggenteAction(interaction) {
        const veggente = interaction.user.id;
        const targetId = interaction.customId.split('veggente_')[1];

        const player = await getRuoloGiocatore(veggente);
        if (!player || player.ruoli !== 'veggente' || player.stato !== 'vivo') {
            return interaction.reply({ 
                content: '🚫 Solo il veggente vivo può investigare gli altri giocatori!', 
                flags: ['Ephemeral']
            });
        }

        if (this.veggenteUsed) {
            return interaction.reply({ 
                content: '🔮 Hai già usato il tuo potere questa notte! Dovrai aspettare la prossima.', 
                flags: ['Ephemeral']
            });
        }

        const target = await getRuoloGiocatore(targetId);
        this.veggenteUsed = true;

        let responseMessage;
        if (target.ruoli === 'lupo') {
            responseMessage = `🔮 Le tue visioni rivelano che **${target.username}** è un **Lupo Mannaro**! Usa questa informazione con saggezza...`;
        } else {
            responseMessage = `🔮 Le tue visioni rivelano che **${target.username}** non è un lupo mannaro.`;
        }

        await interaction.reply({ 
            content: responseMessage,
            flags: ['Ephemeral']
        });
    }

    async handleMediumAction(interaction) {
        const mediumId = interaction.user.id;
        const player = await getRuoloGiocatore(mediumId);
        
        if (!player || player.ruoli !== 'medium' || player.stato !== 'vivo') {
            return interaction.reply({ 
                content: '🚫 Solo il medium vivo può comunicare con i morti!', 
                flags: ['Ephemeral']
            });
        }

        if (!this.lastEliminatedPlayer || !this.lastEliminatedRole) {
            return interaction.reply({ 
                content: '👻 Non ci sono ancora spiriti con cui comunicare... Nessun giocatore è stato eliminato finora.',
                flags: ['Ephemeral']
            });
        }

        let responseMessage;
        if (this.lastEliminatedRole === 'lupo') {
            responseMessage = `👻 Gli spiriti ti rivelano che **${this.lastEliminatedPlayer}** era un **Lupo Mannaro**!`;
        } else {
            responseMessage = `👻 Gli spiriti ti rivelano che **${this.lastEliminatedPlayer}** non era un lupo mannaro.`;
        }

        await interaction.reply({ 
            content: responseMessage,
            flags: ['Ephemeral']
        });
    }

    async handleGuardiaVote(interaction) {
        const guardiaId = interaction.user.id;
        const targetId = interaction.customId.split('guardia_')[1];

        const player = await getRuoloGiocatore(guardiaId);
        if (!player || player.ruoli !== 'guardia' || player.stato !== 'vivo') {
            return interaction.reply({ 
                content: '🚫 Solo la Guardia del Corpo viva può proteggere gli altri giocatori!', 
                flags: ['Ephemeral']
            });
        }

        if (targetId === guardiaId) {
            return interaction.reply({ 
                content: '🛡️ Non puoi proteggere te stesso! Scegli un altro giocatore da proteggere.', 
                flags: ['Ephemeral']
            });
        }

        const target = await getRuoloGiocatore(targetId);
        this.guardiaVote = targetId;
        await interaction.reply({ 
            content: `🛡️ Hai deciso di proteggere **${target.username}** questa notte. Farai del tuo meglio per impedire ai lupi di ucciderlo!`, 
            flags: ['Ephemeral']
        });
    }

    async handleGufoVote(interaction) {
        const gufoId = interaction.user.id;
        const targetId = interaction.customId.split('gufo_')[1];

        const player = await getRuoloGiocatore(gufoId);
        if (!player || player.ruoli !== 'gufo' || player.stato !== 'vivo') {
            return interaction.reply({ 
                content: '🚫 Solo il Gufo vivo può scegliere un giocatore da gufare!', 
                flags: ['Ephemeral']
            });
        }

        const target = await getRuoloGiocatore(targetId);
        this.gufoVote = targetId;
        await interaction.reply({ 
            content: `🦉 Hai scelto di gufare **${target.username}** questa notte.`, 
            flags: ['Ephemeral']
        });
    }

    async startNight(message) {
        // Reset del flag quando inizia la notte
        this.dayPhaseStarted = false;
        await cambiaFase('notte');
        this.veggenteUsed = false;
        this.guardiaVote = null;
        this.gufoVote = null;
        const giocatoriVivi = await getGiocatoriVivi();
        
        const botCommandsChannel = await this.getBotCommandsChannel(message);
        if (botCommandsChannel) {
            await botCommandsChannel.send('🌙 **È iniziata la fase NOTTE!**');
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🌙 È notte nel villaggio')
            .setDescription('I lupi stanno decidendo chi uccidere...')
            .setColor('#000033');

        await message.channel.send({ embeds: [embed] });

        // Dividi i bottoni in messaggi separati per tipo
        // 1. Bottoni per i lupi
        const lupiButtons = giocatoriVivi.map(player => 
            new ButtonBuilder()
                .setCustomId(`lupo_${player.iddiscord}`)
                .setLabel(`🔴 ${player.username}`)
                .setStyle(ButtonStyle.Secondary)
        );

        if (lupiButtons.length > 0) {
            const lupiEmbed = new EmbedBuilder()
                .setDescription('🐺 **Lupi Mannari**: Scegliete la vostra vittima')
                .setColor('#ff0000');

            const lupiRows = [];
            for (let i = 0; i < lupiButtons.length; i += 5) {
                lupiRows.push(
                    new ActionRowBuilder()
                        .addComponents(lupiButtons.slice(i, Math.min(i + 5, lupiButtons.length)))
                );
            }
            await message.channel.send({ embeds: [lupiEmbed], components: lupiRows });
        }

        // 2. Bottoni per la guardia
        const guardiaButtons = giocatoriVivi.map(player => 
            new ButtonBuilder()
                .setCustomId(`guardia_${player.iddiscord}`)
                .setLabel(`🛡️ ${player.username}`)
                .setStyle(ButtonStyle.Secondary)
        );

        if (guardiaButtons.length > 0) {
            const guardiaEmbed = new EmbedBuilder()
                .setDescription('🛡️ **Guardia del Corpo**: Scegli chi proteggere')
                .setColor('#0000ff');

            const guardiaRows = [];
            for (let i = 0; i < guardiaButtons.length; i += 5) {
                guardiaRows.push(
                    new ActionRowBuilder()
                        .addComponents(guardiaButtons.slice(i, Math.min(i + 5, guardiaButtons.length)))
                );
            }
            await message.channel.send({ embeds: [guardiaEmbed], components: guardiaRows });
        }

        // 3. Bottoni per il veggente
        const veggenteButtons = giocatoriVivi.map(player => 
            new ButtonBuilder()
                .setCustomId(`veggente_${player.iddiscord}`)
                .setLabel(`🔵 ${player.username}`)
                .setStyle(ButtonStyle.Secondary)
        );

        if (veggenteButtons.length > 0) {
            const veggenteEmbed = new EmbedBuilder()
                .setDescription('🔮 **Veggente**: Scegli chi investigare')
                .setColor('#4b0082');

            const veggenteRows = [];
            for (let i = 0; i < veggenteButtons.length; i += 5) {
                veggenteRows.push(
                    new ActionRowBuilder()
                        .addComponents(veggenteButtons.slice(i, Math.min(i + 5, veggenteButtons.length)))
                );
            }
            await message.channel.send({ embeds: [veggenteEmbed], components: veggenteRows });
        }

        // 4. Bottone per il medium
        if (this.lastEliminatedPlayer) {
            const mediumEmbed = new EmbedBuilder()
                .setDescription('👻 **Medium**: Puoi contattare i morti')
                .setColor('#800080');

            const mediumRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('medium_check')
                        .setLabel('👻 Contatta i morti')
                        .setStyle(ButtonStyle.Secondary)
                );

            await message.channel.send({ embeds: [mediumEmbed], components: [mediumRow] });
        }

        // 5. Bottoni per il gufo
        const gufoButtons = giocatoriVivi.map(player => 
            new ButtonBuilder()
                .setCustomId(`gufo_${player.iddiscord}`)
                .setLabel(`🦉 ${player.username}`)
                .setStyle(ButtonStyle.Secondary)
        );

        if (gufoButtons.length > 0) {
            const gufoEmbed = new EmbedBuilder()
                .setDescription('🦉 **Gufo**: Scegli chi gufare')
                .setColor('#8B4513');

            const gufoRows = [];
            for (let i = 0; i < gufoButtons.length; i += 5) {
                gufoRows.push(
                    new ActionRowBuilder()
                        .addComponents(gufoButtons.slice(i, Math.min(i + 5, gufoButtons.length)))
                );
            }
            await message.channel.send({ embeds: [gufoEmbed], components: gufoRows });
        }
    }

    async startDay(message) {
        // Previeni l'avvio multiplo della fase giorno
        if (this.dayPhaseStarted) {
            return;
        }
        this.dayPhaseStarted = true;

        await cambiaFase('giorno');
        const giocatoriVivi = await getGiocatoriVivi();

        const embed = new EmbedBuilder()
            .setTitle('☀️ È giorno nel villaggio')
            .setDescription('Discutete e votate chi sospettate sia un lupo!')
            .setColor('#ffff00');

        await message.channel.send({ embeds: [embed] });

        // Dividi i bottoni in più messaggi se necessario
        const buttons = giocatoriVivi.map(player => 
            new ButtonBuilder()
                .setCustomId(`vote_${player.iddiscord}`)
                .setLabel(player.username)
                .setStyle(ButtonStyle.Secondary)
        );

        // Invia i bottoni in gruppi di 25 (5 righe da 5)
        for (let i = 0; i < buttons.length; i += 25) {
            const buttonGroup = buttons.slice(i, i + 25);
            const rows = [];
            
            for (let j = 0; j < buttonGroup.length; j += 5) {
                rows.push(
                    new ActionRowBuilder()
                        .addComponents(buttonGroup.slice(j, Math.min(j + 5, buttonGroup.length)))
                );
            }

            const groupEmbed = new EmbedBuilder()
                .setDescription(`Votazione (${i/25 + 1}/${Math.ceil(buttons.length/25)})`)
                .setColor('#ffff00');

            await message.channel.send({ embeds: [groupEmbed], components: rows });
        }
    }

    async getWinnerNames(winningTeam) {
        const giocatoriVivi = await getGiocatoriVivi();
        const vincitori = giocatoriVivi.filter(p => 
            (winningTeam === 'lupi' && (p.ruoli === 'lupo' || p.ruoli === 'indemoniato')) ||
            (winningTeam === 'villaggio' && p.ruoli !== 'lupo' && p.ruoli !== 'indemoniato')
        );
        return vincitori.map(p => `**${p.username}**`).join(', ');
    }

    async concludeVoting(message) {
        console.log(`[DEBUG] Inizio conteggio voti`);
        // Count votes
        const voteCount = new Map();
        for (const [voterId, targetId] of this.votes.entries()) {
            const voter = await message.guild.members.fetch(voterId).catch(() => null);
            const target = await message.guild.members.fetch(targetId).catch(() => null);
            console.log(`[DEBUG] Voto da ${voter?.user.username || voterId} per ${target?.user.username || targetId}`);
            voteCount.set(targetId, (voteCount.get(targetId) || 0) + 1);
        }

        console.log(`[DEBUG] Riepilogo voti:`);
        for (const [targetId, count] of voteCount.entries()) {
            const target = await message.guild.members.fetch(targetId).catch(() => null);
            console.log(`[DEBUG] ${target?.user.username || targetId}: ${count} voti`);
        }

        const botCommandsChannel = await this.getBotCommandsChannel(message);

        // Find players with most votes
        let maxVotes = 0;
        let topVoted = [];
        for (const [targetId, count] of voteCount.entries()) {
            if (count > maxVotes) {
                maxVotes = count;
                topVoted = [targetId];
            } else if (count === maxVotes) {
                topVoted.push(targetId);
            }
        }

        console.log(`[DEBUG] Numero massimo di voti: ${maxVotes}`);
        console.log(`[DEBUG] Giocatori più votati: ${topVoted.join(', ')}`);

        // After counting regular votes, check for Gufo's vote
        if (this.gufoVote) {
            const gufatoPlayer = await getRuoloGiocatore(this.gufoVote);
            
            if (botCommandsChannel) {
                await botCommandsChannel.send(`🦉 Il Gufo ha scelto **${gufatoPlayer.username}**!`);
            }

            // If the gufato player wasn't already in topVoted, add them
            if (!topVoted.includes(this.gufoVote)) {
                topVoted.push(this.gufoVote);
            }
        }

        if (topVoted.length > 1) {
            if (botCommandsChannel) {
                await botCommandsChannel.send('🎯 **C\'è un pareggio!** Si deve rivotare tra:');
            }
            
            // Crea nuovi bottoni solo per i giocatori in pareggio
            const buttons = [];
            for (const targetId of topVoted) {
                const player = await getRuoloGiocatore(targetId);
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`vote_${targetId}`)
                        .setLabel(player.username)
                        .setStyle(ButtonStyle.Secondary)
                );
            }

            const row = new ActionRowBuilder().addComponents(buttons);
            if (botCommandsChannel) {
                await botCommandsChannel.send({ 
                    content: 'Votate di nuovo tra questi giocatori:',
                    components: [row] 
                });
            }

            // Reset votes for new voting round
            this.votes.clear();
        } else if (topVoted.length === 1) {
            const eliminated = topVoted[0];
            await eliminaGiocatore(eliminated);
            const eliminatedPlayer = await getRuoloGiocatore(eliminated);
            
            // Salva le informazioni del giocatore eliminato per il medium
            this.lastEliminatedPlayer = eliminatedPlayer.username;
            this.lastEliminatedRole = eliminatedPlayer.ruoli;
            
            if (botCommandsChannel) {
                await botCommandsChannel.send(`🌅 Il villaggio ha eliminato **${eliminatedPlayer.username}**!`);
            }

            // Check win condition
            const result = await checkGameOver();
            if (result) {
                const winnersNames = await this.getWinnerNames(result);
                if (botCommandsChannel) {
                    await botCommandsChannel.send(`🎮 **Game Over!** ${result === 'lupi' ? 'I Lupi' : 'Il Villaggio'} ha vinto!\nI vincitori sono: ${winnersNames}`);
                }
                return;
            }

            // Start next night
            this.votes.clear();
            await this.startNight(message);
        }
    }

    async concludeLupiVoting(message) {
        const targetId = this.lupiVotes.values().next().value;
        const botCommandsChannel = await this.getBotCommandsChannel(message);

        // Check if the target was protected by the Guardia
        if (this.guardiaVote === targetId) {
            if (botCommandsChannel) {
                await botCommandsChannel.send(`🌙 Durante la notte, i lupi hanno cercato di attaccare qualcuno, ma la guardia del corpo ha protetto la vittima!`);
            }
        } else {
            await eliminaGiocatore(targetId);
            const eliminatedPlayer = await getRuoloGiocatore(targetId);
            
            if (botCommandsChannel) {
                await botCommandsChannel.send(`🌙 Durante la notte, i lupi hanno ucciso **${eliminatedPlayer.username}**!`);
            }
        }

        // Check win condition
        const result = await checkGameOver();
        if (result) {
            const winnersNames = await this.getWinnerNames(result);
            if (botCommandsChannel) {
                await botCommandsChannel.send(`🎮 **Game Over!** ${result === 'lupi' ? 'I Lupi' : 'Il Villaggio'} ha vinto!\nI vincitori sono: ${winnersNames}`);
            }
            return;
        }

        // Increment night number for the next night
        this.nightNumber++;

        // Start next day
        this.lupiVotes.clear();
        await this.startDay(message);
    }

    async isGameMaster(userId) {
        // You can implement your own game master logic here
        return true; // For now, allow anyone to progress the game
    }
}

module.exports = ButtonHandler;