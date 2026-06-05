// ==========================================================================
// COLAPSO 2099 - LÓGICA CENTRAL CORREGIDA (REGISTRO MULTIPLE PARA ADMIN)
// ==========================================================================
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDj-JXmQQZEb9Sqal9BV98YXF_-dOq29Eo",
  authDomain: "colapse2099.firebaseapp.com",
  databaseURL: "https://colapse2099-default-rtdb.firebaseio.com",
  projectId: "colapse2099",
  storageBucket: "colapse2099.firebasestorage.app",
  messagingSenderId: "742926104267",
  appId: "1:742926104267:web:f3f5388819d82608310d4e",
  measurementId: "G-M2DTGFDJVV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Estado de juego local estructurado
let game = {
    round: 0,
    stability: 10,
    started: false,
    organizations: [], 
    decisions: {},
    ship_logs: [],      
    game_over_data: null 
};

let currentView = "player"; 

// Guardar de manera asíncrona en la nube de Firebase
async function saveOnline() {
    try {
        await set(gameRef, game);
    } catch (error) {
        console.error("Error al escribir en Firebase Realtime DB:", error);
    }
}

// Escucha en Tiempo Real activa: Sincroniza y re-renderiza ante cualquier cambio global
onValue(gameRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        game = data;
        if (!game.decisions) game.decisions = {};
        if (!game.ship_logs) game.ship_logs = [];
        if (!game.organizations) game.organizations = [];
        render();
    }
});

// Registrar funciones en el entorno Window (Global)
window.switchView = function(view) {
    if (view === "admin") {
        let pass = prompt("🔑 Introduce la contraseña de Administrador:");
        if (pass === "kaleidblood") {
            currentView = "admin";
            document.getElementById("adminView").style.display = "block";
            document.getElementById("playerRankingPanel").style.display = "none";
            document.getElementById("playerDecisionPanel").style.display = "none";
        } else {
            alert("❌ Contraseña incorrecta. Acceso denegado.");
            return;
        }
    } else {
        currentView = "player";
        document.getElementById("adminView").style.display = "none";
        document.getElementById("playerRankingPanel").style.display = "block";
        document.getElementById("playerDecisionPanel").style.display = "block";
    }
    render();
};

// 🛠️ REGISTRO CORREGIDO: El Administrador puede registrar todas las organizaciones que quiera
window.addOrganization = async function() { 
    let input = document.getElementById("organizationName"); 
    let name = input.value.trim();
    if (!name) return;

    // Insertar la organización en la lista global
    game.organizations.push({
        name,
        wealth: 0,
        scrap: 10,
        reputation: 0, 
        escape: false
    });

    input.value = "";
    await saveOnline();
    // Mensaje flotante rápido en la consola del admin
    console.log(`Organización "${name}" registrada por el Facilitador.`);
};

window.startGame = async function() {
    if(game.organizations.length === 0) return alert("Registra organizaciones primero.");
    game.started = true;
    game.round = 1;
    game.stability = 10;
    game.decisions = {};
    game.ship_logs = [];
    game.game_over_data = null;
    await saveOnline();
};

// 🔒 EL BLOQUEO SE EJECUTA AQUÍ: En el primer voto de cada dispositivo estudiante
window.sendDecision = async function(type) {
    if(!game.started) return alert("El Facilitador debe dar inicio a la partida.");

    let select = document.getElementById("organizationSelect"); 
    let idx = select.value;
    if(idx === "") return alert("Selecciona el nombre de tu organización de la lista.");

    // Obtener el candado del dispositivo actual
    let lockedOrg = localStorage.getItem("locked_organization");
    
    if (!lockedOrg) {
        // Es su primera acción: congelamos este celular con el índice de la organización seleccionada
        localStorage.setItem("locked_organization", idx);
        localStorage.setItem("my_registered_org", game.organizations[idx].name);
    } else if (lockedOrg !== idx) {
        // Intento de sabotaje detectado
        return alert("⚠️ Bloqueo de Terminal: Este dispositivo está asignado exclusivamente a otra organización.");
    }

    game.decisions[idx] = type;
    await saveOnline(); 

    let statusEl = document.getElementById("status");
    statusEl.innerHTML = `✅ ${game.organizations[idx].name}: Acción transmitida con éxito.`;
    setTimeout(() => { statusEl.innerText = "Esperando la resolución del Facilitador..."; }, 3000);
    render(); 
};

