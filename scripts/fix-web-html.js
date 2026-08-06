#!/usr/bin/env node
/**
 * Post-build script to fix web HTML:
 * 1. Set lang="ar" and dir="rtl"
 * 2. Add translate="no" to prevent browser auto-translation
 * 3. Add meta tag to disable Google Translate
 */
const fs = require('fs');
const path = require('path');

const htmlPath = process.argv[2] || path.join(__dirname, '..', 'dist', 'web', 'index.html');

if (!fs.existsSync(htmlPath)) {
  console.log('index.html not found at:', htmlPath);
  process.exit(0);
}

let html = fs.readFileSync(htmlPath, 'utf8');

// Fix lang and add dir and translate
html = html.replace(
  /<html\s+lang="en">/,
  '<html lang="ar" dir="rtl" translate="no" class="notranslate">'
);

// Add meta to prevent translation after charset meta
if (!html.includes('google')) {
  html = html.replace(
    '<meta charSet="utf-8"/>',
    '<meta charSet="utf-8"/><meta name="google" content="notranslate"/>'
  );
}

// Add title
if (html.includes('<title data-rh="true"></title>')) {
  html = html.replace(
    '<title data-rh="true"></title>',
    '<title data-rh="true">مصنع السلطان</title>'
  );
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('[fix-web-html] Fixed lang, dir, translate attributes in', htmlPath);
