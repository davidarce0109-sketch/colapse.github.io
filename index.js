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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let game = {
    round: 0,
    stability: 10,
    started: false,
    ended: false, 
    organizations: [], 
    decisions: {},
    shipPhase: { active: false, candidatesIds: [], currentIndex: 0, currentOffer: null, timerDeadline: null },
    lastGlobalNotice: "", 
    roundDecisions: {} 
};

let currentRole = localStorage.getItem("colapso_role") !== null ? 
    (localStorage.getItem("colapso_role") === "admin" ? "admin" : parseInt(localStorage.getItem("colapso_role"), 10)) 
    : null;   

let currentOrgName = localStorage.getItem("colapso_orgName") || "";   
let localTimerInterval = null; 

// ==========================================
// SINCRONIZACIÓN ASÍNCRONA EN TIEMPO REAL (CORREGIDA)
// ==========================================
db.ref("colapso2099").on("value", (snapshot) => {
    const data = snapshot.val();
    if (data) {
        game = data;
        if (!game.organizations) game.organizations = [];
        if (!game.decisions) game.decisions = {};
        if (!game.shipPhase) game.shipPhase = { active: false, candidatesIds: [], currentIndex: 0, currentOffer: null, timerDeadline: null };
        if (!game.roundDecisions) game.roundDecisions = {};
        if (game.ended === undefined) game.ended = false;
    } else {
        game = { round: 0, stability: 10, started: false, ended: false, organizations: [], decisions: {}, shipPhase: { active: false, candidatesIds: [], currentIndex: 0, currentOffer: null, timerDeadline: null }, lastGlobalNotice: "", roundDecisions: {} };
    }
    
    // Se eliminó la validación defectuosa que expulsaba a los usuarios al lobby.

    if (currentRole !== null) {
        render();
        evaluateShipPrompts(); 
    }
});

function saveToServer() {
    db.ref("colapso2099").set(game);
}

