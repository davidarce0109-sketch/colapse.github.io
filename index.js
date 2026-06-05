// ==========================================
// CONFIGURACIÓN DE FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://TU_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_PROJECT_ID.appspot.com",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID"
};

// Inicializar Firebase de manera segura
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Objeto de estado interno
let game = {
    round: 0,
    stability: 10,
    started: false,
    organizations: [], 
    decisions: {} 
};

let currentRole = null;    // "admin" o Índice de la organización
let currentOrgName = "";   // Nombre de la organización activa si es jugador

// ==========================================
// SINCRONIZACIÓN EN TIEMPO REAL
// ==========================================
db.ref("colapso2099").on("value", (snapshot) => {
    const data = snapshot.val();
    if (data) {
        game = data;
        if (!game.organizations) game.organizations = [];
        if (!game.decisions) game.decisions = {};
    } else {
        // Inicialización limpia por defecto si Firebase se vacía
        game = { round: 0, stability: 10, started: false, organizations: [], decisions: {} };
    }
    
    // Solo actualiza visualmente la tabla si el usuario ya pasó la pantalla de login
    if (currentRole !== null) {
        render();
    }
});

function saveToServer() {
    db.ref("colapso2099").set(game);
}

// ==========================================
// SISTEMA DE ACCESO Y FIX DE NAVEGACIÓN
// ==========================================

function accessAsAdmin() {
    let password = prompt("Introduce la contraseña de Administrador:");
    if (password === "kaleidblood") {
        currentRole = "admin";
        currentOrgName = "";

        // Despliegue estricto del DOM
        document.getElementById("authScreen").style.display = "none";
        document.getElementById("gameScreen").style.display = "grid";
        document.getElementById("adminControls").style.display = "block";
        document.getElementById("orgPanel").style.display = "none"; 
        
        render(); 
    } else {
        alert("❌ Contraseña incorrecta.");
    }
}

function accessAsOrg() {
    let name = prompt("Escribe el nombre de tu organización:");
    if (!name || name.trim() === "") return alert("Nombre no válido.");
    name = name.trim();

    // Comprobar si existe en memoria local traída de Firebase
    let idx = game.organizations.findIndex(org => org.name.toLowerCase() === name.toLowerCase());

    if (idx === -1) {
        // Registro instantáneo distributivo
        game.organizations.push({
            name: name,
            wealth: 0,
            trust: 10,
            scrap: 10,
            reputation: 0, 
            escape: false,
            shipAction: "Ninguna"
        });
        idx = game.organizations.length - 1;
        saveToServer();
    }

    currentRole = idx;
    currentOrgName = game.organizations[idx].name;

    // Despliegue de paneles para jugadores
    document.getElementById("authScreen").style.display = "none";
    document.getElementById("gameScreen").style.display = "grid";
    document.getElementById("adminControls").style.display = "none"; 
    document.getElementById("orgPanel").style.display = "block";
    document.getElementById("currentOrgLabel").innerText = currentOrgName;
    
    render();
}

function logout() {
    // Romper referencias de sesión de inmediato
    currentRole = null;
    currentOrgName = "";
    
    // Limpieza absoluta de la interfaz gráfica para evitar bloqueos residuales
    document.getElementById("gameScreen").style.display = "none";
    document.getElementById("adminControls").style.display = "none";
    document.getElementById("orgPanel").style.display = "none";
    document.getElementById("status").innerText = "";
    
    // Re-activar ventana de ingreso limpia
    document.getElementById("authScreen").style.display = "block";
}

// ==========================================
// RENDERIZADO VISUAL
// ==========================================

function render() {
    document.getElementById("round").innerText = game.round;
    let stabEl = document.getElementById("stability");
    stabEl.innerText = game.stability;
    stabEl.style.color = game.stability > 6 ? "#00ff99" : game.stability > 3 ? "#e6a23c" : "#ff5555";

    let ranking = game.organizations.slice().sort((a, b) => b.wealth - a.wealth);

    let html = `<table><tr>
                    <th>Organización</th>
                    <th>Riqueza</th>
                    <th>Reputación</th>
                    <th>Chatarra</th>
                    <th>Estado</th>`;
    
    // El Admin recibe las columnas secretas de auditoría de juego
    if (currentRole === "admin") {
        html += `<th>Decisión Oculta</th><th>Acción Nave</th>`;
    }
    html += `</tr>`;

    ranking.forEach(org => {
        let originalIdx = game.organizations.findIndex(o => o.name === org.name);
        let rawDecision = game.decisions[originalIdx];
        let decisionTraducida = "Esperando...";
        
        if (rawDecision) {
            if (rawDecision === "cooperate") decisionTraducida = "🟢 Cooperar";
            if (rawDecision === "betray") decisionTraducida = "🔴 Traicionar";
            if (rawDecision === "repair") decisionTraducida = "🔧 Reparar";
        }

        html += `<tr>
            <td>${org.name}</td>
            <td>$${org.wealth.toFixed(1)}</td>
            <td>${org.reputation || 0}</td>
            <td>${org.scrap}</td>
            <td>${org.escape ? '<span class="escape-badge">🚀 EN NAVE</span>' : '🌍 TIERRA'}</td>`;
        
        if (currentRole === "admin") {
            html += `<td><span class="secret-vote">${decisionTraducida}</span></td>
                     <td><small>${org.shipAction || 'Ninguna'}</small></td>`;
        }
        html += `</tr>`;
    });
    html += "</table>";
    document.getElementById("ranking").innerHTML = html;
}

