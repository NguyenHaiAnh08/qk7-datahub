const fs = require('fs');
const path = require('path');
const { parseDocumentPdf } = require('./pdf-parser');

(async () => {
    const filePath = path.join(__dirname, 'uploads', '2026', '10', 'document (1).pdf');
    const buffer = fs.readFileSync(filePath);

    console.log('Đang parse...');
    const result = await parseDocumentPdf(buffer);
    console.log(JSON.stringify(result, null, 2));
})();