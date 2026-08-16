/**
 * AppController - Production Application Controller & State Orchestrator
 * Next-Level Edition:
 * Handles StorageService, EditorEngine, AudioStudio, AIEngine, AnalyticsEngine, ExportImportService,
 * Command Palette (Ctrl+K), Habit Tracker, Time Capsules, Decoy Passcode, Lightbox & Media Gallery.
 */

class AppController {
    constructor() {
        this.entries = [];
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.currentYear = new Date().getFullYear();
        this.currentMonth = new Date().getMonth();
        this.editingId = null;

        this.currentFilter = 'all';
        this.searchTerm = '';
        this.searchType = 'all';
        this.currentView = 'calendar'; // 'calendar' | 'timeline' | 'gallery'

        this.editor = null;
        this.tempImage = null;
        this.tempAudio = null;
        this.isLocked = false;
        this.isDecoySession = false;

        // Command Palette setup
        this.commands = [
            { id: 'cmd_new', title: '✍️ Write New Memory', action: () => this.resetForm() },
            { id: 'cmd_search', title: '🔍 Focus Search Bar', action: () => document.getElementById('searchInput').focus() },
            { id: 'cmd_theme', title: '🎨 Change Theme Customizer', action: () => this.openThemeModal() },
            { id: 'cmd_profile', title: '👤 Open Profile & Achievements', action: () => this.openProfile() },
            { id: 'cmd_lock', title: '🔒 Lock Journal (Ctrl+L)', action: () => this.toggleLock() },
            { id: 'cmd_export_pdf', title: '📄 Export Current Day to PDF', action: () => ExportImportService.exportToPDF(this.selectedDate, document.getElementById('entryDisplay').innerHTML) },
            { id: 'cmd_export_json', title: '📦 Full JSON Backup Download', action: () => ExportImportService.exportToJSON(this.entries) },
            { id: 'cmd_ambient_rain', title: '🌧️ Toggle Rain Ambient Soundscape', action: () => audioStudio.toggleAmbientSoundscape('rain') },
            { id: 'cmd_ambient_focus', title: '🧠 Toggle Binaural Focus Soundscape', action: () => audioStudio.toggleAmbientSoundscape('binaural') },
            { id: 'cmd_ai_prompt', title: '🤖 Generate AI Reflection Prompt', action: () => this.toggleAIPrompt(true) },
            { id: 'cmd_surprise', title: '🎲 Memory Flashback Dice', action: () => this.surpriseMemory() }
        ];

        this.init();
    }

    async init() {
        await storageService.init();
        this.entries = await storageService.getAllEntries();

        this.editor = new EditorEngine('content', 'previewContainer');

        await this.checkLockState();
        this.bindEvents();

        if (!this.isLocked) {
            this.refreshUI();
            this.checkDraftRecovery();
            this.checkFlashbackMemory();
        }
    }

    // ==================== SECURITY & DECOY LOCK MANAGEMENT ====================

    async checkLockState() {
        const storedHash = await storageService.getSetting('journal_hash');
        const isLockedSetting = await storageService.getSetting('journal_locked', false);
        const isUnlockedSession = sessionStorage.getItem('journal_session_unlocked') === 'true';

        if (!storedHash) {
            this.isLocked = false;
            this.hideLockPage();
            return;
        }

        if (isLockedSetting && !isUnlockedSession) {
            this.isLocked = true;
            this.showLockPage();
        } else {
            this.isLocked = false;
            this.hideLockPage();
        }
    }

    showLockPage() {
        const lockPage = document.getElementById('lockPage');
        const mainApp = document.getElementById('mainApp');
        if (lockPage) lockPage.classList.remove('hidden');
        if (mainApp) mainApp.classList.add('hidden');
        const lockInput = document.getElementById('lockPassword');
        if (lockInput) { lockInput.value = ''; lockInput.focus(); }
    }

    hideLockPage() {
        const lockPage = document.getElementById('lockPage');
        const mainApp = document.getElementById('mainApp');
        if (lockPage) lockPage.classList.add('hidden');
        if (mainApp) mainApp.classList.remove('hidden');
    }

