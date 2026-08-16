/**
 * AnalyticsEngine - Production Data Visualization & Gamification Engine
 * Features:
 * 1. GitHub-style annual 365-day writing activity heatmap.
 * 2. Mood distribution doughnut & emotion timeline area charts using Chart.js.
 * 3. Achievement unlock engine with celebration canvas confetti bursts.
 * 4. Writing streak & word goal tracking.
 * 5. Tag cloud generator & Emotional Trajectory Line Chart.
 */

class AnalyticsEngine {
    constructor() {
        this.moodChartInstance = null;
        this.trendChartInstance = null;

        this.achievements = [
            { id: 'first_memory', icon: '🌱', name: 'First Seed', desc: 'Wrote your very first memory', check: (entries) => entries.length >= 1 },
            { id: 'streak_3', icon: '⚡', name: 'Spark', desc: 'Maintained a 3-day streak', check: (e, streak) => streak >= 3 },
            { id: 'streak_7', icon: '🔥', name: 'On Fire', desc: 'Maintained a 7-day streak', check: (e, streak) => streak >= 7 },
            { id: 'streak_30', icon: '🏆', name: 'Unstoppable', desc: 'Maintained a 30-day streak', check: (e, streak) => streak >= 30 },
            { id: 'words_1k', icon: '✍️', name: 'Scribe', desc: 'Wrote 1,000 total words', check: (e, s, words) => words >= 1000 },
            { id: 'words_10k', icon: '📚', name: 'Author', desc: 'Wrote 10,000 total words', check: (e, s, words) => words >= 10000 },
            { id: 'entries_25', icon: '🎯', name: 'Quarter Century', desc: 'Saved 25 memories', check: (entries) => entries.length >= 25 },
            { id: 'entries_100', icon: '💯', name: 'Centurion', desc: 'Saved 100 memories', check: (entries) => entries.length >= 100 },
            { id: 'voice_master', icon: '🎙️', name: 'Voice Note', desc: 'Attached an audio memory', check: (entries) => entries.some(e => e.audio) },
            { id: 'photo_collector', icon: '📷', name: 'Photographer', desc: 'Attached a photo memory', check: (entries) => entries.some(e => e.image) },
            { id: 'night_owl', icon: '🌙', name: 'Night Owl', desc: 'Wrote a memory past midnight', check: (entries) => entries.some(e => { const h = new Date(e.timestamp).getHours(); return h >= 0 && h < 4; }) },
            { id: 'perfect_week', icon: '🌟', name: '7/7 Perfect Week', desc: 'Wrote every single day this week', check: (entries) => this.checkPerfectWeek(entries) }
        ];
    }