// ==========================================
// ENRUTAMIENTO DE ACCESO Y SESIÓN
// ==========================================
function accessAsAdmin() {
    let password = prompt("Introduce la contraseña de Administrador:");
    if (password === "kaleidblood") {
        currentRole = "admin";
        currentOrgName = "";

        localStorage.setItem("colapso_role", "admin");
        localStorage.setItem("colapso_orgName", "");

        document.getElementById("authScreen").style.display = "none";
        document.getElementById("gameScreen").style.display = "flex"; 
        document.getElementById("adminPanel").style.display = "block";
        document.getElementById("adminControls").style.display = "flex";
        document.getElementById("orgPanel").style.display = "none"; 
        document.getElementById("btnExitMenu").style.display = "block"; 
        
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
        if(game.started || game.ended) return alert("❌ No puedes unirte, la simulación ya está en curso.");

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

    localStorage.setItem("colapso_role", idx);
    localStorage.setItem("colapso_orgName", currentOrgName);

    document.getElementById("authScreen").style.display = "none";
    document.getElementById("gameScreen").style.display = "flex"; 
    document.getElementById("adminPanel").style.display = "none";
    document.getElementById("adminControls").style.display = "none"; 
    document.getElementById("orgPanel").style.display = "block";
    document.getElementById("currentOrgLabel").innerText = currentOrgName;
    document.getElementById("btnExitMenu").style.display = "none"; 
    
    render();
}

function logout() {
    currentRole = null;
    currentOrgName = "";
    clearInterval(localTimerInterval); 
    
    localStorage.removeItem("colapso_role");
    localStorage.removeItem("colapso_orgName");
    
    document.getElementById("gameScreen").style.display = "none";
    document.getElementById("adminPanel").style.display = "none";
    document.getElementById("adminControls").style.display = "none";
    document.getElementById("orgPanel").style.display = "none";
    document.getElementById("status").innerText = "";
    document.getElementById("shipTerminal").style.display = "none";
    document.getElementById("globalAlerts").style.display = "none";
    
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

    let alertBox = document.getElementById("globalAlerts");
    if (game.lastGlobalNotice && game.lastGlobalNotice !== "") {
        alertBox.style.display = "block";
        document.getElementById("alertMessage").innerHTML = game.lastGlobalNotice; 
    } else {
        alertBox.style.display = "none";
    }

    let ranking = game.organizations.slice().sort((a, b) => (b.wealth || 0) - (a.wealth || 0));

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

        let riquezaSegura = (Number(org.wealth) || 0).toFixed(1);

        html += `<tr ${org.escape ? 'style="background: rgba(170, 0, 255, 0.15);"' : ''}>
            <td>${org.name}</td>
            <td>$${riquezaSegura}</td>
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

    if(game.ended && currentRole !== "admin" && currentRole !== null) {
        document.getElementById("status").innerHTML = `<strong style="color: #00ffff; font-size: 1.1rem;">📊 Simulación Finalizada. Esperando reinicio de servidores...</strong>`;
    }
}

function toggleHelp() {
    let content = document.getElementById("helpContent");
    let arrow = document.getElementById("helpArrow");
    if (!content) return;
    
    if (content.style.display === "none" || content.style.display === "") {
        content.style.display = "block";
        if (arrow) arrow.innerText = "▲ Colapsar";
    } else {
        content.style.display = "none";
        if (arrow) arrow.innerText = "▼ Expandir";
    }
}

function buildFinalRoundNotice(shipResolutionText) {
    let lines = [];
    lines.push(`📋 <strong>REPORTE ACCIONES RONDA ${game.round}:</strong>`);
    
    game.organizations.forEach((org, id) => {
        let decision = game.roundDecisions ? game.roundDecisions[id] : null;
        let actionText = "💤 No reportó acción";
        if (decision === "cooperate") actionText = "🟢 Cooperó con el planeta";
        else if (decision === "betray") actionText = "🔴 Traicóno para extraer recursos";
        else if (decision === "repair") actionText = "🔧 Reparó la infraestructura global";
        lines.push(`• <strong>${org.name}</strong>: ${actionText}.`);
    });
    
    lines.push(`📉 <strong>Estabilidad Ecosistema:</strong> ${game.stability}/10.`);
    lines.push(`<br>🚀 <strong>PROYECTO EVACUACIÓN:</strong> ${shipResolutionText}`);
    return lines.join("<br>");
}

// ==========================================
// SISTEMA AUTOMÁTICO DE EVACUACIÓN
// ==========================================
function evaluateShipPrompts() {
    let shipTerminal = document.getElementById("shipTerminal");
    clearInterval(localTimerInterval); 
    
    if (!game.shipPhase || !game.shipPhase.active) {
        shipTerminal.style.display = "none";
        return;
    }

    let activeCandidateId = game.shipPhase.candidatesIds[game.shipPhase.currentIndex];
    let deadline = parseInt(game.shipPhase.timerDeadline, 10);
    let now = Date.now();
    let timeLeft = Math.ceil((deadline - now) / 1000);

    if (isNaN(timeLeft) || timeLeft <= 0) {
        if (currentRole === activeCandidateId || currentRole === "admin") {
            declineShipProject();
        }
        return;
    }

    if (currentRole !== "admin" && currentRole === activeCandidateId) {
        shipTerminal.style.display = "block";
        let msg = document.getElementById("shipTerminalMessage");
        let btn = document.getElementById("btnShipAccept");
        let baseHTML = "";

        if (game.shipPhase.currentOffer === "steal") {
            let owner = game.organizations.find(o => o.escape);
            baseHTML = `⚠️ <strong style="color: #ff5555;">¡SABOTAJE DISPONIBLE!</strong> La única Nave pertenece a <strong>${owner ? owner.name : 'un rival'}</strong>.<br>¿Gastar 50 de Chatarra para <strong>ROBARLES</strong> el vehículo y asegurar tu escape?`;
            btn.innerText = "🏴‍☠️ ¡ROBAR NAVE (-50 Chatarra)!";
            btn.style.background = "#ff5555";
        } else {
            baseHTML = `🛠️ <strong style="color: #00ff99;">ASTILLERO DISPONIBLE:</strong> Tienes materiales suficientes.<br>¿Gastar 50 de Chatarra para construir la Nave de Escape y abordarla?`;
            btn.innerText = "🛠️ ¡CONSTRUIR NAVE (-50 Chatarra)!";
            btn.style.background = "#00ff99";
        }

        localTimerInterval = setInterval(() => {
            let rem = Math.ceil((parseInt(game.shipPhase.timerDeadline, 10) - Date.now()) / 1000);
            if (isNaN(rem) || rem <= 0) {
                clearInterval(localTimerInterval);
                declineShipProject();
            } else {
                document.getElementById("shipTimerLabel").innerHTML = `⏳ Tiempo de respuesta: <strong style="color:#ffcc00; font-size:1.3rem;">${rem}s</strong>`;
            }
        }, 1000);

        msg.innerHTML = `${baseHTML}<br><br><div id="shipTimerLabel">⏳ Tiempo de respuesta: <strong style="color:#ffcc00; font-size:1.3rem;">${timeLeft}s</strong></div>`;
    } else {
        shipTerminal.style.display = "none";
    }
}

function acceptShipProject() {
    let org = game.organizations[currentRole];
    if (org.scrap < 50) return alert("Estructuras de chatarra insuficientes.");

    clearInterval(localTimerInterval);
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

    game.lastGlobalNotice = buildFinalRoundNotice(shipNotice);
    game.shipPhase = { active: false, candidatesIds: [], currentIndex: 0, currentOffer: null, timerDeadline: null };
    checkPostShipTurnResolutions();
}

function declineShipProject() {
    clearInterval(localTimerInterval);
    game.shipPhase.currentIndex++;
    
    if (game.shipPhase.currentIndex >= game.shipPhase.candidatesIds.length) {
        game.shipPhase.active = false;
        let shipNotice = "Los candidatos elegibles rechazaron la oferta o se agotó su tiempo.";
        game.lastGlobalNotice = buildFinalRoundNotice(shipNotice);
        checkPostShipTurnResolutions();
    } else {
        let currentOwner = game.organizations.find(o => o.escape);
        game.shipPhase.currentOffer = currentOwner ? "steal" : "build";
        game.shipPhase.timerDeadline = Date.now() + 10000; 
        saveToServer(); 
    }
}

// ==========================================
// CONTROLADOR DEL ADMINISTRADOR
// ==========================================
function startGame() {
    if(game.organizations.length === 0) return alert("Registra organizaciones primero.");
    game.started = true;
    game.ended = false; 
    game.round = 1;
    game.stability = 10;
    game.decisions = {}; 
    game.roundDecisions = {};
    game.lastGlobalNotice = "📢 ¡La simulación de Colapso 2099 ha iniciado! Ingresen sus decisiones.";
    game.organizations.forEach(o => {
        o.shipAction = "Ninguna";
        o.escape = false;
        o.wealth = 0;
        o.scrap = 10;
        o.reputation = 0;
    });
    game.shipPhase = { active: false, candidatesIds: [], currentIndex: 0, currentOffer: null, timerDeadline: null };
    saveToServer();
}

function sendDecision(type) {
    if(!game.started || game.ended) return alert("La simulación no está activa.");
    game.decisions[currentRole] = type;
    saveToServer();

    let statusEl = document.getElementById("status");
    statusEl.innerHTML = `✅ Acción registrada.<br><small>Se procesará al terminar la ronda.</small>`;
}

function nextRound() {
    if (!game.started || game.ended) return;
    if (Object.keys(game.decisions).length === 0) return alert("Ninguna organización ha enviado acciones.");

    let cooperators = 0, betrayers = 0, repairers = 0;
    game.roundDecisions = {}; 

    Object.entries(game.decisions).forEach(([id, decision]) => {
        game.roundDecisions[id] = decision; 
        if (decision === "cooperate") cooperators++;
        if (decision === "betray") betrayers++;
        if (decision === "repair") repairers++;
    });

    game.organizations.forEach((org, id) => {
        let decision = game.decisions[id];
        let share = (cooperators * 15) / game.organizations.length;
        
        if (org.wealth === undefined || isNaN(org.wealth)) org.wealth = 0;
        org.wealth += Number(share) || 0;
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
    game.lastGlobalNotice = "⏳ Analizando candidatos de ingeniería espacial..."; 

    let candidatesIds = [];
    game.organizations.forEach((org, id) => {
        if (org.scrap >= 50 && !org.escape) candidatesIds.push(id);
    });

    for (let i = candidatesIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidatesIds[i], candidatesIds[j]] = [candidatesIds[j], candidatesIds[i]];
    }

    if (candidatesIds.length > 0) {
        let currentOwner = game.organizations.find(o => o.escape);
        game.shipPhase = {
            active: true,
            candidatesIds: candidatesIds,
            currentIndex: 0,
            currentOffer: currentOwner ? "steal" : "build", 
            timerDeadline: Date.now() + 10000
        };
        saveToServer();
    } else {
        let shipNotice = "Ningún equipo cuenta con la chatarra requerida (50) para activar el astillero.";
        game.lastGlobalNotice = buildFinalRoundNotice(shipNotice);
        checkPostShipTurnResolutions();
    }
}

function checkPostShipTurnResolutions() {
    if (game.stability <= 0) {
        let finalWinner = game.organizations.find(org => org.escape);
        let extraMsg = finalWinner ? 
            `<br><br>💥 <strong>COLAPSO CRÍTICO:</strong> ¡El planeta explotó! Ganador en órbita: <strong>${finalWinner.name}</strong>.` :
            `<br><br>💥 <strong>COLAPSO CRÍTICO:</strong> El planeta colapsó sin naves activas. Extinción total.`;
        game.lastGlobalNotice += extraMsg;
        game.started = false;
        game.ended = true; 
        saveToServer();
        return;
    }

    if (game.round >= 5) {
        let winner;
        let extraMsg = "";
        if (game.stability >= 7) {
            let ranking = game.organizations.slice().sort((a, b) => b.wealth - a.wealth);
            winner = ranking[0];
            extraMsg = `<br><br>🏆 <strong>FIN:</strong> El planeta resiste. Victoria Financiera para: <strong>${winner.name}</strong> ($${(Number(winner.wealth) || 0).toFixed(1)}).`;
        } else {
            let ranking = game.organizations.slice().sort((a, b) => b.reputation - a.reputation);
            winner = ranking[0];
            extraMsg = `<br><br>🏆 <strong>FIN:</strong> Superficie severamente dañada. Victoria Moral para: <strong>${winner.name}</strong> (Reputación: ${winner.reputation}).`;
        }
        game.lastGlobalNotice += extraMsg;
        game.started = false;
        game.ended = true; 
        saveToServer();
        return;
    }

    game.round++;
    game.decisions = {}; 
    saveToServer(); 
}

function manualReset() {
    if(confirm("¿Restaurar por completo la base de datos de Firebase?")) {
        game = { 
            round: 0, stability: 10, started: false, ended: false, organizations: [], decisions: {},
            shipPhase: { active: false, candidatesIds: [], currentIndex: 0, currentOffer: null, timerDeadline: null },
            lastGlobalNotice: "🔄 Los servidores de simulación han sido reiniciados.", roundDecisions: {}
        };
        db.ref("colapso2099").set(game).then(() => logout());
    }
}

// ==========================================
// RESTAURACIÓN DE INTERFAZ AUTOMÁTICA
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
    if (currentRole !== null) {
        document.getElementById("authScreen").style.display = "none";
        document.getElementById("gameScreen").style.display = "flex"; 

        if (currentRole === "admin") {
            document.getElementById("adminPanel").style.display = "block";
            document.getElementById("adminControls").style.display = "flex";
            document.getElementById("orgPanel").style.display = "none"; 
            document.getElementById("btnExitMenu").style.display = "block"; 
        } else {
            document.getElementById("adminPanel").style.display = "none";
            document.getElementById("adminControls").style.display = "none"; 
            document.getElementById("orgPanel").style.display = "block";
            document.getElementById("currentOrgLabel").innerText = currentOrgName;
            document.getElementById("btnExitMenu").style.display = "none"; 
        }
    }
});