window.nextRound = async function() {
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

    // RECOPILAR CANDIDATOS ELEGIBLES PARA EL ASTILLERO
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

    // INTERROGAR A TODOS LOS CANDIDATOS HASTA EVALUAR LA LISTA COMPLETA
    for (let candidate of candidates) {
        let org = candidate.organization;
        let currentOwner = game.organizations.find(o => o.escape);

        if (org.escape) continue;

        let confirmMessage = currentOwner 
            ? `¡LA NAVE YA TIENE DUEÑO! ${org.name} tiene ${org.scrap} de Chatarra. ¿Quieres gastar 50 unidades para ROBARLE la única nave a la organización ${currentOwner.name}?`
            : `${org.name} tiene ${org.scrap} de Chatarra. ¿Construir la única Nave de Escape del planeta?`;

        if (confirm(confirmMessage)) {
            let timestamp = `[R${game.round}]`;
            if (currentOwner) {
                currentOwner.escape = false;
                game.ship_logs.push(`${timestamp} 🚨 <b>${org.name}</b> ROBÓ la nave a <b>${currentOwner.name}</b> (-50 Chatarra).`);
            } else {
                game.ship_logs.push(`${timestamp} 🚀 <b>${org.name}</b> CONSTRUYÓ la nave espacial (-50 Chatarra).`);
            }
            org.scrap -= 50;
            org.escape = true;
        }
    }

    if (game.stability <= 0) {
        let finalWinner = game.organizations.find(org => org.escape);
        let endText = finalWinner 
            ? `💥 COLAPSO TOTAL 💥\nLa Tierra ha sido destruida. ¡La organización dueña de la nave y única ganadora es: ${finalWinner.name}!`
            : `💥 COLAPSO TOTAL 💥\nLa Tierra ha sido destruida. Ninguna organización abordó la nave. Todos han muerto.`;
        
        let finalRanking = game.organizations.slice().sort((a, b) => b.wealth - a.wealth);
        game.game_over_data = generateTableHTML(finalRanking);
        
        alert(endText);
        game.started = false;
        await saveOnline();
        return;
    }

    if (game.round >= 5) {
        let winner;
        let finalRanking;

        if (game.stability >= 7) {
            finalRanking = game.organizations.slice().sort((a, b) => {
                if (b.wealth !== a.wealth) return b.wealth - a.wealth;
                if (b.reputation !== a.reputation) return b.reputation - a.reputation;
                return b.scrap - a.scrap;
            });
            winner = finalRanking[0];
            alert(`🏆 FIN DE LA PARTIDA 🏆\nEl planeta sobrevivió con alta estabilidad (${game.stability}/10).\nGanador principal por Riqueza:\n👉 ${winner.name} ($${winner.wealth.toFixed(1)})`);
        } else {
            finalRanking = game.organizations.slice().sort((a, b) => {
                if (b.reputation !== a.reputation) return b.reputation - a.reputation;
                if (b.wealth !== a.wealth) return b.wealth - a.wealth;
                return b.scrap - a.scrap;
            });
            winner = finalRanking[0];
            alert(`🏆 FIN DE LA PARTIDA 🏆\nEl planeta sobrevivió con baja estabilidad (${game.stability}/10).\nGanador principal por Reputación:\n👉 ${winner.name} (Rep: ${winner.reputation})`);
        }

        game.game_over_data = generateTableHTML(finalRanking);
        game.started = false;
        await saveOnline();
        return;
    }

    game.round++;
    game.decisions = {}; 
    await saveOnline();
};

