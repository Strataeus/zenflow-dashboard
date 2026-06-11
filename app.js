/* ==========================================================================
   FAST FLOW - APPLICATION LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initTimer();
    initAudioManager();
    initTickets();
    initDiagnostics();
});

/* ==========================================================================
   DATE HELPER FUNCTIONS
   ========================================================================== */
function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getPastDateString(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}`;
}

/* ==========================================================================
   STATE & DATA MANAGEMENT (With Pre-populated Pro Data)
   ========================================================================== */
const State = {
    tickets: JSON.parse(localStorage.getItem('fast_flow_tickets')),
    timer: {
        totalSeconds: 900, // 15 min default (Test Pont)
        remainingSeconds: 900,
        intervalId: null,
        isRunning: false,
        currentMode: 'work' // 'work', 'short', 'long'
    },
    diag: {
        currentEquip: null,
        currentNodeKey: null,
        history: [] // for going back
    }
};

// If no existing tickets, populate with professional mock data for testing
if (!State.tickets) {
    State.tickets = [
        { id: 101, client: "Garage du Centre (Paris)", equip: "Pont élévateur", gravity: "critical", status: "resolved", date: getPastDateString(1) },
        { id: 102, client: "Carrosserie Moderne (Versailles)", equip: "Cabine de peinture", gravity: "medium", status: "resolved", date: getPastDateString(2) },
        { id: 103, client: "Auto Service 92 (Nanterre)", equip: "Compresseur & Air", gravity: "minor", status: "resolved", date: getPastDateString(2) },
        { id: 104, client: "Lavage Pro (Créteil)", equip: "Station de lavage", gravity: "medium", status: "resolved", date: getPastDateString(4) },
        { id: 105, client: "Garage de l'Étoile (Paris)", equip: "Pont élévateur", gravity: "critical", status: "resolved", date: getPastDateString(5) },
        { id: 106, client: "Speed Auto (Saint-Denis)", equip: "Pont élévateur", gravity: "minor", status: "diagnostic", date: getPastDateString(0) },
        { id: 107, client: "Midas Melun", equip: "Compresseur & Air", gravity: "critical", status: "new", date: getPastDateString(0) }
    ];
    localStorage.setItem('fast_flow_tickets', JSON.stringify(State.tickets));
}

/* ==========================================================================
   DIAGNOSTIC TREE CONFIGURATION (FAST Remote Decision Tree)
   ========================================================================== */
const DiagnosticTree = {
    pont: {
        start: {
            text: "Le pont élévateur refuse-t-il de monter ?",
            yes: "moteur_tourne",
            no: "descente_bloquee"
        },
        moteur_tourne: {
            text: "Le moteur tourne-t-il lorsque vous appuyez sur la commande de montée ?",
            yes: "huile_hydraulique",
            no: "disjoncteur_thermique"
        },
        huile_hydraulique: {
            isResult: true,
            icon: "🛢️",
            title: "Niveau d'huile ou aspiration défaillante",
            text: "Le moteur tourne à vide. Cela indique généralement un niveau d'huile hydraulique insuffisant dans le réservoir, ou une prise d'air sur la ligne d'aspiration de la pompe.",
            action: "Vérifier le niveau d'huile dans le réservoir métallique et inspecter les raccords de la pompe hydraulique.",
            gravity: "medium"
        },
        disjoncteur_thermique: {
            text: "Le relais de protection thermique (disjoncteur dans l'armoire) a-t-il sauté ?",
            yes: "relais_surcharge",
            no: "contacteur_commande"
        },
        relais_surcharge: {
            isResult: true,
            icon: "⚡",
            title: "Surcharge électrique ou blocage mécanique",
            text: "Le disjoncteur thermique s'est déclenché pour protéger le moteur d'une surchauffe. Il y a probablement une surcharge mécanique (frottement, défaut d'alignement des colonnes) ou une baisse de tension réseau.",
            action: "Attendre 5 minutes, réarmer le disjoncteur thermique et contrôler l'intensité électrique absorbée avec une pince ampèremétrique.",
            gravity: "critical"
        },
        contacteur_commande: {
            isResult: true,
            icon: "🔌",
            title: "Circuit de commande 24V coupé",
            text: "Le moteur ne reçoit pas l'ordre de démarrage. Il s'agit probablement d'un contacteur défaillant, d'un interrupteur de fin de course bloqué en position haute, ou d'un bouton d'armoire cassé.",
            action: "Contrôler la présence de tension 24V AC sur la bobine du contacteur de montée lors de l'appui sur le bouton.",
            gravity: "medium"
        },
        descente_bloquee: {
            text: "Le pont refuse-t-il de descendre ?",
            yes: "verrous_pneumatiques",
            no: "aucun_defaut_majeur"
        },
        verrous_pneumatiques: {
            text: "Les loquets de sécurité mécanique s'effacent-ils visiblement lors de l'appui sur descente ?",
            yes: "electrovanne_descente",
            no: "pression_pneumatique"
        },
        pression_pneumatique: {
            isResult: true,
            icon: "💨",
            title: "Défaut d'effacement des verrous de sécurité",
            text: "Les verrous ne s'écartent pas. Il y a soit un manque d'alimentation en air comprimé pour les vérins de sécurité, soit une bobine d'électrovanne grillée.",
            action: "Vérifier la pression du réseau pneumatique (minimum 6 bars) et tester l'électrovanne de déverrouillage.",
            gravity: "critical"
        },
        electrovanne_descente: {
            isResult: true,
            icon: "🔧",
            title: "Obstruation électrovanne de descente",
            text: "Les verrous s'effacent mais le fluide hydraulique ne s'écoule pas pour faire descendre les bras. L'électrovanne de descente est probablement bloquée fermée ou non alimentée électriquement.",
            action: "Contrôler la tension d'alimentation sur l'électrovanne de descente et nettoyer le noyau pour éliminer les impuretés.",
            gravity: "medium"
        },
        aucun_defaut_majeur: {
            isResult: true,
            icon: "✅",
            title: "Fonctionnement nominal suspecté",
            text: "Aucune panne bloquante n'a été détectée d'après vos réponses.",
            action: "Réaliser une inspection visuelle des câbles de synchronisation et lubrifier les glissières des chariots.",
            gravity: "minor"
        }
    },
    cabine: {
        start: {
            text: "La cabine de peinture présente-t-elle une alarme de pression d'air / débit ?",
            yes: "filtres_recents",
            no: "bruleur_panne"
        },
        filtres_recents: {
            text: "Les filtres d'extraction (filtres au sol) ont-ils été remplacés récemment (moins de 50 heures de fonctionnement) ?",
            yes: "courroie_pressostat",
            no: "remplacer_filtres"
        },
        remplacer_filtres: {
            isResult: true,
            icon: "🩹",
            title: "Colmatage des filtres d'extraction",
            text: "La chute de pression est causée par l'encrassement des médias filtrants (filtres sol ou poches d'extraction). Cela bloque le débit d'air et met la cabine en sécurité.",
            action: "Procéder immédiatement au remplacement des filtres au sol et des préfiltres d'extraction.",
            gravity: "medium"
        },
        courroie_pressostat: {
            isResult: true,
            icon: "⚙️",
            title: "Détente courroie ou défaut pressostat",
            text: "Les filtres sont propres mais le débit d'air est insuffisant. Il y a probablement une courroie de transmission du moto-ventilateur qui glisse ou le tube de mesure du pressostat qui est encrassé.",
            action: "Inspecter la tension des courroies de ventilation dans le caisson d'extraction et souffler dans le tube silicone du pressostat.",
            gravity: "critical"
        },
        bruleur_panne: {
            text: "Le brûleur (chauffage gaz ou fioul) refuse-t-il de démarrer en cycle de cuisson ?",
            yes: "thermostat_securite",
            no: "sonde_temperature"
        },
        thermostat_securite: {
            text: "Le voyant rouge de surchauffe (sécurité thermique brûleur) est-il allumé sur le panneau ?",
            yes: "thermostat_declenche",
            no: "defaut_allumage"
        },
        thermostat_declenche: {
            isResult: true,
            icon: "🔥",
            title: "Déclenchement sécurité surchauffe",
            text: "Le thermostat de sécurité s'est déclenché suite à une élévation anormale de la température dans le plénum (souvent due à un arrêt précoce de la ventilation).",
            action: "Attendre le refroidissement complet du plénum, puis réarmer manuellement le thermostat de sécurité (bouton noir sous capot à l'arrière).",
            gravity: "medium"
        },
        defaut_allumage: {
            isResult: true,
            icon: "🕯️",
            title: "Défaut d'allumage ou vanne gaz bloquée",
            text: "Le brûleur essaie de démarrer mais se met en sécurité après quelques secondes. L'électrode d'allumage est soit usée/décalée, soit le capteur de flamme (cellule photoélectrique ou sonde d'ionisation) est encrassé.",
            action: "Nettoyer la sonde d'ionisation / cellule de contrôle et vérifier l'étincelle sur l'électrode.",
            gravity: "critical"
        },
        sonde_temperature: {
            isResult: true,
            icon: "🌡️",
            title: "Dérive de sonde de température",
            text: "La cabine fonctionne mais la régulation de température est instable ou absente. La sonde thermique PT100 est probablement hors tolérance.",
            action: "Mesurer la résistance de la sonde thermique à l'aide d'un multimètre et la remplacer si nécessaire.",
            gravity: "minor"
        }
    },
    compresseur: {
        start: {
            text: "Le compresseur fonctionne-t-il en continu sans jamais réguler (sans s'arrêter) ?",
            yes: "fuites_atelier",
            no: "refuse_demarrer"
        },
        fuites_atelier: {
            text: "Entendez-vous des fuites d'air importantes sur les raccords dans l'atelier ?",
            yes: "reparer_raccords",
            no: "clapet_antiretour"
        },
        reparer_raccords: {
            isResult: true,
            icon: "🌪️",
            title: "Fuites massives sur le réseau d'air",
            text: "Le compresseur tourne en continu car la demande en air dépasse sa capacité en raison de fuites sur le réseau fixe ou sur les outils pneumatiques.",
            action: "Faire le tour de l'atelier hors production pour identifier et remplacer les raccords rapides ou tuyaux fuyards.",
            gravity: "medium"
        },
        clapet_antiretour: {
            isResult: true,
            icon: "🔧",
            title: "Défaut clapet ou usure tête de compression",
            text: "Sans fuite apparente, le fait que la pression ne monte pas indique soit un clapet anti-retour bloqué ouvert, soit une usure prononcée des segments de pistons (tête de compression usée).",
            action: "Vérifier la température de la culasse et remplacer le clapet anti-retour situé à l'entrée de la cuve.",
            gravity: "critical"
        },
        refuse_demarrer: {
            text: "Le compresseur refuse-t-il totalement de démarrer ?",
            yes: "pression_cuve",
            no: "condensation_excessive"
        },
        pression_cuve: {
            text: "La cuve est-elle actuellement sous pression (aiguille du manomètre supérieure à 7 bars) ?",
            yes: "pression_nominale",
            no: "defaut_pressostat"
        },
        pression_nominale: {
            isResult: true,
            icon: "✅",
            title: "Fonctionnement normal (attente de baisse)",
            text: "Le pressostat bloque le démarrage car la cuve est déjà pleine. C'est le cycle normal de fonctionnement du compresseur.",
            action: "Utiliser de l'air dans l'atelier pour faire chuter la pression sous le seuil de démarrage (généralement 6 bars).",
            gravity: "minor"
        },
        defaut_pressostat: {
            isResult: true,
            icon: "🔌",
            title: "Pressostat défaillant ou thermique moteur déclenché",
            text: "La cuve est vide mais le compresseur ne démarre pas. Le pressostat ne ferme plus le contact ou le relais de protection électrique dans le coffret a disjoncté suite à une surcharge.",
            action: "Contrôler les contacts électriques du pressostat et mesurer la tension aux bornes du moteur.",
            gravity: "critical"
        },
        condensation_excessive: {
            isResult: true,
            icon: "💧",
            title: "Accumulation de condensation dans la cuve",
            text: "Présence d'eau importante dans l'air comprimé utilisé. Le purgeur de cuve est obstrué ou le sécheur d'air est éteint/en défaut.",
            action: "Purger manuellement la cuve du compresseur via la vanne inférieure et vérifier le point de rosée du sécheur d'air.",
            gravity: "medium"
        }
    },
    lavage: {
        start: {
            text: "La pression de lavage de la station est-elle anormalement basse ?",
            yes: "bruit_pompe",
            no: "portique_bloque"
        },
        bruit_pompe: {
            text: "La pompe haute pression fait-elle un bruit inhabituel de claquement/saccade ?",
            yes: "cavitation_eau",
            no: "buses_usees"
        },
        cavitation_eau: {
            isResult: true,
            icon: "🔊",
            title: "Cavitation par manque d'alimentation en eau",
            text: "Le claquement de la pompe est dû à la cavitation (présence de bulles d'air). L'alimentation en eau est insuffisante, soit à cause d'un filtre d'entrée colmaté, soit d'une baisse de débit du réseau.",
            action: "Arrêter la pompe, nettoyer le filtre d'arrivée d'eau et contrôler la pression du réseau d'eau d'alimentation.",
            gravity: "critical"
        },
        buses_usees: {
            isResult: true,
            icon: "🚿",
            title: "Clapets fuyards ou buses de lavage usées",
            text: "La pompe tourne normalement mais ne produit pas de pression. Les buses de lavage sont probablement trop agrandies par l'usure, ou des clapets internes de la pompe haute pression sont restés ouverts ou usés.",
            action: "Inspecter l'état des buses de projection et procéder au démontage des clapets de culasse de la pompe.",
            gravity: "medium"
        },
        portique_bloque: {
            text: "Le portique de lavage automatique refuse-t-il d'avancer (bloqué) ?",
            yes: "cellules_masquees",
            no: "crepines_produits"
        },
        cellules_masquees: {
            text: "Une cellule optique ou un capteur de positionnement est-il sale ou masqué par un obstacle ?",
            yes: "nettoyer_cellules",
            no: "variateur_translation"
        },
        nettoyer_cellules: {
            isResult: true,
            icon: "👁️",
            title: "Obstruction des cellules de détection",
            text: "Le système de sécurité bloque le mouvement car un faisceau optique est coupé ou masqué par des projections d'eau sale ou de produit.",
            action: "Nettoyer soigneusement les vitres des cellules optiques et vérifier l'alignement des catadioptres réfléchissants.",
            gravity: "minor"
        },
        variateur_translation: {
            isResult: true,
            icon: "⚡",
            title: "Défaut variateur moteur de translation",
            text: "Aucun obstacle physique détecté. Le moteur d'entraînement ou son variateur de fréquence dans l'armoire électrique est en défaut de surcharge.",
            action: "Couper l'alimentation générale, inspecter l'état mécanique des galets de guidage et contrôler le code défaut sur l'écran du variateur.",
            gravity: "critical"
        },
        crepines_produits: {
            isResult: true,
            icon: "🧪",
            title: "Défaut d'aspiration des produits chimiques",
            text: "Le lavage s'effectue sans mousse/cire. Les crépines d'aspiration dans les bidons de produits sont colmatées ou les pompes doseuses électromagnétiques sont désamorcées.",
            action: "Rincer à l'eau chaude les crépines de dosage et réamorcer manuellement les pompes doseuses.",
            gravity: "medium"
        }
    }
};

/* ==========================================================================
   AUDIO SYSTEM (Web Audio API Synthesizers)
   ========================================================================== */
class ZenAudioManager {
    constructor() {
        this.ctx = null;
        this.nodes = {
            rain: { source: null, gain: null, filter: null },
            ocean: { source: null, gain: null, filter: null, lfo: null }
        };
        this.noiseBuffer = null;
    }

    init() {
        if (this.ctx) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        // 5-second noise buffer
        const bufferSize = this.ctx.sampleRate * 5;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }

    createNoiseSource() {
        const source = this.ctx.createBufferSource();
        source.buffer = this.noiseBuffer;
        source.loop = true;
        return source;
    }

    // --- Pinkish Soft Noise (Bruit Rose) ---
    startRain(volume) {
        this.init();
        if (this.nodes.rain.source) return;

        const source = this.createNoiseSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        // Multi-stage lowpass filter to emulate pink noise (warmer, less bright than white)
        filter.type = 'lowpass';
        filter.frequency.value = 650;

        gain.gain.value = volume;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        source.start(0);

        this.nodes.rain = { source, gain, filter };
    }

    stopRain() {
        if (this.nodes.rain.source) {
            this.nodes.rain.source.stop();
            this.nodes.rain.source.disconnect();
            this.nodes.rain = { source: null, gain: null, filter: null };
        }
    }

    setRainVolume(volume) {
        if (this.nodes.rain.gain) {
            this.nodes.rain.gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        }
    }

    // --- LFO Waves Cycle ---
    startOcean(volume) {
        this.init();
        if (this.nodes.ocean.source) return;

        const source = this.createNoiseSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();

        filter.type = 'lowpass';
        filter.frequency.value = 320;

        lfo.type = 'sine';
        lfo.frequency.value = 0.10; // 10 second swell cycle

        lfoGain.gain.value = volume * 0.45; 
        gain.gain.value = volume * 0.55; 

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);

        source.start(0);
        lfo.start(0);

        this.nodes.ocean = { source, gain, filter, lfo, lfoGain };
    }

    stopOcean() {
        if (this.nodes.ocean.source) {
            this.nodes.ocean.source.stop();
            this.nodes.ocean.lfo.stop();
            this.nodes.ocean.source.disconnect();
            this.nodes.ocean.lfo.disconnect();
            this.nodes.ocean = { source: null, gain: null, filter: null, lfo: null };
        }
    }

    setOceanVolume(volume) {
        if (this.nodes.ocean.gain && this.nodes.ocean.lfoGain) {
            this.nodes.ocean.gain.gain.setValueAtTime(volume * 0.55, this.ctx.currentTime);
            this.nodes.ocean.lfoGain.gain.setValueAtTime(volume * 0.45, this.ctx.currentTime);
        }
    }

    // --- Alarm sound when cycle ends ---
    playAlarm() {
        this.init();
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const alarmGain = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
        osc1.frequency.linearRampToValueAtTime(880.00, this.ctx.currentTime + 0.4); // A5

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(293.66, this.ctx.currentTime); // D4

        alarmGain.gain.setValueAtTime(0, this.ctx.currentTime);
        alarmGain.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 0.05);
        alarmGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.95);

        osc1.connect(alarmGain);
        osc2.connect(alarmGain);
        alarmGain.connect(this.ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(this.ctx.currentTime + 1.0);
        osc2.stop(this.ctx.currentTime + 1.0);
    }
}

const audioManager = new ZenAudioManager();

function initAudioManager() {
    const soundToggles = document.querySelectorAll('.sound-toggle-btn');
    
    soundToggles.forEach(btn => {
        const soundType = btn.getAttribute('data-sound');
        const slider = document.getElementById(`volume-${soundType}`);
        
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            const isActive = btn.classList.contains('active');
            
            slider.disabled = !isActive;
            
            if (isActive) {
                if (soundType === 'rain') audioManager.startRain(parseFloat(slider.value));
                if (soundType === 'ocean') audioManager.startOcean(parseFloat(slider.value));
            } else {
                if (soundType === 'rain') audioManager.stopRain();
                if (soundType === 'ocean') audioManager.stopOcean();
            }
        });

        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (soundType === 'rain') audioManager.setRainVolume(val);
            if (soundType === 'ocean') audioManager.setOceanVolume(val);
        });
    });
}

/* ==========================================================================
   MAINTENANCE / PROCEDURES TIMER SYSTEM
   ========================================================================== */
function initTimer() {
    const timeDisplay = document.getElementById('time-display');
    const timerStatus = document.getElementById('timer-status');
    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');
    const btnReset = document.getElementById('btn-reset');
    const modeButtons = document.querySelectorAll('.mode-btn');
    const progressRing = document.getElementById('timer-progress-ring');
    
    const maxOffset = 534; // 2 * PI * r (85)

    function updateDisplay() {
        const minutes = Math.floor(State.timer.remainingSeconds / 60);
        const seconds = State.timer.remainingSeconds % 60;
        timeDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        const percentage = State.timer.remainingSeconds / State.timer.totalSeconds;
        progressRing.style.strokeDashoffset = maxOffset - (percentage * maxOffset);
    }

    function setMode(mode, totalTime, label) {
        clearInterval(State.timer.intervalId);
        State.timer.isRunning = false;
        State.timer.currentMode = mode;
        State.timer.totalSeconds = totalTime;
        State.timer.remainingSeconds = totalTime;
        
        timerStatus.textContent = 'Prêt';
        timerStatus.className = 'badge';
        
        modeButtons.forEach(btn => btn.classList.remove('active'));
        document.getElementById(mode).classList.add('active');
        
        btnStart.disabled = false;
        btnPause.disabled = true;
        btnStart.querySelector('span').textContent = 'Démarrer';
        
        updateDisplay();
    }

    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.id;
            const time = parseInt(btn.getAttribute('data-time'), 10);
            setMode(mode, time);
        });
    });

    btnStart.addEventListener('click', () => {
        if (State.timer.isRunning) return;
        
        audioManager.init(); // Init AudioContext on interaction
        
        State.timer.isRunning = true;
        btnStart.disabled = true;
        btnPause.disabled = false;
        timerStatus.textContent = 'En cours';
        timerStatus.className = 'badge status-active';
        
        State.timer.intervalId = setInterval(() => {
            if (State.timer.remainingSeconds > 0) {
                State.timer.remainingSeconds--;
                updateDisplay();
            } else {
                clearInterval(State.timer.intervalId);
                State.timer.isRunning = false;
                audioManager.playAlarm();
                
                timerStatus.textContent = 'Terminé';
                timerStatus.className = 'badge';
                btnStart.disabled = false;
                btnStart.querySelector('span').textContent = 'Relancer';
                btnPause.disabled = true;
                
                alert("Procédure de test terminée !");
            }
        }, 1000);
    });

    btnPause.addEventListener('click', () => {
        if (!State.timer.isRunning) return;
        
        clearInterval(State.timer.intervalId);
        State.timer.isRunning = false;
        btnStart.disabled = false;
        btnStart.querySelector('span').textContent = 'Reprendre';
        btnPause.disabled = true;
        timerStatus.textContent = 'Suspendu';
        timerStatus.className = 'badge';
    });

    btnReset.addEventListener('click', () => {
        clearInterval(State.timer.intervalId);
        State.timer.isRunning = false;
        State.timer.remainingSeconds = State.timer.totalSeconds;
        
        btnStart.disabled = false;
        btnPause.disabled = true;
        btnStart.querySelector('span').textContent = 'Démarrer';
        timerStatus.textContent = 'Prêt';
        timerStatus.className = 'badge';
        
        updateDisplay();
    });

    updateDisplay();
}

/* ==========================================================================
   TICKETS & INTERVENTIONS MANAGER (ZenDo Pro Upgrade)
   ========================================================================== */
function initTickets() {
    const ticketForm = document.getElementById('ticket-form');
    const ticketClient = document.getElementById('ticket-client');
    const ticketEquip = document.getElementById('ticket-equip');
    const ticketGravity = document.getElementById('ticket-gravity');
    const ticketsList = document.getElementById('tickets-list');
    const taskCounter = document.getElementById('task-counter');
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    let currentFilter = 'all';

    function saveTickets() {
        localStorage.setItem('fast_flow_tickets', JSON.stringify(State.tickets));
    }

    function renderTickets() {
        ticketsList.innerHTML = '';
        
        const filtered = State.tickets.filter(ticket => {
            if (currentFilter === 'all') return true;
            return ticket.status === currentFilter;
        });

        if (filtered.length === 0) {
            ticketsList.innerHTML = `
                <li class="empty-tasks" style="text-align: center; padding: 2rem; color: var(--text-dim);">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 0.5rem; display: block; opacity: 0.5;">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <p>Aucun ticket d'intervention trouvé</p>
                </li>`;
        } else {
            filtered.forEach(ticket => {
                const li = document.createElement('li');
                li.className = `ticket-item status-${ticket.status}`;
                li.innerHTML = `
                    <div class="ticket-details">
                        <div class="ticket-title-row">
                            <span class="gravity-dot ${ticket.gravity}" title="Gravité : ${ticket.gravity}"></span>
                            <span class="client-name">${escapeHTML(ticket.client)}</span>
                            <span class="equip-tag">${escapeHTML(ticket.equip)}</span>
                        </div>
                        <div class="ticket-meta">
                            <span class="ticket-date">Reçu le ${formatDateDisplay(ticket.date)}</span>
                            <select class="status-selector" data-id="${ticket.id}">
                                <option value="new" ${ticket.status === 'new' ? 'selected' : ''}>Nouveau</option>
                                <option value="diagnostic" ${ticket.status === 'diagnostic' ? 'selected' : ''}>En Diag</option>
                                <option value="scheduled" ${ticket.status === 'scheduled' ? 'selected' : ''}>Planifié</option>
                                <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>Résolu</option>
                            </select>
                        </div>
                    </div>
                    <button class="delete-task-btn" data-id="${ticket.id}" title="Supprimer">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                `;
                
                // Status inline selector listener
                li.querySelector('.status-selector').addEventListener('change', (e) => {
                    const id = parseInt(e.target.getAttribute('data-id'), 10);
                    const index = State.tickets.findIndex(t => t.id === id);
                    if (index !== -1) {
                        State.tickets[index].status = e.target.value;
                        saveTickets();
                        renderTickets();
                        drawResolvedChart(); // Redraw chart since states changed!
                    }
                });

                // Delete listener
                li.querySelector('.delete-task-btn').addEventListener('click', (e) => {
                    const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
                    State.tickets = State.tickets.filter(t => t.id !== id);
                    saveTickets();
                    renderTickets();
                    drawResolvedChart();
                });

                ticketsList.appendChild(li);
            });
        }

        // Update Statistics Badge
        const total = State.tickets.length;
        const resolved = State.tickets.filter(t => t.status === 'resolved').length;
        taskCounter.textContent = `${resolved} résolu${resolved > 1 ? 's' : ''} / ${total} total`;
    }

    ticketForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const client = ticketClient.value.trim();
        const equip = ticketEquip.value;
        const gravity = ticketGravity.value;
        
        if (!client || !equip || !gravity) return;

        const newTicket = {
            id: Date.now(),
            client: client,
            equip: equip,
            gravity: gravity,
            status: 'new',
            date: getTodayString()
        };

        State.tickets.unshift(newTicket);
        saveTickets();
        
        // Reset fields
        ticketClient.value = '';
        ticketEquip.selectedIndex = 0;
        ticketGravity.value = 'minor';
        
        renderTickets();
        drawResolvedChart();
    });

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderTickets();
        });
    });

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // Export to global namespace so diagnostic tool can call it
    window.addTicketFromDiagnostic = function(client, equip, gravity, diagDetails) {
        const descText = `Diagnostic Remote : ${diagDetails}`;
        const newTicket = {
            id: Date.now(),
            client: client,
            equip: equip,
            gravity: gravity,
            status: 'new',
            date: getTodayString()
        };
        State.tickets.unshift(newTicket);
        saveTickets();
        renderTickets();
        drawResolvedChart();
        
        // Scroll to tickets
        document.getElementById('tickets-section').scrollIntoView({ behavior: 'smooth' });
    };

    renderTickets();
}

/* ==========================================================================
   FAST REMOTE TELE-DIAGNOSTIC CONSOLE
   ========================================================================== */
function initDiagnostics() {
    const diagSelect = document.getElementById('diag-step-select');
    const diagQuestion = document.getElementById('diag-step-question');
    const diagResult = document.getElementById('diag-step-result');
    
    const equipButtons = document.querySelectorAll('.equip-btn');
    const questionText = document.getElementById('diag-question-text');
    const progressFill = document.getElementById('diag-progress');
    const btnYes = document.getElementById('btn-choice-yes');
    const btnNo = document.getElementById('btn-choice-no');
    const btnBack = document.getElementById('btn-diag-back');
    
    const resultIcon = document.getElementById('result-icon');
    const resultTitle = document.getElementById('result-title');
    const resultText = document.getElementById('result-text');
    const resultAction = document.getElementById('result-action');
    const btnCreateTicket = document.getElementById('btn-create-ticket-from-diag');
    const btnResetDiag = document.getElementById('btn-diag-reset');

    // Start Equipment Selection
    equipButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const equipKey = btn.getAttribute('data-equip');
            State.diag.currentEquip = equipKey;
            State.diag.currentNodeKey = 'start';
            State.diag.history = [];
            
            showStep('question');
            renderNode();
        });
    });

    function showStep(stepName) {
        diagSelect.classList.add('hidden');
        diagQuestion.classList.add('hidden');
        diagResult.classList.add('hidden');
        
        if (stepName === 'select') diagSelect.classList.remove('hidden');
        if (stepName === 'question') diagQuestion.classList.remove('hidden');
        if (stepName === 'result') diagResult.classList.remove('hidden');
    }

    function renderNode() {
        const equip = State.diag.currentEquip;
        const nodeKey = State.diag.currentNodeKey;
        const node = DiagnosticTree[equip][nodeKey];
        
        if (!node) return;

        // If it's a leaf node (Result)
        if (node.isResult) {
            resultIcon.textContent = node.icon;
            resultTitle.textContent = node.title;
            resultText.textContent = node.text;
            resultAction.textContent = node.action;
            
            showStep('result');
            return;
        }

        // Question Node
        questionText.textContent = node.text;
        
        // Progress emulation based on depth (max depth in tree ~ 4 steps)
        const depth = State.diag.history.length;
        const pct = Math.min(depth * 30 + 10, 95);
        progressFill.style.width = `${pct}%`;
    }

    function transitionTo(nextNodeKey) {
        State.diag.history.push(State.diag.currentNodeKey);
        State.diag.currentNodeKey = nextNodeKey;
        renderNode();
    }

    btnYes.addEventListener('click', () => {
        const equip = State.diag.currentEquip;
        const node = DiagnosticTree[equip][State.diag.currentNodeKey];
        if (node && node.yes) transitionTo(node.yes);
    });

    btnNo.addEventListener('click', () => {
        const equip = State.diag.currentEquip;
        const node = DiagnosticTree[equip][State.diag.currentNodeKey];
        if (node && node.no) transitionTo(node.no);
    });

    btnBack.addEventListener('click', () => {
        if (State.diag.history.length > 0) {
            State.diag.currentNodeKey = State.diag.history.pop();
            renderNode();
        } else {
            showStep('select');
        }
    });

    btnResetDiag.addEventListener('click', () => {
        showStep('select');
    });

    btnCreateTicket.addEventListener('click', () => {
        const equipNameMap = {
            pont: "Pont élévateur",
            cabine: "Cabine de peinture",
            compresseur: "Compresseur & Air",
            lavage: "Station de lavage"
        };
        
        const equip = equipNameMap[State.diag.currentEquip] || "Autre";
        const node = DiagnosticTree[State.diag.currentEquip][State.diag.currentNodeKey];
        
        if (window.addTicketFromDiagnostic) {
            window.addTicketFromDiagnostic(
                "FAST Remote Diagnostic", 
                equip, 
                node.gravity || "medium",
                node.title
            );
            
            alert("Un ticket d'intervention a été généré automatiquement à partir de votre télé-diagnostic !");
            showStep('select');
        }
    });
}

/* ==========================================================================
   ACTIVITY CHART (Interventions Résolues)
   ========================================================================== */
function drawResolvedChart() {
    const svg = document.getElementById('mood-chart-svg');
    if (!svg) return;

    const gridLinesGroup = svg.querySelector('.grid-lines');
    const chartLine = svg.querySelector('.chart-line');
    const chartArea = svg.querySelector('.chart-area');
    const pointsGroup = svg.querySelector('.chart-points');
    const labelsGroup = svg.querySelector('.chart-labels');

    // Generate last 7 days list
    const last7Days = [];
    const dayLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        last7Days.push({
            dateStr: dateStr,
            label: dayLabels[d.getDay()] + ' ' + d.getDate()
        });
    }

    // Calculate resolved tickets per day
    const resolutionMap = {};
    last7Days.forEach(day => {
        resolutionMap[day.dateStr] = 0;
    });

    State.tickets.forEach(t => {
        if (t.status === 'resolved' && resolutionMap[t.date] !== undefined) {
            resolutionMap[t.date]++;
        }
    });

    // Dimensions
    const width = 500;
    const height = 180;
    const paddingLeft = 30;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 25;
    
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Clean groups
    gridLinesGroup.innerHTML = '';
    pointsGroup.innerHTML = '';
    labelsGroup.innerHTML = '';

    // Max resolutions to plot (default to at least 4 for visual grid scaling)
    const maxVal = Math.max(...Object.values(resolutionMap), 3);

    // Map score value to Y coordinate
    function getY(val) {
        return paddingTop + chartHeight * (1 - val / maxVal);
    }

    function getX(index) {
        return paddingLeft + (chartWidth * (index / 6));
    }

    // Draw grid horizontal lines (from 0 to maxVal)
    const steps = maxVal > 6 ? 4 : maxVal;
    for (let i = 0; i <= steps; i++) {
        const val = Math.round((maxVal / steps) * i);
        const y = getY(val);
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', paddingLeft);
        line.setAttribute('y1', y);
        line.setAttribute('x2', width - paddingRight);
        line.setAttribute('y2', y);
        gridLinesGroup.appendChild(line);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', paddingLeft - 8);
        text.setAttribute('y', y + 3);
        text.setAttribute('text-anchor', 'end');
        text.setAttribute('class', 'chart-label');
        text.textContent = val;
        gridLinesGroup.appendChild(text);
    }

    // Calculate points coordinates
    const points = [];
    last7Days.forEach((day, index) => {
        const count = resolutionMap[day.dateStr];
        const x = getX(index);
        const y = getY(count);
        points.push({ x, y, count, label: day.label });
    });

    // Build SVG Path
    let dPath = '';
    points.forEach((pt, index) => {
        if (index === 0) {
            dPath += `M ${pt.x} ${pt.y}`;
        } else {
            // Cubic Bezier curve interpolation
            const prev = points[index - 1];
            const cpX1 = prev.x + (pt.x - prev.x) / 2;
            const cpY1 = prev.y;
            const cpX2 = prev.x + (pt.x - prev.x) / 2;
            const cpY2 = pt.y;
            dPath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${pt.x} ${pt.y}`;
        }
    });

    chartLine.setAttribute('d', dPath);

    if (points.length > 0) {
        const dArea = `${dPath} L ${points[points.length-1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
        chartArea.setAttribute('d', dArea);
    }

    // Draw markers & X labels
    points.forEach((pt, index) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pt.x);
        circle.setAttribute('cy', pt.y);
        circle.setAttribute('r', '5');
        circle.setAttribute('class', 'chart-point');
        circle.setAttribute('fill', pt.count > 0 ? 'var(--primary)' : 'var(--text-dim)');
        circle.setAttribute('stroke', 'var(--bg-primary)');
        circle.setAttribute('stroke-width', '1.5');
        
        const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        tooltip.textContent = `${pt.label}: ${pt.count} intervention(s) résolue(s)`;
        circle.appendChild(tooltip);
        
        pointsGroup.appendChild(circle);

        // Date Label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', pt.x);
        text.setAttribute('y', height - 5);
        text.setAttribute('class', 'chart-label');
        text.textContent = pt.label;
        labelsGroup.appendChild(text);
    });
}

// Global hook for chart drawing
window.drawResolvedChart = drawResolvedChart;
