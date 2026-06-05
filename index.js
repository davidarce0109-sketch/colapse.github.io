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

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let game = { round: 0, stability: 10, started: false, organizations: [], decisions: {} };
let currentRole = null;    
let currentOrgName = "";   

// --- ESCUCHAR CAMBIOS EN TIEMPO REAL (CORREGIDO) ---
db.ref("colapso2099").on("value", (snapshot) => {
    const data = snapshot.val();
    if (data) {
        game = data;
        if (!game.organizations) game.organizations = [];
        if (!game.decisions) game.decisions = {};
    } else {
        game = { round: 0, stability: 10, started: false, organizations: [], decisions: {} };
    }
    
    // Si estás logueado, actualiza la tabla en tiempo real
    if (currentRole !== null) {
        render();
    }
});

// Guardar datos en la nube
function saveToServer() {
    db.ref("colapso2099").set(game);
}

// ==========================================
// GESTIÓN DE ACCESO (REPARADO)
// ==========================================

function accessAsAdmin() {
    let password = prompt("Introduce la contraseña de Administrador:");
    if (password === "kaleidblood") {
        currentRole = "admin";
        
        // Forzamos al navegador a asegurar que los paneles se muestren/oculten bien
        document.getElementById("authScreen").style.display = "none";
        document.getElementById("gameScreen").style.display = "grid";
        document.getElementById("adminControls").style.display = "block";
        document.getElementById("orgPanel").style.display = "none"; 
        
        render(); // Forzar primer renderizado manual al entrar
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
    // 1. Limpiamos las variables de rol de inmediato
    currentRole = null;
    currentOrgName = "";
    
    // 2. CORRECCIÓN CRÍTICA: Forzar reset total de estilos del DOM para evitar congelamientos
    document.getElementById("gameScreen").style.display = "none";
    document.getElementById("adminControls").style.display = "none";
    document.getElementById("orgPanel").style.display = "none";
    
    // 3. Volver a mostrar la pantalla de selección limpida
    document.getElementById("authScreen").style.display = "block";
}