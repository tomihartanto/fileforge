
const { getDocumentProxy, renderPageAsImage } = require('unpdf');
const fs = require('fs');
(async () => {
  const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync('test-scanned.pdf')));
  console.log('pages', pdf.numPages);
  const img = await renderPageAsImage(pdf, 1, { scale: 2, canvasImport: () => Promise.resolve(require('@napi-rs/canvas')) });
  console.log('img bytes', img.byteLength);
})();