window.manualReset = async function(silent = false) {
    if(silent || confirm("¿Borrar todo el árbol de datos y empezar de cero en Firebase? (Se limpiarán también los bloqueos locales)")) {
        game = { round: 0, stability: 10, started: false, organizations: [], decisions: {}, ship_logs: [], game_over_data: null };
        localStorage.removeItem("locked_organization");
        localStorage.removeItem("my_registered_org");
        await saveOnline();
    }
};

window.toggleAyuda = function(mostrar) {
    const modal = document.getElementById("modalAyuda");
    modal.style.display = mostrar ? "block" : "none";
};

function generateTableHTML(rankingList) {
    let html = `<table><tr><th>Organización</th><th>Riqueza</th><th>Reputación</th><th>Chatarra</th><th>Estado</th></tr>`;
    rankingList.forEach(org => {
        html += `<tr>
            <td>${org.name}</td>
            <td>$${org.wealth.toFixed(1)}</td>
            <td>${org.reputation || 0}</td>
            <td>${org.scrap}</td>
            <td>${org.escape ? '<span class="escape-badge">🚀 EN NAVE</span>' : '🌍 TIERRA'}</td>
        </tr>`;
    });
    html += "</table>";
    return html;
}

// RENDERIZADO INTELIGENTE
function render() {
    document.getElementById("round").innerText = game.round;
    document.getElementById("roundAdmin").innerText = game.round;
    
    let stabEl = document.getElementById("stability");
    let stabAdminEl = document.getElementById("stabilityAdmin");
    
    stabEl.innerText = game.stability;
    stabAdminEl.innerText = game.stability;
    
    let color = game.stability > 6 ? "#00ff99" : game.stability > 3 ? "#e6a23c" : "#ff5555";
    stabEl.style.color = color;
    stabAdminEl.style.color = color;

    let select = document.getElementById("organizationSelect"); 
    let currentSelectedValue = select.value; 
    
    // Obtener el candado del dispositivo actual
    let lockedOrg = localStorage.getItem("locked_organization");

    select.innerHTML = '<option value="">-- Seleccionar tu organización --</option>';
    if (game.organizations) {
        game.organizations.forEach((org, i) => {
            let op = document.createElement("option");
            op.value = i;
            op.textContent = org.name;
            select.appendChild(op);
        });
    }

    // CONTROL DE FLUJO SÓLO PARA VISTA JUGADOR
    if (currentView === "player" && lockedOrg !== null && game.organizations && game.organizations[lockedOrg]) {
        select.value = lockedOrg;
        select.disabled = true; // Congelar terminal del alumno
    } else {
        // Si es el administrador o no ha votado, el selector sigue libre y funcional
        select.value = currentSelectedValue;
        select.disabled = false;
    }

    // El input de administración NUNCA se bloquea si estamos en la vista de administrador
    let adminInput = document.getElementById("organizationName");
    if(adminInput) {
        if (currentView === "admin") {
            adminInput.disabled = false;
            adminInput.placeholder = "Nombre de la organización...";
        } else if (lockedOrg !== null) {
            adminInput.placeholder = `Terminal vinculada a: ${localStorage.getItem("my_registered_org")}`;
            adminInput.disabled = true;
        }
    }

    let orgsCopy = game.organizations ? game.organizations.slice() : [];
    let ranking = orgsCopy.sort((a, b) => b.wealth - a.wealth);
    document.getElementById("ranking").innerHTML = generateTableHTML(ranking);

    let logBox = document.getElementById("shipLog");
    if(game.ship_logs && game.ship_logs.length > 0) {
        logBox.innerHTML = game.ship_logs.map(log => `<div>${log}</div>`).join("");
    } else {
        logBox.innerHTML = "Ningún evento registrado aún.";
    }

    let reportDiv = document.getElementById("finalReport");
    if (game.game_over_data) {
        reportDiv.style.display = "block";
        document.getElementById("finalRankingTable").innerHTML = game.game_over_data;
    } else {
        reportDiv.style.display = "none";
    }
}

