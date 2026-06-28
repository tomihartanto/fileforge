
const { getDocumentProxy, renderPageAsImage } = require('unpdf');
const fs = require('fs');

async function main() {
  const pdfBuffer = fs.readFileSync('test-scanned.pdf');
  console.log('PDF size:', pdfBuffer.length);
  
  try {
    const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
    console.log('Pages:', pdf.numPages);
    
    const img = await renderPageAsImage(pdf, 1, { scale: 2 });
    console.log('Image rendered:', img.byteLength, 'bytes');
    fs.writeFileSync('test-render.png', Buffer.from(img));
    console.log('SUCCESS - saved test-render.png');
  } catch(e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack?.slice(0, 300));
  }
}
main();