    /**
     * Compute current consecutive writing streak in days
     */
    calculateStreak(entries) {
        if (!entries || entries.length === 0) return 0;
        const entryDates = new Set(entries.map(e => e.date));
        const today = new Date();

        let streak = 0;
        let d = new Date(today);

        const todayStr = d.toISOString().split('T')[0];
        d.setDate(d.getDate() - 1);
        const yesterdayStr = d.toISOString().split('T')[0];

        if (!entryDates.has(todayStr) && !entryDates.has(yesterdayStr)) {
            return 0;
        }

        d = new Date(today);
        while (true) {
            const ds = d.toISOString().split('T')[0];
            if (entryDates.has(ds)) {
                streak++;
                d.setDate(d.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    }

    checkPerfectWeek(entries) {
        if (!entries || entries.length < 7) return false;
        const entryDates = new Set(entries.map(e => e.date));
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            if (!entryDates.has(d.toISOString().split('T')[0])) return false;
        }
        return true;
    }

    /**
     * Render GitHub-style 365-day annual contribution heatmap
     */
    renderHeatmap(containerId, entries) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const dateCountMap = {};
        entries.forEach(e => {
            dateCountMap[e.date] = (dateCountMap[e.date] || 0) + 1;
        });

        const days = [];
        const today = new Date();
        for (let i = 364; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            days.push({
                date: dateStr,
                count: dateCountMap[dateStr] || 0
            });
        }

        let html = '<div class="heatmap-grid">';
        days.forEach(day => {
            let level = 0;
            if (day.count === 1) level = 1;
            else if (day.count === 2) level = 2;
            else if (day.count >= 3) level = 3;

            html += `<div class="heatmap-cell level-${level}" title="${day.date}: ${day.count} ${day.count === 1 ? 'entry' : 'entries'}"></div>`;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    /**
     * Render Emotional & Energy Trajectory Area/Line Chart using Chart.js
     */
    renderEmotionTrendChart(canvasId, entries) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp).slice(-14); // Last 14 entries

        if (sorted.length === 0) {
            if (this.trendChartInstance) this.trendChartInstance.destroy();
            return;
        }

        const labels = sorted.map(e => e.date.substring(5)); // MM-DD
        const energyData = sorted.map(e => e.energy || 7);
        const focusData = sorted.map(e => e.focus || 8);

        if (this.trendChartInstance) {
            this.trendChartInstance.destroy();
        }

        this.trendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Energy (1-10)',
                        data: energyData,
                        borderColor: '#a78bfa',
                        backgroundColor: 'rgba(167, 139, 250, 0.15)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Focus (1-10)',
                        data: focusData,
                        borderColor: '#34d399',
                        backgroundColor: 'rgba(52, 211, 153, 0.15)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { min: 0, max: 10, ticks: { color: 'rgba(255,255,255,0.6)' } },
                    x: { ticks: { color: 'rgba(255,255,255,0.6)' } }
                },
                plugins: {
                    legend: { labels: { color: 'rgba(255,255,255,0.8)', font: { family: 'Inter', size: 11 } } }
                }
            }
        });
    }

    /**
     * Render Interactive Tag Cloud
     */
    renderTagCloud(containerId, entries) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const tagMap = {};
        entries.forEach(e => {
            if (Array.isArray(e.tags)) {
                e.tags.forEach(t => tagMap[t] = (tagMap[t] || 0) + 1);
            }
        });

        const tags = Object.keys(tagMap);
        if (tags.length === 0) {
            container.innerHTML = '<div style="font-size:12px; color:var(--text-subtle);">No tags created yet</div>';
            return;
        }

        const maxCount = Math.max(...Object.values(tagMap));
        container.innerHTML = tags.map(t => {
            const count = tagMap[t];
            const fontSize = Math.min(22, Math.max(11, 11 + (count / maxCount) * 10));
            return `<span class="tag-cloud-item" style="font-size:${fontSize}px;" onclick="app.setSearchTag('${t}')">#${t} (${count})</span>`;
        }).join(' ');
    }

    /**
     * Evaluate & render unlocked achievements with Confetti Celebration
     */
    renderAchievements(containerId, entries, totalWords) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const streak = this.calculateStreak(entries);
        let newlyUnlocked = false;

        const unlockedSet = new Set(JSON.parse(localStorage.getItem('unlocked_achievements') || '[]'));

        const html = this.achievements.map(a => {
            const isUnlocked = a.check(entries, streak, totalWords);
            if (isUnlocked && !unlockedSet.has(a.id)) {
                unlockedSet.add(a.id);
                newlyUnlocked = true;
            }

            return `
                <div class="achievement-badge ${isUnlocked ? 'unlocked' : 'locked'}" title="${a.desc}">
                    <span class="icon">${a.icon}</span>
                    <span class="name">${a.name}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        localStorage.setItem('unlocked_achievements', JSON.stringify(Array.from(unlockedSet)));

        if (newlyUnlocked) {
            this.triggerConfetti();
        }
    }

    /**
     * Trigger celebration confetti effect
     */
    triggerConfetti() {
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    }
}

// Global Analytics Engine Singleton
const analyticsEngine = new AnalyticsEngine();
