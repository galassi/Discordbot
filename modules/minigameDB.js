const sql = require('mssql');

// Function to initialize the database
async function initializeDatabase() {
    const pool = await sql.connect(process.env.SQLSERVER_CONFIG);
    try {
        // La tabella e la colonna esistono già, non serve nessun controllo
    } catch (err) {
        console.error('Error initializing database:', err);
        throw err;
    }
}

// Funzione per mescolare un array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Funzione per inserire i giocatori e assegnare loro i ruoli
async function inserisciGiocatori(members) {
    await initializeDatabase(); // Initialize database before inserting players
    const pool = await sql.connect(process.env.SQLSERVER_CONFIG);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const request = new sql.Request(transaction);

        // Ruoli da assegnare in base al numero di giocatori
        let ruoli;
        if (members.size >= 12) {
            // 4 villici, 2 lupi, 1 veggente, 1 medium, 1 indemoniato, 1 guardia, 1 gufo
            ruoli = ['umano', 'umano', 'umano', 'umano', 'lupo', 'lupo', 'veggente', 'medium', 'indemoniato', 'guardia', 'gufo'];
        } else if (members.size >= 11) {
            // 5 villici, 2 lupi, 1 veggente, 1 medium, 1 indemoniato, 1 guardia
            ruoli = ['umano', 'umano', 'umano', 'umano', 'umano', 'lupo', 'lupo', 'veggente', 'medium', 'indemoniato', 'guardia'];
        } else if (members.size >= 10) {
            // 5 villici, 2 lupi, 1 veggente, 1 medium, 1 indemoniato
            ruoli = ['umano', 'umano', 'umano', 'umano', 'umano', 'lupo', 'lupo', 'veggente', 'medium', 'indemoniato'];
        } else if (members.size >= 9) {
            // 5 villici, 2 lupi, 1 veggente, 1 medium
            ruoli = ['umano', 'umano', 'umano', 'umano', 'umano', 'lupo', 'lupo', 'veggente', 'medium'];
        } else {
            // 8 giocatori: 5 villici, 2 lupi, 1 veggente (configurazione standard)
            ruoli = ['umano', 'umano', 'umano', 'umano', 'umano', 'lupo', 'lupo', 'veggente'];
        }
        shuffleArray(ruoli);

        // Prima, svuota la tabella per la nuova partita
        await request.query('DELETE FROM dbo.minigiochi');

        // Assegna i ruoli ai giocatori
        const memberIds = Array.from(members.keys());
        for (let i = 0; i < memberIds.length; i++) {
            const memberId = memberIds[i];
            const ruolo = ruoli[i];
            const member = members.get(memberId);
            
            // Create a new request for each insert to ensure clean parameter state
            const insertRequest = new sql.Request(transaction);
            await insertRequest
                .input('iddiscord', sql.VarChar, memberId)
                .input('ruolo', sql.VarChar, ruolo)
                .input('username', sql.VarChar, member.displayName || member.user.username)
                .query(`
                    INSERT INTO dbo.minigiochi (iddiscord, ruoli, stato, fasi, partita, username)
                    VALUES (@iddiscord, @ruolo, 'vivo', 'notte', '1', @username)
                `);
        }

        await transaction.commit();
        return true;
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

// Funzione per ottenere il ruolo di un giocatore
async function getRuoloGiocatore(idDiscord) {
    const pool = await sql.connect(process.env.SQLSERVER_CONFIG);
    const result = await pool.request()
        .input('iddiscord', sql.VarChar, idDiscord)
        .query('SELECT ruoli, stato, username FROM dbo.minigiochi WHERE iddiscord = @iddiscord');
    
    return result.recordset[0];
}

// Funzione per ottenere tutti i giocatori vivi
async function getGiocatoriVivi() {
    const pool = await sql.connect(process.env.SQLSERVER_CONFIG);
    const result = await pool.request()
        .query('SELECT iddiscord, username, ruoli FROM dbo.minigiochi WHERE stato = \'vivo\'');
    
    return result.recordset;
}

// Funzione per eliminare un giocatore
async function eliminaGiocatore(idDiscord) {
    const pool = await sql.connect(process.env.SQLSERVER_CONFIG);
    await pool.request()
        .input('iddiscord', sql.VarChar, idDiscord)
        .query('UPDATE dbo.minigiochi SET stato = \'morto\' WHERE iddiscord = @iddiscord');
}

// Funzione per cambiare la fase del gioco
async function cambiaFase(nuovaFase) {
    const pool = await sql.connect(process.env.SQLSERVER_CONFIG);
    await pool.request()
        .input('fase', sql.VarChar, nuovaFase)
        .query('UPDATE dbo.minigiochi SET fasi = @fase');
}

// Funzione per controllare se il gioco è finito
async function checkGameOver() {
    const pool = await sql.connect(process.env.SQLSERVER_CONFIG);
    const result = await pool.request()
        .query(`
            SELECT 
                SUM(CASE WHEN ruoli = 'lupo' AND stato = 'vivo' THEN 1 ELSE 0 END) as lupiVivi,
                SUM(CASE WHEN stato = 'vivo' THEN 1 ELSE 0 END) as totaleVivi
            FROM dbo.minigiochi
        `);
    
    const stats = result.recordset[0];
    // I lupi vincono quando il loro numero è maggiore o uguale alla metà dei vivi totali
    if (stats.lupiVivi === 0) return 'villaggio';
    if (stats.lupiVivi >= Math.ceil(stats.totaleVivi / 2)) return 'lupi';
    return null;
}

// Funzione per svuotare il gioco
async function svuotaGioco() {
    const pool = await sql.connect(process.env.SQLSERVER_CONFIG);
    await pool.request().query('DELETE FROM dbo.minigiochi');
}

// Funzione per proteggere un giocatore (Guardia del corpo)
async function proteggiGiocatore(idProtetto) {
    const pool = await sql.connect(process.env.SQLSERVER_CONFIG);
    // Prima rimuovi eventuali protezioni precedenti
    await pool.request()
        .query('UPDATE dbo.minigiochi SET protetto = 0');
    // Poi imposta la protezione sul nuovo giocatore
    await pool.request()
        .input('idprotetto', sql.VarChar, idProtetto)
        .query('UPDATE dbo.minigiochi SET protetto = 1 WHERE iddiscord = @idprotetto');
}

// Funzione per verificare se un giocatore è protetto
async function isGiocatoreProtetto(idDiscord) {
    const pool = await sql.connect(process.env.SQLSERVER_CONFIG);
    const result = await pool.request()
        .input('iddiscord', sql.VarChar, idDiscord)
        .query('SELECT protetto FROM dbo.minigiochi WHERE iddiscord = @iddiscord');
    
    return result.recordset[0]?.protetto === 1;
}

// Funzione per verificare se un giocatore è la Guardia del corpo
async function isGuardiaDelCorpo(idDiscord) {
    const pool = await sql.connect(process.env.SQLSERVER_CONFIG);
    const result = await pool.request()
        .input('iddiscord', sql.VarChar, idDiscord)
        .query('SELECT ruoli FROM dbo.minigiochi WHERE iddiscord = @iddiscord');
    
    return result.recordset[0]?.ruoli === 'guardia';
}

module.exports = {
    initializeDatabase,
    inserisciGiocatori,
    getRuoloGiocatore,
    getGiocatoriVivi,
    eliminaGiocatore,
    cambiaFase,
    checkGameOver,
    svuotaGioco,
    proteggiGiocatore,
    isGiocatoreProtetto,
    isGuardiaDelCorpo
};
