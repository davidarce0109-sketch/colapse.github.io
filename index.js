// ==========================================
// CONFIGURACIÓN DE FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDj-JXmQQZEb9Sqal9BV98YXF_-dOq29Eo",
  authDomain: "colapse2099.firebaseapp.com",
  databaseURL: "https://colapse2099-default-rtdb.firebaseio.com",
  projectId: "colapse2099",
  storageBucket: "colapse2099.firebasestorage.app",
  messagingSenderId: "742926104267",
  appId: "1:742926104267:web:f3f5388819d82608310d4e"
};

// Inicializar Firebase de manera segura
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Objeto de estado interno sincronizado (Extendida con historial de ronda)
let game = {
    round: 0,
    stability: 10,
    started: false,
    organizations: [], 
    decisions: {},
    shipPhase: {
        active: false,
        candidatesIds: [],
        currentIndex: 0,
        currentOffer: null // "build" o "steal"
    },
    lastGlobalNotice: "", // Sincroniza alertas globales para todas las pantallas
    lastRoundSummary: ""  // Almacena temporalmente lo que hizo cada org en la ronda
};

let currentRole = null;    // El String "admin" o el Índice numérico de la organización
let currentOrgName = "";   // Almacena el nombre si el rol activo es organización

// ==========================================
// SINCRONIZACIÓN ASÍNCRONA EN TIEMPO REAL
// ==========================================
db.ref("colapso2099").on("value", (snapshot) => {
    const data = snapshot.val();
    if (data) {
        game = data;
        if (!game.organizations) game.organizations = [];
        if (!game.decisions) game.decisions = {};
        if (!game.shipPhase) game.shipPhase = { active: false, candidatesIds: [], currentIndex: 0, currentOffer: null };
        if (!game.lastRoundSummary) game.lastRoundSummary = "";
    } else {
        game = { round: 0, stability: 10, started: false, organizations: [], decisions: {}, shipPhase: { active: false, candidatesIds: [], currentIndex: 0, currentOffer: null }, lastGlobalNotice: "", lastRoundSummary: "" };
    }
    
    if (currentRole !== null) {
        render();
        evaluateShipPrompts(); 
    }
});

function saveToServer() {
    db.ref("colapso2099").set(game);
}

// ==========================================
// ENRUTAMIENTO DE ACCESO Y RESETS
// ==========================================

