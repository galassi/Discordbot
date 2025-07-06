// cd E:\programmi\BotDiscord
// node index.js


require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const ButtonHandler = require('./modules/ButtonHandler');

// Configure SQL Server connection
process.env.SQLSERVER_CONFIG = JSON.stringify({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        enableArithAbort: process.env.DB_ENABLE_ARITH_ABORT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
    }
});

// Initialize ButtonHandler
const buttonHandler = new ButtonHandler();

// Importa il modulo db.js per interagire con il database
const { checkAndInsertMembers } = require('./db'); // Importa le funzioni per gestire il database
const { setupPeriodicCheck } = require('./modules/presenceMonitor'); // Controllo periodico

// Mappa per tracciare lo stato vocale degli utenti
const userVoiceStates = new Map();

// Crea il client per il bot con gli intenti necessari
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,             // Intento per le informazioni sui server
        GatewayIntentBits.GuildMembers,      // Intento per i membri del server
        GatewayIntentBits.GuildPresences,    // Intento per monitorare le presenze
        GatewayIntentBits.GuildMessages,     // Intento per ricevere i messaggi
        GatewayIntentBits.MessageContent,    // Intento per leggere il contenuto dei messaggi
        GatewayIntentBits.GuildVoiceStates,  // Intento per rilevare cambiamenti nei canali vocali
    ],
});

client.commands = new Map();

// Carica i comandi dalla cartella 'commands'
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    try {
        client.commands.set(command.name, command);
    } catch (error) {
        console.error(`Errore nel caricamento del comando ${file}:`, error.message);
    }
}

// Log per mostrare i comandi caricati
// console.log('Comandi caricati:', [...client.commands.keys()]);

// Quando il bot è pronto, avvia il controllo periodico
client.once('ready', async () => {
    console.log('Bot è pronto!');
    console.log(`Guilds disponibili: ${client.guilds.cache.map(guild => guild.name).join(', ')}`);
    
    // Controlla e inserisce i membri
    await checkAndInsertMembers(client);
    // Togliere commento per attivare il controllo periodico
    // setupPeriodicCheck(client);
});

// Gestione dell'evento startNight per Lupus in Fabula
client.on('startNight', async (message) => {
    try {
        await buttonHandler.startNight(message);
    } catch (error) {
        console.error('Errore durante l\'avvio della fase notte:', error);
        message.channel.send('Si è verificato un errore durante l\'avvio della fase notte.');
    }
});

// Gestione dei cambiamenti nei canali vocali
client.on('voiceStateUpdate', (oldState, newState) => {
    const userId = newState.member.id;
    const userTag = newState.member.user.tag;

    if (oldState.channelId !== newState.channelId) {
        const oldChannel = oldState.channel ? oldState.channel.name : 'Nessun canale';
        const newChannel = newState.channel ? newState.channel.name : 'Nessun canale';

        //console.log(`${userTag} si è spostato da "${oldChannel}" a "${newChannel}"`);

        // Aggiorna la posizione nella mappa
        if (newState.channelId) {
            userVoiceStates.set(userId, newState.channel.name);
        } else {
            userVoiceStates.delete(userId);
        }
    }
});

// Quando il bot riceve un'interazione (per i bottoni)
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    
    try {
        await buttonHandler.handleButton(interaction);
    } catch (error) {
        console.error('Errore durante la gestione del bottone:', error);
        await interaction.reply({ 
            content: 'Si è verificato un errore durante l\'elaborazione dell\'azione.', 
            flags: ['Ephemeral']  // Updated to use flags instead of ephemeral
        });
    }
});

// Quando il bot riceve un messaggio
client.on('messageCreate', (message) => {

    if (message.author.bot) return;

    console.log(`Messaggio ricevuto: "${message.content}" da ${message.author.tag}`);

    // Controlla per ID canale, non per nome
    if (!process.env.BOT_COMANDI) {
        console.error('La variabile BOT_COMANDI non è definita nel .env!');
        return;
    }
    const botComandiId = String(process.env.BOT_COMANDI).replace(/'/g, "").trim();
    if (message.channel.id !== botComandiId) return;

    if (message.content.startsWith('+')) {
        const args = message.content.slice(1).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        console.log(`Comando rilevato: ${commandName}`);
        console.log(`Argomenti: ${args.join(' ')}`);

        if (client.commands.has(commandName)) {
            try {
                // Passa la mappa degli stati vocali al comando
                client.commands.get(commandName).execute(message, args, userVoiceStates);
            } catch (error) {
                console.error(`Errore nell'esecuzione del comando ${commandName}:`, error);
                message.reply('C\'è stato un errore durante l\'esecuzione del comando!');
            }
        } else {
            console.log(`Comando non riconosciuto: ${commandName}`);
            message.reply(`Comando non riconosciuto: ${commandName}`);
        }
    }
});

// Aggiungi questi handler prima di client.login
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

// Inserisci il token del tuo bot qui
client.login(process.env.BOT_TOKEN);