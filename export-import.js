/**
 * ExportImportService - Production Data Portability & Document Generator Module
 * Supports PDF printable export, Markdown file export, Plain Text TXT export,
 * JSON Backup creation, and JSON restoration with integrity checks.
 */

class ExportImportService {
    /**
     * Export entries as a beautifully formatted PDF document
     */
    static exportToPDF(dateHeader, htmlContent) {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to export PDF documents.');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Journal Export - ${dateHeader}</title>
                <style>
                    body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
                    h1 { color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
                    .entry-item { border-left: 4px solid #6366f1; padding-left: 16px; margin-bottom: 24px; background: #f8fafc; padding: 16px; border-radius: 8px; }
                    .entry-item-title { font-size: 18px; font-weight: bold; color: #0f172a; }
                    .entry-item-time { font-size: 12px; color: #64748b; margin: 4px 0 12px 0; }
                    .entry-item-content { font-size: 14px; color: #334155; white-space: pre-wrap; }
                    .entry-item-actions { display: none !important; }
                    img { max-width: 100%; height: auto; border-radius: 8px; margin-top: 10px; }
                    @media print {
                        body { padding: 0; }
                        .entry-item { break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <h1>📖 Journal Export: ${dateHeader}</h1>
                <div>${htmlContent}</div>
            </body>
            </html>
        `);

        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    }

    /**
     * Export entries as a Markdown (.md) document
     */
    static exportToMarkdown(entries) {
        if (!entries || entries.length === 0) return;

        let markdown = `# 📔 Personal Journal & Life Tracker Export\n\n`;
        markdown += `*Exported on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}*\n\n---\n\n`;

        const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);

        sorted.forEach(e => {
            markdown += `## ${e.title || 'Untitled'} (${e.mood || '😐'})\n`;
            markdown += `**Date:** ${e.date} | **Category:** ${e.category || 'General'}\n`;
            if (e.tags && e.tags.length > 0) {
                markdown += `**Tags:** ${e.tags.map(t => '#' + t).join(' ')}\n`;
            }
            markdown += `\n${e.content}\n\n`;
            if (e.image) {
                markdown += `*(Attached Photo Memory)*\n\n`;
            }
            markdown += `---\n\n`;
        });

        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
        ExportImportService.triggerDownload(blob, `journal_export_${new Date().toISOString().split('T')[0]}.md`);
    }

    /**
     * Export entries as a Plain Text (.txt) file
     */
    static exportToTXT(entries) {
        if (!entries || entries.length === 0) return;

        let text = `========================================\n`;
        text += `       JOURNAL MEMORIES EXPORT\n`;
        text += `========================================\n\n`;

        const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);

        sorted.forEach(e => {
            text += `[${e.date}] ${e.title} (${e.mood})\n`;
            text += `Category: ${e.category || 'General'}\n`;
            if (e.tags && e.tags.length > 0) text += `Tags: ${e.tags.join(', ')}\n`;
            text += `----------------------------------------\n`;
            text += `${e.content}\n\n`;
            text += `========================================\n\n`;
        });

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
        ExportImportService.triggerDownload(blob, `journal_export_${new Date().toISOString().split('T')[0]}.txt`);
    }

    /**
     * Export full JSON Backup file
     */
    static exportToJSON(entries) {
        const payload = {
            version: '2.0',
            exportedAt: new Date().toISOString(),
            totalEntries: entries.length,
            entries
        };

        const jsonStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        ExportImportService.triggerDownload(blob, `pro_journal_backup_${new Date().toISOString().split('T')[0]}.json`);
    }

    /**
     * Parse & Validate JSON Import file
     */
    static async importFromJSON(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file selected'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    let entries = [];

                    if (Array.isArray(parsed)) {
                        entries = parsed;
                    } else if (parsed && Array.isArray(parsed.entries)) {
                        entries = parsed.entries;
                    } else {
                        throw new Error('Invalid JSON structure: missing entries array');
                    }

                    resolve(entries);
                } catch (err) {
                    reject(new Error('Failed to parse JSON backup file: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    static triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
