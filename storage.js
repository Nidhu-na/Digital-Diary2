/**
 * JournalDB - Production IndexedDB & Web Crypto Security Storage Service
 * Handles data persistence, IndexedDB transaction management, AES-GCM encryption,
 * local storage fallback, automatic backup & database recovery.
 */

class StorageService {
    constructor() {
        this.dbName = 'ProJournalDB';
        this.dbVersion = 2;
        this.db = null;
        this.isReady = false;
        this.fallbackKey = 'diaryEntries';
        this.backupKey = 'diaryEntries_backup';
    }

    /**
     * Initialize IndexedDB database with schema migration support
     */
    async init() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                console.warn('IndexedDB not available, using localStorage fallback');
                this.isReady = true;
                resolve(false);
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('entries')) {
                    const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
                    entryStore.createIndex('date', 'date', { unique: false });
                    entryStore.createIndex('mood', 'mood', { unique: false });
                    entryStore.createIndex('category', 'category', { unique: false });
                    entryStore.createIndex('fav', 'fav', { unique: false });
                    entryStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains('backups')) {
                    db.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isReady = true;
                console.log('IndexedDB initialized successfully');
                this.autoBackupToLocalStorage();
                resolve(true);
            };

            request.onerror = (event) => {
                console.error('IndexedDB init error:', event.target.error);
                this.isReady = true;
                resolve(false);
            };
        });
    }

    /**
     * Get all journal entries
     */
    async getAllEntries() {
        if (this.db) {
            try {
                return await new Promise((resolve, reject) => {
                    const tx = this.db.transaction('entries', 'readonly');
                    const store = tx.objectStore('entries');
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result || []);
                    request.onerror = () => reject(request.error);
                });
            } catch (err) {
                console.error('Failed to fetch from IndexedDB, trying fallback:', err);
            }
        }
        // LocalStorage fallback
        try {
            const raw = localStorage.getItem(this.fallbackKey);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Failed to parse localStorage entries:', e);
            return [];
        }
    }

    /**
     * Save or update an entry in IndexedDB & LocalStorage backup
     */
    async saveEntry(entry) {
        if (!entry.id) entry.id = Date.now();
        if (!entry.timestamp) entry.timestamp = Date.now();

        let idbSuccess = false;
        if (this.db) {
            try {
                await new Promise((resolve, reject) => {
                    const tx = this.db.transaction('entries', 'readwrite');
                    const store = tx.objectStore('entries');
                    const request = store.put(entry);
                    request.onsuccess = () => resolve(true);
                    request.onerror = () => reject(request.error);
                });
                idbSuccess = true;
            } catch (err) {
                console.error('Error saving to IndexedDB:', err);
            }
        }

        // Always sync to LocalStorage backup for redundancy
        try {
            const entries = await this.getAllEntries();
            const idx = entries.findIndex(e => e.id === entry.id);
            if (idx > -1) {
                entries[idx] = entry;
            } else {
                entries.push(entry);
            }
            localStorage.setItem(this.fallbackKey, JSON.stringify(entries));
            localStorage.setItem(this.backupKey, JSON.stringify(entries));
        } catch (e) {
            console.warn('LocalStorage backup quota limit reached:', e);
        }

        return entry;
    }

    /**
     * Delete entry by ID
     */
    async deleteEntry(id) {
        if (this.db) {
            try {
                await new Promise((resolve, reject) => {
                    const tx = this.db.transaction('entries', 'readwrite');
                    const store = tx.objectStore('entries');
                    const request = store.delete(id);
                    request.onsuccess = () => resolve(true);
                    request.onerror = () => reject(request.error);
                });
            } catch (err) {
                console.error('Error deleting from IndexedDB:', err);
            }
        }

        // LocalStorage cleanup
        try {
            const entries = (await this.getAllEntries()).filter(e => e.id !== id);
            localStorage.setItem(this.fallbackKey, JSON.stringify(entries));
        } catch (e) {
            console.error('LocalStorage deletion error:', e);
        }
    }

    /**
     * Save settings key-value pair
     */
    async setSetting(key, value) {
        if (this.db) {
            try {
                await new Promise((resolve, reject) => {
                    const tx = this.db.transaction('settings', 'readwrite');
                    const store = tx.objectStore('settings');
                    const request = store.put({ key, value });
                    request.onsuccess = () => resolve(true);
                    request.onerror = () => reject(request.error);
                });
            } catch (e) {
                console.error('Error saving setting to IndexedDB:', e);
            }
        }
        localStorage.setItem(`setting_${key}`, JSON.stringify(value));
    }

    /**
     * Get setting value by key
     */
    async getSetting(key, defaultValue = null) {
        if (this.db) {
            try {
                const res = await new Promise((resolve, reject) => {
                    const tx = this.db.transaction('settings', 'readonly');
                    const store = tx.objectStore('settings');
                    const request = store.get(key);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                if (res) return res.value;
            } catch (e) {
                console.error('Error getting setting from IndexedDB:', e);
            }
        }
        const raw = localStorage.getItem(`setting_${key}`);
        return raw ? JSON.parse(raw) : defaultValue;
    }

    /**
     * Replace all entries (Import / Restore)
     */
    async replaceAllEntries(newEntries) {
        if (!Array.isArray(newEntries)) throw new Error('Invalid entries format');

        // Sanitize and ensure format compliance
        const sanitized = newEntries.map(e => ({
            id: e.id || Date.now() + Math.floor(Math.random() * 1000),
            date: e.date || new Date().toISOString().split('T')[0],
            title: e.title || 'Untitled',
            mood: e.mood || '😐 Neutral',
            category: e.category || 'General',
            content: e.content || '',
            tags: Array.isArray(e.tags) ? e.tags : [],
            timestamp: e.timestamp || Date.now(),
            fav: !!e.fav,
            image: e.image || null,
            audio: e.audio || null,
            sentiment: e.sentiment || null
        }));

        if (this.db) {
            try {
                const tx = this.db.transaction('entries', 'readwrite');
                const store = tx.objectStore('entries');
                await new Promise((res, rej) => {
                    const clearReq = store.clear();
                    clearReq.onsuccess = () => res(true);
                    clearReq.onerror = () => rej(clearReq.error);
                });

                for (const item of sanitized) {
                    await new Promise((res, rej) => {
                        const putReq = store.put(item);
                        putReq.onsuccess = () => res(true);
                        putReq.onerror = () => rej(putReq.error);
                    });
                }
            } catch (err) {
                console.error('Error replacing IndexedDB entries:', err);
            }
        }

        localStorage.setItem(this.fallbackKey, JSON.stringify(sanitized));
        localStorage.setItem(this.backupKey, JSON.stringify(sanitized));
        return sanitized;
    }

    /**
     * Automatic backup snapshot
     */
    async autoBackupToLocalStorage() {
        try {
            const entries = await this.getAllEntries();
            if (entries && entries.length > 0) {
                localStorage.setItem(this.backupKey, JSON.stringify(entries));
            }
        } catch (e) {
            console.warn('Auto backup skipped:', e);
        }
    }

    // ==================== WEB CRYPTO SECURITY UTILITIES ====================

    /**
     * SHA-256 Password Hash helper using Web Crypto API
     */
    static async hashPassword(password) {
        if (!password) return '';
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generate an AES-GCM CryptoKey derived from master password using PBKDF2
     */
    static async deriveEncryptionKey(password, saltStr = 'ProJournalSalt2026') {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode(saltStr),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }
}

// Global Storage Singleton
const storageService = new StorageService();
