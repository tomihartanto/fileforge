
const { getDocumentProxy, renderPageAsImage } = require('unpdf');
const fs = require('fs');

async function main() {
  const pdfBuffer = fs.readFileSync('test-scanned.pdf');
  console.log('PDF size:', pdfBuffer.length);
  try {
    const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
    console.log('Pages:', pdf.numPages);
    const img = await renderPageAsImage(pdf, 1, { scale: 2, canvasImport: () => import('@napi-rs/canvas') });
    console.log('Image rendered bytes:', img.byteLength);
    fs.writeFileSync('test-render2.png', Buffer.from(img));
    console.log('SUCCESS saved');
  } catch(e) {
    console.error('ERROR', e.message);
  }
}
main();