    async handleUnlock() {
        const input = document.getElementById('lockPassword').value;
        const lockError = document.getElementById('lockError');
        const storedHash = await storageService.getSetting('journal_hash');
        const decoyHash = await storageService.getSetting('journal_decoy_hash');

        if (!storedHash) {
            this.hideLockPage();
            return;
        }

        const inputHash = await StorageService.hashPassword(input);

        // Check master hash
        if (inputHash === storedHash) {
            this.isLocked = false;
            this.isDecoySession = false;
            sessionStorage.setItem('journal_session_unlocked', 'true');
            await storageService.setSetting('journal_locked', false);
            this.hideLockPage();
            this.showToast('🔓 Journal unlocked');
            this.refreshUI();
            return;
        }

        // Check decoy hash
        if (decoyHash && inputHash === decoyHash) {
            this.isLocked = false;
            this.isDecoySession = true;
            sessionStorage.setItem('journal_session_unlocked', 'true');
            this.entries = []; // Safe empty decoy view
            this.hideLockPage();
            this.showToast('🔓 Safe Decoy Session Active');
            this.refreshUI();
            return;
        }

        lockError.textContent = '❌ Incorrect password!';
        this.showToast('❌ Incorrect password', true);
    }

    async toggleLock() {
        const storedHash = await storageService.getSetting('journal_hash');

        if (!storedHash) {
            const pwd = prompt('🔒 Set a new master password (minimum 4 chars):');
            if (!pwd || pwd.length < 4) {
                this.showToast('Password must be at least 4 characters', true);
                return;
            }
            const hash = await StorageService.hashPassword(pwd);
            await storageService.setSetting('journal_hash', hash);
            await storageService.setSetting('journal_locked', true);
            sessionStorage.removeItem('journal_session_unlocked');
            this.isLocked = true;
            this.showLockPage();
            this.showToast('🔒 Passcode set & Journal locked');
            return;
        }

        if (!this.isLocked) {
            this.isLocked = true;
            await storageService.setSetting('journal_locked', true);
            sessionStorage.removeItem('journal_session_unlocked');
            this.showLockPage();
            this.showToast('🔒 Journal locked');
        } else {
            this.showLockPage();
        }
    }

    async setDecoyPassword() {
        const pwd = prompt('🕵️ Set a Decoy PIN/Passcode:');
        if (!pwd || pwd.length < 4) {
            this.showToast('Decoy password must be at least 4 characters', true);
            return;
        }
        const hash = await StorageService.hashPassword(pwd);
        await storageService.setSetting('journal_decoy_hash', hash);
        this.showToast('✅ Decoy Passcode configured');
    }

    // ==================== COMMAND PALETTE (CTRL + K) ====================

    openCommandPalette() {
        const modal = document.getElementById('commandPaletteModal');
        const input = document.getElementById('cmdInput');
        if (!modal || !input) return;

        modal.classList.remove('hidden');
        input.value = '';
        input.focus();
        this.renderCommandResults('');
    }

    closeCommandPalette() {
        const modal = document.getElementById('commandPaletteModal');
        if (modal) modal.classList.add('hidden');
    }

    renderCommandResults(query) {
        const container = document.getElementById('cmdResultsList');
        if (!container) return;

        const q = query.toLowerCase().trim();
        let matches = this.commands.filter(c => c.title.toLowerCase().includes(q));

        // Also search entry titles
        if (q.length > 1) {
            const entryMatches = this.entries
                .filter(e => e.title.toLowerCase().includes(q))
                .slice(0, 5)
                .map(e => ({
                    id: `entry_${e.id}`,
                    title: `📖 Memory: ${e.title} (${e.date})`,
                    action: () => this.selectDate(e.date)
                }));
            matches = [...matches, ...entryMatches];
        }

        if (matches.length === 0) {
            container.innerHTML = `<div style="padding:10px; color:var(--text-subtle); text-align:center;">No matching commands or memories</div>`;
            return;
        }

        container.innerHTML = matches.map((cmd, idx) => `
            <div class="cmd-item ${idx === 0 ? 'selected' : ''}" onclick="app.executeCommand('${cmd.id}')">
                <span>${cmd.title}</span>
                <i class="fas fa-level-down-alt" style="font-size:10px; opacity:0.5;"></i>
            </div>
        `).join('');

        this.activeCmdMatches = matches;
    }

    executeCommand(cmdId) {
        const cmd = (this.activeCmdMatches || this.commands).find(c => c.id === cmdId);
        this.closeCommandPalette();
        if (cmd && typeof cmd.action === 'function') {
            cmd.action();
        }
    }

    // ==================== EVENT BINDINGS ====================