// ==========================================
// MECÁNICAS E INTERACCIONES
// ==========================================

function startGame() {
    if(game.organizations.length === 0) return alert("Registra organizaciones primero.");
    game.started = true;
    game.round = 1;
    game.stability = 10;
    game.decisions = {}; 
    game.organizations.forEach(o => o.shipAction = "Ninguna");
    saveToServer();
}

function sendDecision(type) {
    if(!game.started) return alert("El Administrador aún no ha iniciado la partida.");
    if(currentRole === "admin" || currentRole === null) return alert("No estás registrado como organización.");

    game.decisions[currentRole] = type;
    saveToServer();

    let statusEl = document.getElementById("status");
    statusEl.innerHTML = `✅ Acción registrada de forma oculta.<br><small>Se contará la última acción pulsada.</small>`;
    setTimeout(() => { 
        if(currentRole !== null) statusEl.innerText = "Esperando resolución del Administrador..."; 
    }, 3000);
}

function nextRound() {
    if (!game.started) return;
    if (Object.keys(game.decisions).length === 0) return alert("Ninguna organización ha votado en esta ronda.");

    let cooperators = 0, betrayers = 0, repairers = 0;

    Object.entries(game.decisions).forEach(([id, decision]) => {
        if (decision === "cooperate") cooperators++;
        if (decision === "betray") betrayers++;
        if (decision === "repair") repairers++;
    });

    game.organizations.forEach((org, id) => {
        let decision = game.decisions[id];
        let share = (cooperators * 15) / game.organizations.length;
        org.wealth += share;

        if (org.reputation === undefined) org.reputation = 0;

        if (decision === "cooperate") {
            org.scrap += 5;
            org.reputation += 5; 
        } else if (decision === "betray") {
            org.wealth += 20;
            org.scrap += 20;
            org.reputation -= 7; 
        } else if (decision === "repair") {
            if (org.scrap >= 5) org.scrap -= 5;
            else org.wealth = Math.max(0, org.wealth - 10);
            org.reputation += 7; 
        }
    });

    game.stability = Math.min(10, game.stability - (betrayers * 2) + (repairers * 1));

    // Resolución de naves espaciales
    let candidates = [];
    game.organizations.forEach((org, id) => {
        if (org.scrap >= 50) {
            candidates.push({ organization: org, id: id });
        }
    });

    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    for (let candidate of candidates) {
        let org = candidate.organization;
        let currentOwner = game.organizations.find(o => o.escape);

        if (org.escape) continue;

        let confirmMessage = currentOwner 
            ? `¡LA NAVE YA TIENE DUEÑO! ${org.name} tiene ${org.scrap} de Chatarra. ¿Quieres gastar 50 unidades para ROBARLE la única nave a la organización ${currentOwner.name}?`
            : `${org.name} tiene ${org.scrap} de Chatarra. ¿Construir la única Nave de Escape del planeta?`;

        if (confirm(confirmMessage)) {
            if (currentOwner) {
                currentOwner.escape = false;
                currentOwner.shipAction = "¡Le robaron la nave!";
            }
            org.scrap -= 50;
            org.escape = true;
            org.shipAction = currentOwner ? "🏴‍☠️ ROBÓ LA NAVE" : "🛠️ CONSTRUYÓ NAVE";
        }
    }

    // Comprobaciones de finales y cierres automáticos
    if (game.stability <= 0) {
        let finalWinner = game.organizations.find(org => org.escape);
        if (finalWinner) {
            alert(`💥 COLAPSO TOTAL 💥\nLa Tierra ha sido destruida. Ganador en órbita: ${finalWinner.name}`);
        } else {
            alert(`💥 COLAPSO TOTAL 💥\nLa Tierra ha sido destruida. Todos han muerto.`);
        }
        manualReset(true);
        return;
    }

    if (game.round >= 5) {
        let winner;
        if (game.stability >= 7) {
            let ranking = game.organizations.slice().sort((a, b) => {
                if (b.wealth !== a.wealth) return b.wealth - a.wealth;
                if (b.reputation !== a.reputation) return b.reputation - a.reputation;
                return b.scrap - a.scrap;
            });
            winner = ranking[0];
            alert(`🏆 FIN DE LA PARTIDA 🏆\nPlaneta Salvado (${game.stability}/10).\nGanador por Riqueza:\n👉 ${winner.name}`);
        } else {
            let ranking = game.organizations.slice().sort((a, b) => {
                if (b.reputation !== a.reputation) return b.reputation - a.reputation;
                if (b.wealth !== a.wealth) return b.wealth - a.wealth;
                return b.scrap - a.scrap;
            });
            winner = ranking[0];
            alert(`🏆 FIN DE LA PARTIDA 🏆\nPlaneta al borde del Abismo (${game.stability}/10).\nGanador por Reputación:\n👉 ${winner.name}`);
        }
        manualReset(true);
        return;
    }

    game.round++;
    game.decisions = {}; 
    saveToServer();
}

function manualReset(silent = false) {
    if(silent || confirm("¿Limpiar por completo los datos de la partida actual de Firebase?")) {
        game = { round: 0, stability: 10, started: false, organizations: [], decisions: {} };
        
        db.ref("colapso2099").set(game).then(() => {
            if (silent) {
                logout();
            } else {
                render();
            }
        });
    }
}