/* ==========================================================================
   ZENFLOW APPLICATION LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize components
    initTimer();
    initAudioManager();
    initTasks();
    initMoodTracker();
});

/* ==========================================================================
   STATE & DATA MANAGEMENT
   ========================================================================== */
const State = {
    tasks: JSON.parse(localStorage.getItem('zenflow_tasks')) || [
        { id: 1, text: "Faire 5 minutes de respiration profonde", completed: false },
        { id: 2, text: "Planifier les objectifs de la journée", completed: true },
        { id: 3, text: "S'hydrater (boire un verre d'eau)", completed: false }
    ],
    moodHistory: JSON.parse(localStorage.getItem('zenflow_moods')) || {}, // format: { 'YYYY-MM-DD': 1-5 }
    timer: {
        totalSeconds: 1500, // 25 min default
        remainingSeconds: 1500,
        intervalId: null,
        isRunning: false,
        currentMode: 'work' // 'work', 'short', 'long'
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
            ocean: { source: null, gain: null, filter: null, lfo: null },
            white: { source: null, gain: null, filter: null }
        };
        this.noiseBuffer = null;
    }

    init() {
        if (this.ctx) return;
        
        // Create Audio Context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        // Generate a 5-second white noise buffer to reuse
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

    // --- Rain Sound Synthesis ---
    startRain(volume) {
        this.init();
        if (this.nodes.rain.source) return;

        const source = this.createNoiseSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        // High frequency cutoff to simulate muffled drops
        filter.type = 'lowpass';
        filter.frequency.value = 800;

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

    // --- Ocean Waves Synthesis ---
    startOcean(volume) {
        this.init();
        if (this.nodes.ocean.source) return;

        const source = this.createNoiseSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();

        // Deeper sound for waves
        filter.type = 'lowpass';
        filter.frequency.value = 350;

        gain.gain.value = volume;

        // LFO modulates the gain slowly to simulate wave cycles (8s cycle)
        lfo.type = 'sine';
        lfo.frequency.value = 0.12; 

        // Modulate volume between 15% and 100% of selected volume
        lfoGain.gain.value = volume * 0.4; 
        gain.gain.value = volume * 0.6; 

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        // Connect LFO to modulate gain parameter
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
            this.nodes.ocean.gain.gain.setValueAtTime(volume * 0.6, this.ctx.currentTime);
            this.nodes.ocean.lfoGain.gain.setValueAtTime(volume * 0.4, this.ctx.currentTime);
        }
    }

    // --- White Noise Synthesis ---
    startWhite(volume) {
        this.init();
        if (this.nodes.white.source) return;

        const source = this.createNoiseSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        // Soft white noise (pinkish lowpass)
        filter.type = 'lowpass';
        filter.frequency.value = 1100;

        gain.gain.value = volume;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        source.start(0);

        this.nodes.white = { source, gain, filter };
    }

    stopWhite() {
        if (this.nodes.white.source) {
            this.nodes.white.source.stop();
            this.nodes.white.source.disconnect();
            this.nodes.white = { source: null, gain: null, filter: null };
        }
    }

    setWhiteVolume(volume) {
        if (this.nodes.white.gain) {
            this.nodes.white.gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        }
    }

    // --- Synthesize Pomodoro Completion Alarm ---
    playAlarm() {
        this.init();
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const alarmGain = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
        osc1.frequency.exponentialRampToValueAtTime(783.99, this.ctx.currentTime + 0.3); // G5

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(261.63, this.ctx.currentTime); // C4

        alarmGain.gain.setValueAtTime(0, this.ctx.currentTime);
        alarmGain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.05);
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
                if (soundType === 'white') audioManager.startWhite(parseFloat(slider.value));
            } else {
                if (soundType === 'rain') audioManager.stopRain();
                if (soundType === 'ocean') audioManager.stopOcean();
                if (soundType === 'white') audioManager.stopWhite();
            }
        });

        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (soundType === 'rain') audioManager.setRainVolume(val);
            if (soundType === 'ocean') audioManager.setOceanVolume(val);
            if (soundType === 'white') audioManager.setWhiteVolume(val);
        });
    });
}