function accessAsAdmin() {
    let password = prompt("Introduce la contraseña de Administrador:");
    if (password === "kaleidblood") {
        currentRole = "admin";
        currentOrgName = "";

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

    let idx = game.organizations.findIndex(org => org.name.toLowerCase() === name.toLowerCase());

    if (idx === -1) {
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

    document.getElementById("authScreen").style.display = "none";
    document.getElementById("gameScreen").style.display = "grid";
    document.getElementById("adminControls").style.display = "none"; 
    document.getElementById("orgPanel").style.display = "block";
    document.getElementById("currentOrgLabel").innerText = currentOrgName;
    
    render();
}

function logout() {
    currentRole = null;
    currentOrgName = "";
    
    document.getElementById("gameScreen").style.display = "none";
    document.getElementById("adminControls").style.display = "none";
    document.getElementById("orgPanel").style.display = "none";
    document.getElementById("status").innerText = "";
    document.getElementById("shipTerminal").style.display = "none";
    document.getElementById("globalAlerts").style.display = "none";
    
    document.getElementById("authScreen").style.display = "block";
}

// ==========================================
// RENDERIZADO GRÁFICO DINÁMICO
// ==========================================

function render() {
    document.getElementById("round").innerText = game.round;
    let stabEl = document.getElementById("stability");
    stabEl.innerText = game.stability;
    stabEl.style.color = game.stability > 6 ? "#00ff99" : game.stability > 3 ? "#e6a23c" : "#ff5555";

    // Alertas globales unificadas desde la base de datos
    let alertBox = document.getElementById("globalAlerts");
    if (game.lastGlobalNotice && game.lastGlobalNotice !== "") {
        alertBox.style.display = "block";
        document.getElementById("alertMessage").innerHTML = game.lastGlobalNotice; // innerHTML para soportar saltos de línea <br>
    } else {
        alertBox.style.display = "none";
    }

    let ranking = game.organizations.slice().sort((a, b) => b.wealth - a.wealth);

    let html = `<table><tr>
                    <th>Organización</th>
                    <th>Riqueza</th>
                    <th>Reputación</th>
                    <th>Chatarra</th>
                    <th>Estado</th>`;
    
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
            <td>${org.escape ? '<span style="background:#aa00ff; color:#fff; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:0.8rem;">🚀 EN NAVE</span>' : '🌍 TIERRA'}</td>`;
        
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
// CONTROL DEL MANUAL DE AYUDA
// ==========================================
function toggleHelp() {
    let content = document.getElementById("helpContent");
    let arrow = document.getElementById("helpArrow");
    if (content.style.display === "none") {
        content.style.display = "block";
        arrow.innerText = "▲ Colapsar";
    } else {
        content.style.display = "none";
        arrow.innerText = "▼ Expandir";
    }
}

// ==========================================
// MECÁNICA SINCRÓNICA DE LA NAVE DE ESCAPE
// ==========================================

function evaluateShipPrompts() {
    let shipTerminal = document.getElementById("shipTerminal");
    
    if (!game.shipPhase || !game.shipPhase.active) {
        shipTerminal.style.display = "none";
        return;
    }

    let activeCandidateId = game.shipPhase.candidatesIds[game.shipPhase.currentIndex];
    
    // Mostrar la ventana interactiva únicamente a la organización del turno actual
    if (currentRole !== "admin" && currentRole === activeCandidateId) {
        shipTerminal.style.display = "block";
        let msg = document.getElementById("shipTerminalMessage");
        let btn = document.getElementById("btnShipAccept");

        if (game.shipPhase.currentOffer === "steal") {
            let owner = game.organizations.find(o => o.escape);
            msg.innerHTML = `⚠️ <strong style="color: #ff5555;">¡PROYECTO SABOTAJE DISPONIBLE!</strong> La única Nave de Escape construida pertenece a <strong>${owner ? owner.name : 'un rival'}</strong>.<br>¿Deseas gastar 50 unidades de Chatarra para <strong>ROBARLES</strong> la nave y asegurar tu escape?`;
            btn.innerText = "🏴‍☠️ ¡ROBAR NAVE (-50 Chatarra)!";
            btn.style.background = "#ff5555";
        } else {
            msg.innerHTML = `🛠️ <strong style="color: #00ff99;">PROYECTO ASTILLERO DISPONIBLE:</strong> Cuentas con materiales de alta gama.<br>¿Deseas gastar 50 unidades de Chatarra para construir la única Nave de Escape planetaria y abordarla?`;
            btn.innerText = "🛠️ ¡CONSTRUIR NAVE (-50 Chatarra)!";
            btn.style.background = "#00ff99";
        }
    } else {
        shipTerminal.style.display = "none";
    }
}

function acceptShipProject() {
    let org = game.organizations[currentRole];
    if (org.scrap < 50) return alert("Error: Estructuras de chatarra insuficientes.");

    let currentOwner = game.organizations.find(o => o.escape);
    let shipNotice = "";

    if (game.shipPhase.currentOffer === "steal" && currentOwner) {
        currentOwner.escape = false;
        currentOwner.shipAction = "¡Nave Robada!";
        shipNotice = `🏴‍☠️ <strong>[${org.name}]</strong> decidió ROBAR la nave a [${currentOwner.name}].`;
    } else {
        shipNotice = `🛠️ <strong>[${org.name}]</strong> decidió CONSTRUIR y abordar la nave.`;
    }

    org.scrap -= 50;
    org.escape = true;
    org.shipAction = game.shipPhase.currentOffer === "steal" ? "🏴‍☠️ ROBÓ LA NAVE" : "🛠️ CONSTRUYÓ NAVE";

    // Unir el informe de decisiones básicas con el evento final de la nave
    game.lastGlobalNotice = `${game.lastRoundSummary}<br>🚀 <strong>PROYECTO EVACUACIÓN:</strong> ${shipNotice}`;
    
    // Desactivar fase de la nave ya que fue reclamada
    game.shipPhase = { active: false, candidatesIds: [], currentIndex: 0, currentOffer: null };
    
    checkPostShipTurnResolutions();
}

function declineShipProject() {
    game.shipPhase.currentIndex++;
    
    // Si se agotan los candidatos y nadie la compró/robó
    if (game.shipPhase.currentIndex >= game.shipPhase.candidatesIds.length) {
        game.shipPhase.active = false;
        
        // El aviso global se publica mostrando el resumen y que nadie tomó la nave
        game.lastGlobalNotice = `${game.lastRoundSummary}<br>🚀 <strong>PROYECTO EVACUACIÓN:</strong> Los candidatos elegibles decidieron rechazar o guardar su chatarra.`;
        checkPostShipTurnResolutions();
    } else {
        // Si hay otro candidato en fila, actualizamos la oferta para él
        let nextId = game.shipPhase.candidatesIds[game.shipPhase.currentIndex];
        let currentOwner = game.organizations.find(o => o.escape);
        game.shipPhase.currentOffer = currentOwner ? "steal" : "build";
        saveToServer(); 
    }
}

// ==========================================
// LÓGICA DE CONTROL DE JUEGO (ADMINISTRADOR)
// ==========================================

function startGame() {
    if(game.organizations.length === 0) return alert("Registra organizaciones primero.");
    game.started = true;
    game.round = 1;
    game.stability = 10;
    game.decisions = {}; 
    game.lastGlobalNotice = "📢 ¡La simulación de Colapso 2099 ha iniciado! Ingresen sus decisiones.";
    game.lastRoundSummary = "";
    game.organizations.forEach(o => {
        o.shipAction = "Ninguna";
        o.escape = false;
        o.wealth = 0;
        o.scrap = 10;
        o.reputation = 0;
    });
    game.shipPhase = { active: false, candidatesIds: [], currentIndex: 0, currentOffer: null };
    saveToServer();
}

function sendDecision(type) {
    if(!game.started) return alert("El Administrador debe iniciar la simulación.");
    if(currentRole === "admin" || currentRole === null) return alert("No eres una organización válida.");

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
    if (Object.keys(game.decisions).length === 0) return alert("Ninguna organización ha enviado coordenadas de acción.");

    let cooperators = 0, betrayers = 0, repairers = 0;
    let summaryLines = [];

    // 1. Recuento de decisiones para calcular el impacto
    Object.entries(game.decisions).forEach(([id, decision]) => {
        if (decision === "cooperate") cooperators++;
        if (decision === "betray") betrayers++;
        if (decision === "repair") repairers++;
    });

    // 2. Aplicar matemáticas de recursos y construir texto del reporte de acciones regulares
    summaryLines.push(`📋 <strong>REPORTE ACCIONES RONDA ${game.round}:</strong>`);
    
    game.organizations.forEach((org, id) => {
        let decision = game.decisions[id];
        let share = (cooperators * 15) / game.organizations.length;
        org.wealth += share;

        if (org.reputation === undefined) org.reputation = 0;

        let actionText = "💤 No reportó acción";
        if (decision === "cooperate") {
            org.scrap += 5;
            org.reputation += 5; 
            actionText = "🟢 Cooperó con el planeta";
        } else if (decision === "betray") {
            org.wealth += 20;
            org.scrap += 20;
            org.reputation -= 7; 
            actionText = "🔴 Traicionó para extraer recursos";
        } else if (decision === "repair") {
            if (org.scrap >= 5) org.scrap -= 5;
            else org.wealth = Math.max(0, org.wealth - 10);
            org.reputation += 7; 
            actionText = "🔧 Reparó la infraestructura global";
        }
        
        summaryLines.push(`• <strong>${org.name}</strong> tomó la opción: ${actionText}.`);
    });

    // Aplicar cambios en estabilidad planetaria
    game.stability = Math.min(10, game.stability - (betrayers * 2) + (repairers * 1));
    summaryLines.push(`📉 <strong>Estabilidad resultante del planeta:</strong> ${game.stability}/10.`);

    // Guardamos este resumen de texto en Firebase de forma temporal
    game.lastRoundSummary = summaryLines.join("<br>");
    game.lastGlobalNotice = ""; // Limpiamos pantalla mientras se decide el destino de la nave

    // 3. Filtrar y procesar candidatos a la Nave de Escape
    let candidatesIds = [];
    game.organizations.forEach((org, id) => {
        if (org.scrap >= 50) {
            candidatesIds.push(id);
        }
    });

    // Barajado aleatorio Fischer-Yates de candidatos
    for (let i = candidatesIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidatesIds[i], candidatesIds[j]] = [candidatesIds[j], candidatesIds[i]];
    }

    if (candidatesIds.length > 0) {
        // Al haber candidatos, activamos el flujo asíncrono en los dispositivos de los jugadores
        let currentOwner = game.organizations.find(o => o.escape);
        game.shipPhase = {
            active: true,
            candidatesIds: candidatesIds,
            currentIndex: 0,
            currentOffer: currentOwner ? "steal" : "build"
        };
        saveToServer();
    } else {
        // Si nadie junta la chatarra necesaria, se publica el aviso de acciones directamente
        game.lastGlobalNotice = `${game.lastRoundSummary}<br>🚀 <strong>PROYECTO EVACUACIÓN:</strong> Ningún equipo cuenta con la chatarra necesaria (50) para activar el astillero.`;
        checkPostShipTurnResolutions();
    }
}

function checkPostShipTurnResolutions() {
    // Evaluación de finalización por colapso planetario (Estabilidad <= 0)
    if (game.stability <= 0) {
        let finalWinner = game.organizations.find(org => org.escape);
        let extraMsg = "";
        if (finalWinner) {
            extraMsg = `<br>💥 <strong>COLAPSO CRÍTICO:</strong> ¡El planeta ha explotado! La corporación ganadora instalada en la nave es: <strong>${finalWinner.name}</strong>.`;
        } else {
            extraMsg = `<br>💥 <strong>COLAPSO CRÍTICO:</strong> El planeta fue destruido y la nave quedó desierta. Extinción total de las compañías.`;
        }
        game.lastGlobalNotice += extraMsg;
        saveToServer(); 
        setTimeout(() => manualReset(true), 14000);
        return;
    }

    // Evaluación de finalización por límite de tiempo (Ronda 5 concluida)
    if (game.round >= 5) {
        let winner;
        let extraMsg = "";
        if (game.stability >= 7) {
            let ranking = game.organizations.slice().sort((a, b) => {
                if (b.wealth !== a.wealth) return b.wealth - a.wealth;
                if (b.reputation !== a.reputation) return b.reputation - a.reputation;
                return b.scrap - a.scrap;
            });
            winner = ranking[0];
            extraMsg = `<br>🏆 <strong>FIN DE LA SIMULACIÓN:</strong> El planeta resiste con un ecosistema alto. Victoria Financiera para: <strong>${winner.name}</strong> con $${winner.wealth.toFixed(1)}.`;
        } else {
            let ranking = game.organizations.slice().sort((a, b) => {
                if (b.reputation !== a.reputation) return b.reputation - a.reputation;
                if (b.wealth !== a.wealth) return b.wealth - a.wealth;
                return b.scrap - a.scrap;
            });
            winner = ranking[0];
            extraMsg = `<br>🏆 <strong>FIN DE LA SIMULACIÓN:</strong> El planeta sobrevive gravemente dañado. Victoria Moral por Reputación para: <strong>${winner.name}</strong> (Rep: ${winner.reputation}).`;
        }
        game.lastGlobalNotice += extraMsg;
        saveToServer(); 
        setTimeout(() => manualReset(true), 14000);
        return;
    }

    // Si la simulación continúa de forma normal
    game.round++;
    game.decisions = {}; 
    saveToServer(); 
}

function manualReset(silent = false) {
    if(silent || confirm("¿Seguro que deseas restaurar la base de datos de Firebase por completo?")) {
        game = { 
            round: 0, 
            stability: 10, 
            started: false, 
            organizations: [], 
            decisions: {},
            shipPhase: { active: false, candidatesIds: [], currentIndex: 0, currentOffer: null },
            lastGlobalNotice: "🔄 Los servidores de simulación han sido reiniciados.",
            lastRoundSummary: ""
        };
        
        db.ref("colapso2099").set(game).then(() => {
            if (silent) {
                logout();
            } else {
                render();
            }
        });
    }
}