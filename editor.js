/**
 * EditorEngine - Hybrid Rich Text & Markdown Editor Controller
 * Supports formatting commands, live markdown parsing, draft recovery,
 * word count statistics, reading time calculations, and focus editing.
 */

class EditorEngine {
    constructor(textareaId, previewContainerId) {
        this.textarea = document.getElementById(textareaId);
        this.previewContainer = document.getElementById(previewContainerId);
        this.mode = 'edit'; // 'edit' | 'split' | 'preview'
        this.autoSaveTimer = null;
        
        this.initListeners();
    }

    initListeners() {
        if (!this.textarea) return;

        this.textarea.addEventListener('input', () => {
            this.updateStats();
            this.autoResize();
            if (this.mode === 'split' || this.mode === 'preview') {
                this.renderPreview();
            }
            this.triggerDraftSave();
        });

        // Tab indent support
        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                this.insertText('  ', '');
            }
        });
    }

    /**
     * Insert text or markdown wrapper at cursor selection
     */
    insertText(prefix, suffix = '') {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const selectedText = this.textarea.value.substring(start, end);
        const replacement = prefix + selectedText + suffix;

        this.textarea.value = this.textarea.value.substring(0, start) + replacement + this.textarea.value.substring(end);
        
        this.textarea.focus();
        if (selectedText.length > 0) {
            this.textarea.selectionStart = start;
            this.textarea.selectionEnd = start + replacement.length;
        } else {
            this.textarea.selectionStart = start + prefix.length;
            this.textarea.selectionEnd = start + prefix.length;
        }

        this.updateStats();
        this.autoResize();
    }

    /**
     * Execute formatting command
     */
    format(type) {
        switch (type) {
            case 'bold':
                this.insertText('**', '**');
                break;
            case 'italic':
                this.insertText('*', '*');
                break;
            case 'underline':
                this.insertText('<u>', '</u>');
                break;
            case 'strikethrough':
                this.insertText('~~', '~~');
                break;
            case 'h1':
                this.insertText('# ');
                break;
            case 'h2':
                this.insertText('## ');
                break;
            case 'ul':
                this.insertText('- ');
                break;
            case 'ol':
                this.insertText('1. ');
                break;
            case 'task':
                this.insertText('- [ ] ');
                break;
            case 'quote':
                this.insertText('> ');
                break;
            case 'code':
                this.insertText('```\n', '\n```');
                break;
            case 'highlight':
                this.insertText('<mark>', '</mark>');
                break;
            case 'clear':
                if (this.textarea.value && confirm('Clear editor contents?')) {
                    this.textarea.value = '';
                    this.updateStats();
                    this.autoResize();
                }
                break;
        }
    }

    /**
     * Compute statistics: words, characters, sentences, reading time
     */
    getStats() {
        const text = this.textarea.value || '';
        const words = text.trim() ? text.trim().split(/\s+/).filter(w => w.length > 0).length : 0;
        const chars = text.length;
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        const readingTime = Math.ceil(words / 200); // Average 200 WPM

        return { words, chars, sentences, readingTime };
    }

    updateStats() {
        const { words, chars, readingTime } = this.getStats();
        const wordEl = document.getElementById('wordCounter');
        const charEl = document.getElementById('charCounter');
        const readEl = document.getElementById('readTimeCounter');

        if (wordEl) wordEl.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
        if (charEl) charEl.textContent = `${chars} chars`;
        if (readEl) readEl.textContent = `~${readingTime} min read`;
    }

    autoResize() {
        if (!this.textarea) return;
        this.textarea.style.height = 'auto';
        this.textarea.style.height = Math.max(120, this.textarea.scrollHeight) + 'px';
    }

    triggerDraftSave() {
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            const title = document.getElementById('title')?.value || '';
            const content = this.textarea.value || '';
            if (title || content) {
                localStorage.setItem('journal_draft_title', title);
                localStorage.setItem('journal_draft_content', content);
            }
        }, 1500);
    }

    clearDraft() {
        localStorage.removeItem('journal_draft_title');
        localStorage.removeItem('journal_draft_content');
    }

    /**
     * Full Markdown Parser with HTML Safety & Extended Syntax
     */
    static parseMarkdown(text) {
        if (!text) return '';

        // Escape dangerous tags while preserving safe formatting
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Restore allowed tags (<mark>, <u>, <strong>, <em>, <s>)
        html = html
            .replace(/&lt;mark&gt;/g, '<mark>')
            .replace(/&lt;\/mark&gt;/g, '</mark>')
            .replace(/&lt;u&gt;/g, '<u>')
            .replace(/&lt;\/u&gt;/g, '</u>');

        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Bold & Italic & Strikethrough
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

        // Code blocks
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Task List & Bullet List parsing line-by-line
        const lines = html.split('\n');
        const formattedLines = [];
        let inList = false;
        let listType = null;

        for (let line of lines) {
            const trimmed = line.trim();

            // Task Checkbox
            if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ')) {
                const isChecked = trimmed.startsWith('- [x] ');
                const label = trimmed.substring(6);
                formattedLines.push(`<div class="task-item"><input type="checkbox" ${isChecked ? 'checked disabled' : 'disabled'}> <span class="${isChecked ? 'completed-task' : ''}">${label}</span></div>`);
                continue;
            }

            // Bullet list
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                if (!inList || listType !== 'ul') {
                    if (inList) formattedLines.push(`</${listType}>`);
                    formattedLines.push('<ul>');
                    inList = true;
                    listType = 'ul';
                }
                formattedLines.push(`<li>${trimmed.substring(2)}</li>`);
                continue;
            }

            // Numbered list
            const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
            if (numMatch) {
                if (!inList || listType !== 'ol') {
                    if (inList) formattedLines.push(`</${listType}>`);
                    formattedLines.push('<ol>');
                    inList = true;
                    listType = 'ol';
                }
                formattedLines.push(`<li>${numMatch[2]}</li>`);
                continue;
            }

            if (inList) {
                formattedLines.push(`</${listType}>`);
                inList = false;
                listType = null;
            }

            // Blockquote
            if (trimmed.startsWith('&gt; ')) {
                formattedLines.push(`<blockquote>${trimmed.substring(5)}</blockquote>`);
            } else if (trimmed.length > 0) {
                formattedLines.push(`<p>${line}</p>`);
            }
        }

        if (inList) formattedLines.push(`</${listType}>`);

        return formattedLines.join('');
    }

    renderPreview() {
        if (!this.previewContainer || !this.textarea) return;
        this.previewContainer.innerHTML = EditorEngine.parseMarkdown(this.textarea.value);
    }
}
