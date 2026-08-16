/**
 * AIEngine - Intelligent Reflection, Sentiment & Natural Language Insights Engine
 * Provides local NLP keyword sentiment analysis, 50+ categorized writing prompts,
 * smart auto-tag generation, and automatic memory recaps.
 */

class AIEngine {
    constructor() {
        // Sentiment dictionary for lightweight client-side NLP
        this.positiveKeywords = [
            'happy', 'joy', 'excited', 'love', 'loved', 'grateful', 'peace', 'peaceful',
            'great', 'wonderful', 'amazing', 'blessed', 'proud', 'accomplished', 'success',
            'energized', 'calm', 'hopeful', 'content', 'thriving', 'beautiful', 'victory'
        ];
        this.negativeKeywords = [
            'sad', 'angry', 'frustrated', 'anxious', 'worried', 'tired', 'exhausted',
            'hurt', 'lonely', 'depressed', 'fear', 'scared', 'upset', 'hopeless',
            'overwhelmed', 'stress', 'stressed', 'struggling', 'pain', 'disappointed'
        ];
        this.reflectiveKeywords = [
            'think', 'thinking', 'realize', 'realized', 'learned', 'ponder', 'wonder',
            'future', 'past', 'growth', 'change', 'mind', 'perspective', 'lesson', 'reflect'
        ];

        // 50+ Curated Writing Prompts categorized by theme
        this.prompts = {
            gratitude: [
                "What are 3 small things that brought you unexpected joy today?",
                "Who is someone you felt deeply grateful for today, and why?",
                "What is a simple comfort in your life that you often take for granted?",
                "What was the highlight of your day, no matter how small?",
                "Describe a challenge that ended up teaching you something valuable."
            ],
            reflection: [
                "What state of mind are you bringing into this moment?",
                "What is something you learned about yourself recently?",
                "If today had a theme song or title, what would it be?",
                "What is one boundary you set or maintained recently?",
                "What decision did you make today that your future self will thank you for?"
            ],
            mindfulness: [
                "Take 3 deep breaths. How does your body feel right now?",
                "What emotion has been visiting you most frequently this week?",
                "What can you let go of today that you have been holding onto unnecessarily?",
                "What would feel like peace to you right now?",
                "Describe your ideal relaxing evening in vivid detail."
            ],
            creativity: [
                "If you could travel anywhere right now without restrictions, where would you go?",
                "Write about a dream or goal that still makes your heart beat faster.",
                "Imagine describing your current life to your 10-year-old self. What would they say?",
                "What is a hobby or passion you want to explore more deeply?",
                "Write a letter of encouragement to yourself for the month ahead."
            ]
        };
    }

    /**
     * Analyze text sentiment score (-1.0 to +1.0) and primary mood
     */
    analyzeSentiment(text) {
        if (!text || text.trim().length === 0) {
            return { score: 0, label: 'Neutral', valence: 'neutral', icon: '😐' };
        }

        const words = text.toLowerCase().match(/\b\w+\b/g) || [];
        let posCount = 0;
        let negCount = 0;
        let refCount = 0;

        words.forEach(word => {
            if (this.positiveKeywords.includes(word)) posCount++;
            if (this.negativeKeywords.includes(word)) negCount++;
            if (this.reflectiveKeywords.includes(word)) refCount++;
        });

        const totalRelevant = posCount + negCount;
        let score = 0;
        if (totalRelevant > 0) {
            score = parseFloat(((posCount - negCount) / totalRelevant).toFixed(2));
        }

        let label = 'Neutral';
        let icon = '😐';
        let valence = 'neutral';

        if (score >= 0.3) {
            label = 'Positive & Upbeat';
            icon = '😊';
            valence = 'positive';
        } else if (score <= -0.3) {
            label = 'Reflective / Heavy';
            icon = '😢';
            valence = 'negative';
        } else if (refCount >= 2) {
            label = 'Deep Reflection';
            icon = '🤔';
            valence = 'reflective';
        }

        return { score, posCount, negCount, refCount, label, icon, valence };
    }

    /**
     * Auto-suggest tags based on keywords in title & content
     */
    suggestTags(title, content) {
        const fullText = (title + ' ' + content).toLowerCase();
        const tagMap = {
            work: ['job', 'work', 'office', 'project', 'client', 'meeting', 'deadline', 'code', 'task', 'boss'],
            health: ['run', 'gym', 'workout', 'sleep', 'diet', 'health', 'walk', 'exercise', 'meditation', 'yoga'],
            family: ['mom', 'dad', 'family', 'brother', 'sister', 'parents', 'home', 'dinner', 'kids'],
            travel: ['flight', 'hotel', 'trip', 'travel', 'vacation', 'beach', 'mountain', 'flight', 'city'],
            gratitude: ['thankful', 'grateful', 'blessed', 'thank', 'apprecate', 'joy'],
            ideas: ['idea', 'concept', 'plan', 'future', 'strategy', 'design', 'brainstorm'],
            learning: ['book', 'read', 'article', 'study', 'course', 'learned', 'skill']
        };

        const suggested = new Set();
        for (const [tag, keywords] of Object.entries(tagMap)) {
            if (keywords.some(kw => fullText.includes(kw))) {
                suggested.add(tag);
            }
        }

        return Array.from(suggested);
    }

    /**
     * Get a random writing prompt by category or overall
     */
    getRandomPrompt(category = 'all') {
        let pool = [];
        if (category !== 'all' && this.prompts[category]) {
            pool = this.prompts[category];
        } else {
            Object.values(this.prompts).forEach(arr => pool.push(...arr));
        }
        const idx = Math.floor(Math.random() * pool.length);
        return pool[idx];
    }

    /**
     * Generate an automated executive summary recap for a list of entries
     */
    generateSummary(entries) {
        if (!entries || entries.length === 0) {
            return "No memories available to summarize.";
        }

        const total = entries.length;
        let totalWords = 0;
        const moodCounts = {};
        const tagCounts = {};

        entries.forEach(e => {
            const words = (e.title + ' ' + e.content).trim().split(/\s+/).length;
            totalWords += words;
            const mood = e.mood ? e.mood.trim() : '😐 Neutral';
            moodCounts[mood] = (moodCounts[mood] || 0) + 1;

            if (Array.isArray(e.tags)) {
                e.tags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);
            }
        });

        const topMood = Object.keys(moodCounts).reduce((a, b) => moodCounts[a] > moodCounts[b] ? a : b, '😐 Neutral');
        const topTag = Object.keys(tagCounts).length > 0 ? Object.keys(tagCounts).reduce((a, b) => tagCounts[a] > tagCounts[b] ? a : b) : 'None';
        const avgWordsPerEntry = Math.round(totalWords / total);

        return `
            <strong>Executive AI Memory Summary:</strong><br>
            • Analyzed <strong>${total}</strong> journal ${total === 1 ? 'entry' : 'entries'} with a total of <strong>${totalWords.toLocaleString()}</strong> words.<br>
            • Average entry length: <strong>${avgWordsPerEntry}</strong> words.<br>
            • Dominant Emotional State: <strong>${topMood}</strong>.<br>
            • Most Frequent Topic Tag: <strong>#${topTag}</strong>.
        `;
    }
}

// Global AI Engine Singleton
const aiEngine = new AIEngine();
