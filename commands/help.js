module.exports = {
    // Nome del comando
    name: 'help',
    // Descrizione del comando
    description: 'Invia un messaggio privato con la lista dei comandi disponibili',

    // Funzione che verrà eseguita quando il comando viene invocato
    execute(message) {
        // Costruisci il messaggio di aiuto
        const helpMessage = `
        Ecco i comandi disponibili:
         +help: Mostra questa lista di comandi
         +aa: antiaerea
         +av: aviazione
         +ca: carrista
         +el: elicotterista
         +rc: ricognitore
         +rw: [messaggio] invia il messaggio a tutti 「⚔️」SKAL「⚔️」 e 「⚔️」SKAL NO SQB「⚔️」
         +sqbpoint: lista membri nel tuo canale e i loro punti SQB
         +lupus: avvia una partita di Lupus in Fabula
         +resetlupus: resetta la partita di Lupus in Fabula
         +m!p + link youtube playlist
        `;
        
        // Invia il messaggio di aiuto in privato all'utente
        message.author.send(helpMessage)
            .then(() => {
                message.channel.send('Ti ho inviato i comandi in privato!');
            })
            .catch(error => {
                console.error('Errore nell\'invio del messaggio privato:', error);
                message.channel.send('Non riesco a inviarti i comandi in privato. Assicurati di accettare i messaggi da tutti.');
            });
    }
};