/* ==========================================================================
   POMODORO TIMER SYSTEM
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
        
        // Update circular ring offset
        const percentage = State.timer.remainingSeconds / State.timer.totalSeconds;
        progressRing.style.strokeDashoffset = maxOffset - (percentage * maxOffset);
    }

    function setMode(mode, totalTime) {
        // Reset state
        clearInterval(State.timer.intervalId);
        State.timer.isRunning = false;
        State.timer.currentMode = mode;
        State.timer.totalSeconds = totalTime;
        State.timer.remainingSeconds = totalTime;
        
        // Update badges & UI
        timerStatus.textContent = mode === 'work' ? 'Concentration' : 'En Pause';
        timerStatus.className = `badge ${mode}`;
        
        modeButtons.forEach(btn => btn.classList.remove('active'));
        document.getElementById(`mode-${mode}`).classList.add('active');
        
        btnStart.disabled = false;
        btnPause.disabled = true;
        btnStart.querySelector('span').textContent = 'Démarrer';
        
        updateDisplay();
    }

    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.id.replace('mode-', '');
            const time = parseInt(btn.getAttribute('data-time'), 10);
            setMode(mode, time);
        });
    });

    btnStart.addEventListener('click', () => {
        if (State.timer.isRunning) return;
        
        audioManager.init(); // Initialize audio context on first click
        
        State.timer.isRunning = true;
        btnStart.disabled = true;
        btnPause.disabled = false;
        timerStatus.textContent = State.timer.currentMode === 'work' ? 'Concentration' : 'Pause';
        
        State.timer.intervalId = setInterval(() => {
            if (State.timer.remainingSeconds > 0) {
                State.timer.remainingSeconds--;
                updateDisplay();
            } else {
                // Timer finished
                clearInterval(State.timer.intervalId);
                State.timer.isRunning = false;
                audioManager.playAlarm();
                
                alert(`Session de ${State.timer.currentMode === 'work' ? 'travail' : 'pause'} terminée !`);
                
                // Auto switch mode
                if (State.timer.currentMode === 'work') {
                    setMode('short', 300); // 5 min break
                } else {
                    setMode('work', 1500); // 25 min work
                }
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
        timerStatus.textContent = 'En Pause';
    });

    btnReset.addEventListener('click', () => {
        clearInterval(State.timer.intervalId);
        State.timer.isRunning = false;
        State.timer.remainingSeconds = State.timer.totalSeconds;
        
        btnStart.disabled = false;
        btnPause.disabled = true;
        btnStart.querySelector('span').textContent = 'Démarrer';
        timerStatus.textContent = 'Prêt';
        
        updateDisplay();
    });

    // Initial draw
    updateDisplay();
}

/* ==========================================================================
   ZENDO (TASKS MANAGER)
   ========================================================================== */
function initTasks() {
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const tasksList = document.getElementById('tasks-list');
    const taskCounter = document.getElementById('task-counter');
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    let currentFilter = 'all';

    function saveTasks() {
        localStorage.setItem('zenflow_tasks', JSON.stringify(State.tasks));
    }

    function renderTasks() {
        tasksList.innerHTML = '';
        
        const filteredTasks = State.tasks.filter(task => {
            if (currentFilter === 'active') return !task.completed;
            if (currentFilter === 'completed') return task.completed;
            return true;
        });

        if (filteredTasks.length === 0) {
            tasksList.innerHTML = `
                <li class="empty-tasks">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <p>Aucune tâche disponible</p>
                </li>`;
        } else {
            filteredTasks.forEach(task => {
                const li = document.createElement('li');
                li.className = `task-item ${task.completed ? 'completed' : ''}`;
                li.innerHTML = `
                    <div class="task-item-left">
                        <label class="checkbox-container">
                            <input type="checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
                            <span class="checkmark"></span>
                        </label>
                        <span class="task-text">${escapeHTML(task.text)}</span>
                    </div>
                    <button class="delete-task-btn" data-id="${task.id}" title="Supprimer">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                `;
                
                // Toggle complete listener
                li.querySelector('input').addEventListener('change', (e) => {
                    const id = parseInt(e.target.getAttribute('data-id'), 10);
                    const taskIndex = State.tasks.findIndex(t => t.id === id);
                    if (taskIndex !== -1) {
                        State.tasks[taskIndex].completed = e.target.checked;
                        saveTasks();
                        renderTasks();
                    }
                });

                // Delete listener
                li.querySelector('.delete-task-btn').addEventListener('click', (e) => {
                    const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
                    State.tasks = State.tasks.filter(t => t.id !== id);
                    saveTasks();
                    renderTasks();
                });

                tasksList.appendChild(li);
            });
        }

        // Update Counter
        const total = State.tasks.length;
        const completed = State.tasks.filter(t => t.completed).length;
        taskCounter.textContent = `${completed} / ${total}`;
    }

    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = taskInput.value.trim();
        if (!text) return;

        const newTask = {
            id: Date.now(),
            text: text,
            completed: false
        };

        State.tasks.unshift(newTask);
        saveTasks();
        taskInput.value = '';
        renderTasks();
    });

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderTasks();
        });
    });

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // Initial render
    renderTasks();
}

/* ==========================================================================
   MOOD & WELL-BEING TRACKER
   ========================================================================== */
