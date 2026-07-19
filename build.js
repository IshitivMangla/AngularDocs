const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const hljs = require('highlight.js');

const notesDir = __dirname;
const outDir = path.join(notesDir, 'docs');

// Create output directory if it doesn't exist
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// Copy assets
fs.copyFileSync(path.join(notesDir, 'styles.css'), path.join(outDir, 'styles.css'));
fs.copyFileSync(path.join(notesDir, 'script.js'), path.join(outDir, 'script.js'));

const templateHtml = fs.readFileSync(path.join(notesDir, 'template.html'), 'utf-8');

// Configure marked with highlight.js and custom renderer for heading IDs
const renderer = {
    heading(token) {
        const text = token.text;
        const level = token.depth;
        const raw = token.raw;
        // Strip markdown formatting from raw text for ID generation
        const cleanText = text.replace(/<[^>]*>?/gm, ''); 
        const id = cleanText
            .toLowerCase()
            .replace(/[^\w\- ]+/g, '')
            .replace(/ +/g, '-');
        return `<h${level} id="${id}">${text}</h${level}>\n`;
    }
};

marked.use({ renderer });

marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    },
    langPrefix: 'hljs language-'
});

// Read all markdown files
const files = fs.readdirSync(notesDir).filter(file => file.endsWith('.md') && file !== 'template.md');

// Sort files to keep '00-index.md' first and others in order
files.sort();

// Generate navigation links
const navLinks = files.map(file => {
    const name = file.replace('.md', '');
    const htmlName = name.replace(/^\d+-/, '') + '.html';
    // Format name for display, removing the prefix number (e.g., "01-architecture" -> "Architecture")
    let displayName = name.replace(/^\d+-/, '').split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return { name: displayName, htmlName, original: file };
});

files.forEach(file => {
    const mdContent = fs.readFileSync(path.join(notesDir, file), 'utf-8');
    
    // Fix internal markdown links to point to .html instead of .md, and remove numbers from the URLs
    const processedMdContent = mdContent.replace(/\]\(\.\/(\d+-)?(.*?)\.md\)/g, '](./$2.html)');
    
    const htmlContent = marked.parse(processedMdContent);

    // Generate active navigation
    const currentHtmlName = file.replace(/^\d+-/, '').replace('.md', '.html');
    const navHtml = navLinks.map(link => {
        const isActive = link.htmlName === currentHtmlName ? 'active' : '';
        return `<a href="${link.htmlName}" class="nav-item ${isActive}">${link.name}</a>`;
    }).join('\n');

    // Title parsing
    const titleMatch = mdContent.match(/^#\s+(.*)/m);
    const title = titleMatch ? titleMatch[1] : file.replace('.md', '');

    let finalHtml = templateHtml
        .replace('{{TITLE}}', title)
        .replace('{{NAVIGATION}}', navHtml)
        .replace('{{CONTENT}}', htmlContent);

    fs.writeFileSync(path.join(outDir, currentHtmlName), finalHtml);
    console.log(`Generated ${currentHtmlName}`);
});

console.log('Build complete! Output in docs folder.');
