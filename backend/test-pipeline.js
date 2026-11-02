/**
 * Automated Verification Test Suite for QK7 DataHub PDF Parser & OCR Pipeline
 * Run via: npm test
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { classifyPdf } = require('./src/pdf-router');
const { parseDocumentPdf } = require('./pdf-parser');

const QD_FILE = path.resolve(__dirname, '../document/20261030_QD_652-Q-TQS_b1f5a712.pdf');
const NQ_FILE = path.resolve(__dirname, '../document/20261030_NQ_224-2026-N-CP_3e7d8dee.pdf');

describe('PDF Routing & OCR Pipeline Test Suite', () => {
    test('1. Routing Layer: Phân loại đúng TextBased và Scanned', async () => {
        const qdBuf = fs.readFileSync(QD_FILE);
        const qdResult = await classifyPdf(qdBuf);
        assert.equal(qdResult.pdfType, 'TextBased');
        assert.equal(qdResult.pagesNeedingOcr.length, 0);
        assert.ok(qdResult.elapsedMs < 2000, 'Classification must be fast');

        const nqBuf = fs.readFileSync(NQ_FILE);
        const nqResult = await classifyPdf(nqBuf);
        assert.equal(nqResult.pdfType, 'Scanned');
        assert.deepEqual(nqResult.pagesNeedingOcr, [1]);
        assert.ok(nqResult.elapsedMs < 100, `Classification took ${nqResult.elapsedMs}ms (< 100ms)`);
    });

    test('2. Python Microservice Health Check (:8002)', async () => {
        const res = await fetch('http://127.0.0.1:8002/health');
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.status, 'ok');
        assert.equal(data.service, 'ocr-service');
    });

    test('3. Trích xuất metadata file số hóa Text-based (Quyết định 652)', async () => {
        const qdBuf = fs.readFileSync(QD_FILE);
        const start = Date.now();
        const res = await parseDocumentPdf(qdBuf, {}, {});
        const elapsed = Date.now() - start;
        const parsed = res.parsed;

        assert.equal(parsed.document_code, '652/QĐ-TQS');
        assert.equal(parsed.issued_date, '2025-07-22');
        assert.ok(parsed.title.includes('Thành lập Ban Chỉ đạo'));
        assert.ok(elapsed < 10000, `Execution time was ${elapsed}ms (< 10s)`);
    });

    test('4. Trích xuất metadata file scan phức tạp 121 trang (Nghị định 224)', async () => {
        const nqBuf = fs.readFileSync(NQ_FILE);
        const start = Date.now();

        // 1. Phân loại
        const classification = await classifyPdf(nqBuf);
        assert.equal(classification.pdfType, 'Scanned');

        // 2. OCR các trang trọng yếu [1, 2]
        const formData = new FormData();
        formData.append('file', new Blob([nqBuf], { type: 'application/pdf' }), 'temp.pdf');
        formData.append('pages', JSON.stringify(classification.pagesNeedingOcr));
        formData.append('dpi', '150');

        const ocrResp = await fetch('http://127.0.0.1:8002/api/ocr/extract', {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(20000),
        });
        assert.equal(ocrResp.status, 200);
        const ocrData = await ocrResp.json();
        assert.ok(ocrData.success);
        assert.ok(ocrData.combined_text.length > 500);

        // 3. Trích xuất metadata
        const res = await parseDocumentPdf(nqBuf, {}, {
            preExtractedText: ocrData.combined_text,
            classification,
            ocrEngine: 'paddleocr',
        });
        const elapsed = Date.now() - start;
        const parsed = res.parsed;

        assert.equal(parsed.document_code, '224/2026/NĐ-CP');
        assert.equal(parsed.document_number, '224');
        assert.equal(parsed.issued_date, '2026-06-24');
        assert.ok(parsed.title.toLowerCase().includes('chuyển đổi số') || parsed.title.toLowerCase().includes('chuyén di só'));
        assert.ok(elapsed < 10000, `Total end-to-end pipeline took ${elapsed}ms (< 10s target!)`);
    });
});