function initMoodTracker() {
    const moodButtons = document.querySelectorAll('.mood-btn');
    
    function getTodayString() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function saveMood(score) {
        const today = getTodayString();
        State.moodHistory[today] = score;
        localStorage.setItem('zenflow_moods', JSON.stringify(State.moodHistory));
        updateMoodButtons();
        drawMoodChart();
    }

    function updateMoodButtons() {
        const today = getTodayString();
        const todayMood = State.moodHistory[today];
        
        moodButtons.forEach(btn => {
            const score = parseInt(btn.getAttribute('data-mood'), 10);
            if (score === todayMood) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    moodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const score = parseInt(btn.getAttribute('data-mood'), 10);
            saveMood(score);
        });
    });

    // Helper to get past 7 days dates and names
    function getLast7Days() {
        const days = [];
        const locales = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            days.push({
                dateStr: dateStr,
                label: locales[d.getDay()] + ' ' + d.getDate()
            });
        }
        return days;
    }

    function drawMoodChart() {
        const svg = document.getElementById('mood-chart-svg');
        if (!svg) return;

        const gridLinesGroup = svg.querySelector('.grid-lines');
        const chartLine = svg.querySelector('.chart-line');
        const chartArea = svg.querySelector('.chart-area');
        const pointsGroup = svg.querySelector('.chart-points');
        const labelsGroup = svg.querySelector('.chart-labels');

        const last7Days = getLast7Days();
        
        // Dimensions
        const width = 500;
        const height = 180;
        const paddingLeft = 35;
        const paddingRight = 20;
        const paddingTop = 20;
        const paddingBottom = 25;
        
        const chartWidth = width - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;

        // Clean previous points and labels
        gridLinesGroup.innerHTML = '';
        pointsGroup.innerHTML = '';
        labelsGroup.innerHTML = '';

        // Mood values mapping (1-5 to y-coordinates)
        // 5 is top (highest score), 1 is bottom
        function getY(score) {
            const value = score ? score : 3; // default to neutral if empty
            // map [1, 5] to [height-paddingBottom, paddingTop]
            return paddingTop + (chartHeight * (1 - (value - 1) / 4));
        }

        function getX(index) {
            return paddingLeft + (chartWidth * (index / 6));
        }

        // Draw horizontal grid lines (for scores 1 to 5)
        for (let i = 1; i <= 5; i++) {
            const y = getY(i);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', paddingLeft);
            line.setAttribute('y1', y);
            line.setAttribute('x2', width - paddingRight);
            line.setAttribute('y2', y);
            gridLinesGroup.appendChild(line);

            // Add Y axis labels (scores values)
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', paddingLeft - 10);
            text.setAttribute('y', y + 3);
            text.setAttribute('text-anchor', 'end');
            text.setAttribute('class', 'chart-label');
            text.textContent = i === 5 ? '✨' : i === 1 ? '😰' : i;
            gridLinesGroup.appendChild(text);
        }

        // Calculate points
        const points = [];
        last7Days.forEach((day, index) => {
            const score = State.moodHistory[day.dateStr] || null; // null means no record yet
            const x = getX(index);
            const y = getY(score);
            points.push({ x, y, score, label: day.label, dateStr: day.dateStr });
        });

        // Generate SVG Path
        let dPath = '';
        points.forEach((pt, index) => {
            if (index === 0) {
                dPath += `M ${pt.x} ${pt.y}`;
            } else {
                // Smooth cubic bezier curves
                const prevPt = points[index - 1];
                const cpX1 = prevPt.x + (pt.x - prevPt.x) / 2;
                const cpY1 = prevPt.y;
                const cpX2 = prevPt.x + (pt.x - prevPt.x) / 2;
                const cpY2 = pt.y;
                dPath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${pt.x} ${pt.y}`;
            }
        });

        // Set line path
        chartLine.setAttribute('d', dPath);
        
        // Generate Area Path (closing the loop at the bottom)
        if (points.length > 0) {
            const dArea = `${dPath} L ${points[points.length-1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
            chartArea.setAttribute('d', dArea);
        }

        // Draw circles & Labels
        points.forEach((pt, index) => {
            // Draw interactive points
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', pt.x);
            circle.setAttribute('cy', pt.y);
            circle.setAttribute('r', pt.score ? 6 : 4);
            circle.setAttribute('class', 'chart-point');
            circle.setAttribute('fill', pt.score ? 'url(#chart-grad)' : 'var(--text-dim)');
            circle.setAttribute('stroke', pt.score ? 'var(--bg-primary)' : 'rgba(255,255,255,0.1)');
            circle.setAttribute('stroke-width', '2');
            
            // Add a title tooltip
            const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            tooltip.textContent = pt.score ? `${pt.label}: Humeur ${pt.score}/5` : `${pt.label}: Non enregistré`;
            circle.appendChild(tooltip);
            
            pointsGroup.appendChild(circle);

            // Add X axis labels (Dates)
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', pt.x);
            text.setAttribute('y', height - 5);
            text.setAttribute('class', 'chart-label');
            text.textContent = pt.label;
            labelsGroup.appendChild(text);
        });
    }

    // Initial load
    updateMoodButtons();
    drawMoodChart();
}