    bindEvents() {
        document.getElementById('unlockBtn')?.addEventListener('click', () => this.handleUnlock());
        document.getElementById('lockPassword')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleUnlock();
        });

        document.getElementById('btnCmdPalette')?.addEventListener('click', () => this.openCommandPalette());
        document.getElementById('btnLock')?.addEventListener('click', () => this.toggleLock());
        document.getElementById('btnProfile')?.addEventListener('click', () => this.openProfile());
        document.getElementById('btnCloseProfile')?.addEventListener('click', () => this.closeProfile());
        document.getElementById('btnTheme')?.addEventListener('click', () => this.openThemeModal());
        document.getElementById('btnCloseThemeModal')?.addEventListener('click', () => this.closeThemeModal());

        document.getElementById('btnSetDecoyPassword')?.addEventListener('click', () => this.setDecoyPassword());

        document.getElementById('cmdInput')?.addEventListener('input', (e) => {
            this.renderCommandResults(e.target.value);
        });

        document.getElementById('btnDarkToggle')?.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');
            localStorage.setItem('journal_light_mode', isLight);
        });

        if (localStorage.getItem('journal_light_mode') === 'true') {
            document.body.classList.add('light-mode');
        }

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.target.dataset.theme;
                document.body.className = '';
                if (theme !== 'default') document.body.classList.add(`theme-${theme}`);
                if (localStorage.getItem('journal_light_mode') === 'true') document.body.classList.add('light-mode');
                localStorage.setItem('journal_active_theme', theme);
                this.closeThemeModal();
                this.showToast(`🎨 Theme updated: ${theme}`);
            });
        });

        // Sliders & Habit inputs
        document.getElementById('energyRange')?.addEventListener('input', (e) => {
            const val = document.getElementById('energyVal');
            if (val) val.textContent = e.target.value;
        });
        document.getElementById('focusRange')?.addEventListener('input', (e) => {
            const val = document.getElementById('focusVal');
            if (val) val.textContent = e.target.value;
        });

        document.getElementById('chkTimeCapsule')?.addEventListener('change', (e) => {
            const dt = document.getElementById('timeCapsuleDate');
            if (dt) dt.classList.toggle('hidden', !e.target.checked);
        });

        // Calendar navigation
        document.getElementById('prevMonth')?.addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('nextMonth')?.addEventListener('click', () => this.changeMonth(1));

        // View Toggles
        document.getElementById('btnViewCal')?.addEventListener('click', () => this.setView('calendar'));
        document.getElementById('btnViewTime')?.addEventListener('click', () => this.setView('timeline'));
        document.getElementById('btnViewGallery')?.addEventListener('click', () => this.setView('gallery'));

        // Search & Filter
        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.filterEntries();
        });

        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.filterEntries();
            });
        });

        // Formatting toolbar
        document.querySelectorAll('.rich-toolbar button').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                if (cmd) this.editor.format(cmd);
            });
        });

        // Form actions
        document.getElementById('btnSave')?.addEventListener('click', () => this.saveEntry());
        document.getElementById('btnVoiceDictate')?.addEventListener('click', () => this.toggleVoiceDictation());
        document.getElementById('btnVoiceRecord')?.addEventListener('click', () => this.toggleVoiceRecording());
        document.getElementById('btnStopVoiceRec')?.addEventListener('click', () => this.stopVoiceRecording());
        document.getElementById('btnAttachImage')?.addEventListener('click', () => this.attachImage());

        // Lightbox close
        document.getElementById('btnCloseLightbox')?.addEventListener('click', () => {
            document.getElementById('lightboxModal').classList.add('hidden');
        });

        // AI Assistant Buttons
        document.getElementById('btnAIReflect')?.addEventListener('click', () => this.toggleAIPrompt());
        document.getElementById('btnCloseAIPrompt')?.addEventListener('click', () => this.toggleAIPrompt(false));
        document.getElementById('btnNewPrompt')?.addEventListener('click', () => this.generateNewPrompt());
        document.getElementById('btnSurprise')?.addEventListener('click', () => this.surpriseMemory());
        document.getElementById('btnReport')?.addEventListener('click', () => this.showAISummary());

        // Ambient Soundscape Controls
        document.querySelectorAll('.soundscape-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                const active = audioStudio.toggleAmbientSoundscape(type);
                document.querySelectorAll('.soundscape-btn').forEach(b => b.classList.remove('active'));
                const label = document.getElementById('activeSoundscapeLabel');

                if (active) {
                    e.currentTarget.classList.add('active');
                    if (label) label.textContent = type.toUpperCase();
                } else {
                    if (label) label.textContent = 'Off';
                }
            });
        });

        document.getElementById('soundscapeVolume')?.addEventListener('input', (e) => {
            audioStudio.setAmbientVolume(parseFloat(e.target.value));
        });

        // Export/Import
        document.getElementById('btnExportPDF')?.addEventListener('click', () => {
            ExportImportService.exportToPDF(this.selectedDate, document.getElementById('entryDisplay').innerHTML);
        });

        document.getElementById('btnExportMD')?.addEventListener('click', () => {
            ExportImportService.exportToMarkdown(this.entries);
        });

        document.getElementById('btnExportJSON')?.addEventListener('click', () => {
            ExportImportService.exportToJSON(this.entries);
        });

        document.getElementById('btnImportJSON')?.addEventListener('click', () => {
            document.getElementById('importFileInput').click();
        });

        document.getElementById('importFileInput')?.addEventListener('change', async (e) => {
            try {
                const file = e.target.files[0];
                const imported = await ExportImportService.importFromJSON(file);
                this.entries = await storageService.replaceAllEntries(imported);
                this.refreshUI();
                this.showToast(`📥 Imported ${imported.length} memories`);
            } catch (err) {
                this.showToast(`❌ Import error: ${err.message}`, true);
            }
            e.target.value = '';
        });

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.openCommandPalette();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveEntry();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                this.toggleLock();
            }
            if (e.key === 'Escape') {
                this.closeCommandPalette();
                if (this.editingId) this.cancelEditing();
            }
        });
    }

    // ==================== MEMORY CRUD OPERATIONS ====================

    async saveEntry() {
        const title = document.getElementById('title').value.trim();
        const mood = document.getElementById('mood').value;
        const category = document.getElementById('category').value;
        const content = document.getElementById('content').value.trim();
        const tagsRaw = document.getElementById('tagsInput').value;
        const tags = tagsRaw.match(/#\w+/g)?.map(t => t.substring(1)) || [];

        // Habits & Energy Sliders
        const habits = {
            meditate: document.getElementById('habitMeditate')?.checked || false,
            read: document.getElementById('habitRead')?.checked || false,
            workout: document.getElementById('habitWorkout')?.checked || false,
            hydrate: document.getElementById('habitHydrate')?.checked || false,
        };
        const energy = parseInt(document.getElementById('energyRange')?.value || 7);
        const focus = parseInt(document.getElementById('focusRange')?.value || 8);

        // Time Capsule
        const isCapsule = document.getElementById('chkTimeCapsule')?.checked || false;
        const capsuleDate = document.getElementById('timeCapsuleDate')?.value || null;

        if (!title || !content) {
            this.showToast('Please fill in title and memory content', true);
            return;
        }

        const sentiment = aiEngine.analyzeSentiment(title + ' ' + content);

        if (this.editingId) {
            const idx = this.entries.findIndex(e => e.id === this.editingId);
            if (idx > -1) {
                this.entries[idx].title = title;
                this.entries[idx].mood = mood;
                this.entries[idx].category = category;
                this.entries[idx].content = content;
                this.entries[idx].tags = tags;
                this.entries[idx].habits = habits;
                this.entries[idx].energy = energy;
                this.entries[idx].focus = focus;
                this.entries[idx].isCapsule = isCapsule;
                this.entries[idx].capsuleDate = capsuleDate;
                this.entries[idx].timestamp = Date.now();
                this.entries[idx].sentiment = sentiment;
                if (this.tempImage) this.entries[idx].image = this.tempImage;
                if (this.tempAudio) this.entries[idx].audio = this.tempAudio;

                await storageService.saveEntry(this.entries[idx]);
                this.showToast('✏️ Memory updated');
            }
            this.editingId = null;
        } else {
            const newEntry = {
                id: Date.now(),
                date: this.selectedDate,
                title,
                mood,
                category,
                content,
                tags,
                habits,
                energy,
                focus,
                isCapsule,
                capsuleDate,
                timestamp: Date.now(),
                fav: false,
                image: this.tempImage,
                audio: this.tempAudio,
                sentiment
            };
            this.entries.push(newEntry);
            await storageService.saveEntry(newEntry);
            this.showToast('✨ Memory saved successfully');
        }

        this.resetForm();
        this.refreshUI();
        this.editor.clearDraft();
    }

    editEntry(id) {
        const entry = this.entries.find(e => e.id === id);
        if (!entry) return;

        document.getElementById('title').value = entry.title;
        document.getElementById('mood').value = entry.mood;
        document.getElementById('category').value = entry.category || 'General';
        document.getElementById('content').value = entry.content;
        document.getElementById('tagsInput').value = entry.tags ? entry.tags.map(t => '#' + t).join(' ') : '';

        if (entry.habits) {
            if (document.getElementById('habitMeditate')) document.getElementById('habitMeditate').checked = entry.habits.meditate;
            if (document.getElementById('habitRead')) document.getElementById('habitRead').checked = entry.habits.read;
            if (document.getElementById('habitWorkout')) document.getElementById('habitWorkout').checked = entry.habits.workout;
            if (document.getElementById('habitHydrate')) document.getElementById('habitHydrate').checked = entry.habits.hydrate;
        }

        this.editingId = id;
        document.getElementById('formTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Memory';
        document.getElementById('editingBadge').classList.remove('hidden');

        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.editor.updateStats();
        this.editor.autoResize();
    }

    async deleteEntry(id) {
        if (confirm('Are you sure you want to delete this memory?')) {
            this.entries = this.entries.filter(e => e.id !== id);
            await storageService.deleteEntry(id);
            this.refreshUI();
            this.showToast('🗑️ Memory deleted');
        }
    }

    async toggleFav(id) {
        const entry = this.entries.find(e => e.id === id);
        if (entry) {
            entry.fav = !entry.fav;
            await storageService.saveEntry(entry);
            this.refreshUI();
        }
    }

    cancelEditing() {
        this.editingId = null;
        this.resetForm();
        this.showToast('Edit cancelled');
    }

    resetForm() {
        document.getElementById('title').value = '';
        document.getElementById('content').value = '';
        document.getElementById('tagsInput').value = '';
        document.getElementById('mood').value = '😐 Neutral';
        document.getElementById('category').value = 'General';
        document.getElementById('formTitle').innerHTML = '<i class="fas fa-feather-alt"></i> Create Memory';
        document.getElementById('editingBadge').classList.add('hidden');
        this.tempImage = null;
        this.tempAudio = null;
        this.editor.updateStats();
    }

    // ==================== VOICE & MEDIA INTEGRATION ====================

    toggleVoiceDictation() {
        const btn = document.getElementById('btnVoiceDictate');
        audioStudio.toggleSpeech(
            (finalText) => {
                if (finalText) {
                    document.getElementById('content').value += finalText + ' ';
                    this.editor.updateStats();
                    this.editor.autoResize();
                }
            },
            (err) => this.showToast(`Voice Dictation Error: ${err}`, true),
            (isListening) => {
                if (isListening) {
                    btn.classList.add('btn-danger');
                    btn.innerHTML = '<i class="fas fa-microphone-slash"></i> Stop Listening';
                    this.showToast('🎤 Listening to voice dictation...');
                } else {
                    btn.classList.remove('btn-danger');
                    btn.innerHTML = '<i class="fas fa-microphone"></i> Voice Typing';
                    this.showToast('Voice dictation stopped');
                }
            }
        );
    }

    async toggleVoiceRecording() {
        const bar = document.getElementById('voiceRecorderBar');
        const canvas = document.getElementById('waveformCanvas');
        const timerEl = document.getElementById('voiceTimer');

        try {
            bar.classList.remove('hidden');
            await audioStudio.startVoiceRecording(canvas, (elapsedSec) => {
                const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
                const secs = String(elapsedSec % 60).padStart(2, '0');
                if (timerEl) timerEl.textContent = `${mins}:${secs}`;
            });
            this.showToast('🎙️ Recording voice note...');
        } catch (err) {
            bar.classList.add('hidden');
            this.showToast(`Microphone error: ${err.message}`, true);
        }
    }

    async stopVoiceRecording() {
        const bar = document.getElementById('voiceRecorderBar');
        bar.classList.add('hidden');
        const audioData = await audioStudio.stopVoiceRecording();
        if (audioData) {
            this.tempAudio = audioData;
            this.showToast('🎙️ Voice note recorded & attached');
        }
    }

    attachImage() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                this.tempImage = ev.target.result;
                this.showToast('📷 Photo memory attached');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    openLightbox(imgSrc, titleStr) {
        const modal = document.getElementById('lightboxModal');
        const img = document.getElementById('lightboxImage');
        const cap = document.getElementById('lightboxCaption');
        if (modal && img) {
            img.src = imgSrc;
            if (cap) cap.textContent = titleStr || '';
            modal.classList.remove('hidden');
        }
    }

    // ==================== REFRESH UI & FLASHBACKS ====================

    refreshUI() {
        this.renderCalendar();
        this.renderEntriesForSelectedDate();
        this.updateStats();
        this.filterEntries();

        analyticsEngine.renderHeatmap('annualHeatmapContainer', this.entries);
        analyticsEngine.renderEmotionTrendChart('emotionTrendChart', this.entries);
        analyticsEngine.renderTagCloud('tagCloudContainer', this.entries);

        const totalWords = this.entries.reduce((sum, e) => sum + (e.title + ' ' + e.content).split(/\s+/).length, 0);
        analyticsEngine.renderAchievements('achievementsContainer', this.entries, totalWords);
    }

    renderCalendar() {
        const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        const todayStr = new Date().toISOString().split('T')[0];

        const monthName = new Date(this.currentYear, this.currentMonth).toLocaleString('default', { month: 'long' });
        document.getElementById('monthYear').textContent = `${monthName} ${this.currentYear}`;

        let html = '';
        for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEntries = this.entries.filter(e => e.date === dateStr);
            const hasEntry = dayEntries.length > 0;
            const isSelected = this.selectedDate === dateStr;
            const isToday = todayStr === dateStr;

            let topMood = '';
            if (hasEntry) topMood = dayEntries[0].mood ? dayEntries[0].mood.split(' ')[0] : '😐';

            let classes = 'cal-day';
            if (hasEntry) classes += ' has-entry';
            if (isSelected) classes += ' selected';
            if (isToday) classes += ' today';

            html += `<div class="${classes}" onclick="app.selectDate('${dateStr}')">${day}${topMood ? `<span class="mood-badge">${topMood}</span>` : ''}</div>`;
        }

        document.getElementById('calendarGrid').innerHTML = html;
    }

    selectDate(dateStr) {
        this.selectedDate = dateStr;
        this.renderCalendar();
        this.renderEntriesForSelectedDate();
    }

    changeMonth(delta) {
        if (delta === 1 && this.currentMonth === 11) { this.currentMonth = 0; this.currentYear++; }
        else if (delta === -1 && this.currentMonth === 0) { this.currentMonth = 11; this.currentYear--; }
        else this.currentMonth += delta;
        this.renderCalendar();
    }

    renderEntriesForSelectedDate() {
        const headerEl = document.getElementById('selectedDateHeader');
        if (headerEl) {
            const d = new Date(this.selectedDate);
            headerEl.textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const dayEntries = this.entries
            .filter(e => e.date === this.selectedDate)
            .sort((a, b) => b.timestamp - a.timestamp);

        const countLabel = document.getElementById('entryCountLabel');
        if (countLabel) countLabel.textContent = `(${dayEntries.length})`;

        const container = document.getElementById('entryDisplay');
        if (!container) return;

        if (dayEntries.length === 0) {
            container.innerHTML = `<div class="empty-state" style="text-align:center; padding: 40px; color: var(--text-subtle);">✨ No memories recorded for this date. Write your thoughts above!</div>`;
            return;
        }

        container.innerHTML = dayEntries.map(e => {
            // Check Time Capsule Lock
            const isCapsuleLocked = e.isCapsule && e.capsuleDate && e.capsuleDate > todayStr;
            if (isCapsuleLocked) {
                return `
                    <div class="entry-item" style="border-left-color: var(--secondary);">
                        <div class="entry-header-row"><span class="entry-title">⏳ Time Capsule Locked</span></div>
                        <div class="entry-body" style="color:var(--secondary);">This memory is locked until <strong>${e.capsuleDate}</strong>. Stay tuned!</div>
                    </div>
                `;
            }

            return `
                <div class="entry-item">
                    <div class="entry-header-row">
                        <span class="entry-title">${e.title}</span>
                        <span style="font-size:18px;">${e.mood}</span>
                    </div>
                    <div class="entry-meta">
                        <span><i class="far fa-clock"></i> ${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>📂 ${e.category || 'General'}</span>
                        ${e.tags ? `<span>🏷️ ${e.tags.map(t => '#' + t).join(' ')}</span>` : ''}
                        ${e.energy ? `<span>⚡ Energy: ${e.energy}/10</span>` : ''}
                    </div>
                    <div class="entry-body">${EditorEngine.parseMarkdown(e.content)}</div>
                    ${e.image ? `<div style="margin-top:10px;"><img src="${e.image}" onclick="app.openLightbox('${e.image}', '${e.title}')" style="max-width:100%; max-height:220px; border-radius:10px; cursor:pointer;"></div>` : ''}
                    ${e.audio ? `<div style="margin-top:10px;"><audio controls src="${e.audio}" style="width:100%;"></audio></div>` : ''}
                    <div class="entry-actions-row">
                        <button class="btn-secondary btn-small" onclick="app.editEntry(${e.id})"><i class="fas fa-edit"></i> Edit</button>
                        <button class="btn-secondary btn-small" onclick="app.toggleFav(${e.id})">${e.fav ? '⭐ Favorited' : '☆ Favorite'}</button>
                        <button class="btn-secondary btn-small btn-danger" onclick="app.deleteEntry(${e.id})"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    checkFlashbackMemory() {
        const today = new Date();
        const pastYearStr = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()).toISOString().split('T')[0];

        const match = this.entries.find(e => e.date === pastYearStr);
        const widget = document.getElementById('flashbackWidget');
        const content = document.getElementById('flashbackContent');

        if (match && widget && content) {
            widget.classList.remove('hidden');
            content.innerHTML = `
                <div style="font-size:12px; font-weight:600;">Exactly 1 Year Ago:</div>
                <div style="color:var(--primary); font-size:13px; font-weight:700;">${match.title}</div>
                <div style="font-size:11px; color:var(--text-subtle);">${match.content.substring(0, 60)}...</div>
            `;
        }
    }

    setSearchTag(tagStr) {
        const input = document.getElementById('searchInput');
        if (input) {
            input.value = tagStr;
            this.searchTerm = tagStr.toLowerCase();
            this.filterEntries();
        }
    }

    filterEntries() {
        let filtered = [...this.entries];

        if (this.searchTerm) {
            filtered = filtered.filter(e => {
                const term = this.searchTerm;
                if (this.searchType === 'title') return e.title.toLowerCase().includes(term);
                if (this.searchType === 'content') return e.content.toLowerCase().includes(term);
                if (this.searchType === 'tags') return e.tags && e.tags.some(t => t.toLowerCase().includes(term));
                return e.title.toLowerCase().includes(term) || e.content.toLowerCase().includes(term);
            });
        }

        if (this.currentFilter !== 'all') {
            if (this.currentFilter === '⭐ Fav') filtered = filtered.filter(e => e.fav);
            else if (this.currentFilter === '📷 Photos') filtered = filtered.filter(e => e.image);
            else if (this.currentFilter === '🎙️ Audio') filtered = filtered.filter(e => e.audio);
            else filtered = filtered.filter(e => e.mood && e.mood.includes(this.currentFilter.split(' ')[1]));
        }

        if (this.currentView === 'timeline') this.updateTimeline(filtered);
        else if (this.currentView === 'gallery') this.updateMediaGallery(filtered);
    }

    setView(view) {
        this.currentView = view;
        document.getElementById('btnViewCal').classList.toggle('active', view === 'calendar');
        document.getElementById('btnViewTime').classList.toggle('active', view === 'timeline');
        document.getElementById('btnViewGallery').classList.toggle('active', view === 'gallery');

        document.getElementById('calendarContainer').classList.toggle('hidden', view !== 'calendar');
        document.getElementById('timelineContainer').classList.toggle('hidden', view !== 'timeline');
        document.getElementById('mediaGalleryContainer').classList.toggle('hidden', view !== 'gallery');

        if (view === 'timeline') this.updateTimeline();
        else if (view === 'gallery') this.updateMediaGallery();
    }

    updateTimeline(filteredList) {
        const list = filteredList || this.entries;
        const container = document.getElementById('timelineContainer');
        if (!container) return;

        if (list.length === 0) {
            container.innerHTML = `<div style="text-align:center; color: var(--text-subtle); padding: 20px;">No timeline entries found</div>`;
            return;
        }

        const sorted = [...list].sort((a, b) => b.timestamp - a.timestamp);
        container.innerHTML = sorted.slice(0, 30).map(e => `
            <div class="entry-item" onclick="app.selectDate('${e.date}')" style="cursor:pointer; margin-bottom:8px;">
                <div style="font-size:11px; color:var(--primary);">${e.date} • ${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div style="font-weight:600; font-size:14px;">${e.title} ${e.mood}</div>
                <div style="font-size:12px; color:var(--text-subtle);">${e.content.substring(0, 70)}...</div>
            </div>
        `).join('');
    }

    updateMediaGallery(filteredList) {
        const list = filteredList || this.entries;
        const mediaEntries = list.filter(e => e.image || e.audio);
        const container = document.getElementById('mediaGalleryContainer');
        if (!container) return;

        if (mediaEntries.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:var(--text-subtle); padding:20px;">No photos or audio memories yet</div>`;
            return;
        }

        container.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                ${mediaEntries.map(e => `
                    <div style="background:rgba(0,0,0,0.3); padding:8px; border-radius:8px;" onclick="app.selectDate('${e.date}')">
                        ${e.image ? `<img src="${e.image}" style="width:100%; height:80px; object-fit:cover; border-radius:6px;">` : ''}
                        ${e.audio ? `<div style="font-size:11px; color:var(--secondary); margin-top:4px;">🎙️ Audio Memory</div>` : ''}
                        <div style="font-size:10px; color:var(--text-subtle); margin-top:4px;">${e.date}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    updateStats() {
        document.getElementById('totalEntries').textContent = this.entries.length;
        const moods = new Set(this.entries.map(e => e.mood));
        document.getElementById('totalMoods').textContent = moods.size;

        const streak = analyticsEngine.calculateStreak(this.entries);
        document.getElementById('streakCount').textContent = streak;

        const totalWords = this.entries.reduce((sum, e) => sum + (e.title + ' ' + e.content).trim().split(/\s+/).length, 0);
        document.getElementById('wordCount').textContent = totalWords;
    }

    // ==================== AI & MODALS ====================

    toggleAIPrompt(forceState) {
        const box = document.getElementById('aiPromptBox');
        if (typeof forceState === 'boolean') {
            box.classList.toggle('hidden', !forceState);
        } else {
            box.classList.toggle('hidden');
        }
        if (!box.classList.contains('hidden')) {
            this.generateNewPrompt();
        }
    }

    generateNewPrompt() {
        const prompt = aiEngine.getRandomPrompt();
        document.getElementById('aiPromptText').textContent = prompt;
    }

    surpriseMemory() {
        if (this.entries.length === 0) {
            this.showToast('No memories saved yet', true);
            return;
        }
        const random = this.entries[Math.floor(Math.random() * this.entries.length)];
        this.selectDate(random.date);
        this.showToast(`🎲 Memory Flashback: ${random.title}`);
    }

    showAISummary() {
        const summaryHtml = aiEngine.generateSummary(this.entries);
        alert(summaryHtml.replace(/<br>/g, '\n').replace(/<\/?strong>/g, ''));
    }

    openProfile() {
        document.getElementById('profileOverlay').classList.remove('hidden');
        document.getElementById('profTotalEntries').textContent = this.entries.length;
        const totalWords = this.entries.reduce((sum, e) => sum + (e.title + ' ' + e.content).trim().split(/\s+/).length, 0);
        document.getElementById('profTotalWords').textContent = totalWords;
        document.getElementById('profStreak').textContent = analyticsEngine.calculateStreak(this.entries);

        analyticsEngine.renderAchievements('achievementsContainer', this.entries, totalWords);
    }

    closeProfile() { document.getElementById('profileOverlay').classList.add('hidden'); }
    openThemeModal() { document.getElementById('themeModal').classList.remove('hidden'); }
    closeThemeModal() { document.getElementById('themeModal').classList.add('hidden'); }

    checkDraftRecovery() {
        const draftTitle = localStorage.getItem('journal_draft_title');
        const draftContent = localStorage.getItem('journal_draft_content');
        if (draftTitle) document.getElementById('title').value = draftTitle;
        if (draftContent) document.getElementById('content').value = draftContent;
        if (draftTitle || draftContent) {
            this.showToast('📝 Draft restored');
        }
    }

    showToast(msg, isError = false) {
        const t = document.createElement('div');
        t.className = 'toast-notification' + (isError ? ' error' : '');
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    }
}

// Global App Instance
let app = null;
window.addEventListener('DOMContentLoaded', () => {
    app = new AppController();
});
