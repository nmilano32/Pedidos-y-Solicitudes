// Uso: node print_pdf.js entrada.html salida.pdf
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [html, out] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve(html));
  await p.pdf({ path: out, format: 'A4', printBackground: true, margin: { top: '16mm', bottom: '16mm', left: '18mm', right: '18mm' } });
  await b.close();
})();
