const pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
const Tesseract = require('tesseract.js');

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const DOC_TYPE_MAP = {
    'BÁO CÁO': 'BC',
    'QUYẾT ĐỊNH': 'QD',
    'CÔNG VĂN': 'CV',
    'CHỈ THỊ': 'CT',
    'THÔNG BÁO': 'TB',
    'KẾ HOẠCH': 'KH',
    'BIÊN BẢN': 'BB',
    'NGHỊ ĐỊNH': 'ND',
};

// ⚠️ Pattern DÀI đứng trước pattern NGẮN
const RANK_PATTERN = '(Đại tá|Thượng tá|Trung tá|Thiếu tá|Đại úy|Thượng úy|Trung úy|Thiếu úy)';
const POSITION_PATTERN = '(PHÓ HIỆU TRƯỞNG|PHÓ CHÍNH ỦY|PHÓ PHÒNG|TRƯỞNG PHÒNG|TRƯỞNG KHOA|HIỆU TRƯỞNG|CHÍNH ỦY)';

// Trường bắt buộc phải có
const REQUIRED_FIELDS = [
    'document_code',
    'doc_type_code',
    'title',
    'issued_date',
    'signer',
];

// ═══════════════════════════════════════════════════════════════
// 1. EXTRACT TEXT + POSITIONS từ PDF
// ═══════════════════════════════════════════════════════════════
async function extractTextItems(buffer) {
    const pdfjsLib = await pdfjsLibPromise;
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();

        const items = textContent.items
            .filter(it => typeof it.str === 'string')
            .map(it => ({
                str: it.str,
                x: it.transform?.[4] ?? 0,
                y: it.transform?.[5] ?? 0,
                width: it.width,
                height: it.height,
                font: it.fontName,
            }));

        pages.push({
            pageNum: i,
            width: viewport.width,
            height: viewport.height,
            items,
        });
    }

    const fullText = pages
        .map(p => p.items.map(it => it.str).join('\n'))
        .join('\n\n');

    return { pages, fullText };
}

// ═══════════════════════════════════════════════════════════════
// 2. RENDER PDF → PNG (để OCR)
// ═══════════════════════════════════════════════════════════════
async function renderPdfToImages(buffer, scale = 3) {
    try {
        const { pdf: pdfToImg } = await import('pdf-to-img');
        const images = [];
        const document = await pdfToImg(buffer, { scale });
        for await (const page of document) {
            images.push(page);
        }
        return images;
    } catch (err) {
        console.error('[renderPdfToImages]', err.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// 3. OCR ảnh → text (tiếng Việt + Anh)
// ═══════════════════════════════════════════════════════════════
async function ocrImage(imageBuffer) {
    try {
        const { data: { text } } = await Tesseract.recognize(
            imageBuffer,
            'vie+eng',
            { logger: () => {} }
        );
        return text || '';
    } catch (err) {
        console.error('[ocrImage]', err.message);
        return '';
    }
}

// ═══════════════════════════════════════════════════════════════
// 4. REGEX EXTRACT METADATA (dùng chung cho text và OCR text)
// ═══════════════════════════════════════════════════════════════
function extractMetadata(text, existing = {}) {
    const result = {
        document_code: null,
        document_number: null,
        doc_type_code: null,
        doc_type_name: null,
        title: null,
        issued_date: null,
        signer: null,
        signer_position: null,
        issuer_unit_name: null,
    };

    // ── Số hiệu (suffix): /BC-TQS ──
    const codeMatch = text.match(/S[ốo]\s*:?\s*(\d+)?\s*\/\s*([A-ZĐ][A-ZĐ0-9]+(?:\s*-\s*[A-ZĐ0-9]+)*)/);
    if (codeMatch) {
        result.document_number = codeMatch[1] || null;
        // Chuẩn hoá suffix: bỏ space quanh dấu gạch
        const suffix = codeMatch[2].replace(/\s*-\s*/g, '-').trim();
        if (codeMatch[1]) {
            result.document_code = `${codeMatch[1]}/${suffix}`;
        } else {
            result.document_code = `/${suffix}`;
        }
        // Đoán doc_type_code
        const guessType = suffix.split('-')[0];
        if (Object.values(DOC_TYPE_MAP).includes(guessType)) {
            result.doc_type_code = guessType;
        }
    }

    // ── Loại văn bản: dòng HOA giữa trang ──
    for (const [name, code] of Object.entries(DOC_TYPE_MAP)) {
        const regex = new RegExp(`^\\s*${name}\\s*$`, 'm');
        if (regex.test(text)) {
            result.doc_type_name = name;
            result.doc_type_code = code;

            // Trích yếu = dòng ngay sau loại VB
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            const idx = lines.findIndex(l => l === name);
            if (idx >= 0 && lines[idx + 1]) {
                result.title = lines[idx + 1];
            }
            break;
        }
    }

    // ── Ngày ban hành ──
    // FIX 1: Dùng \s* thay \s+ để chấp nhận "ngày19" (OCR mất space)
    const dateMatch = text.match(/ng[àa]y\s*(\d+)?\s*th[áa]ng\s*(\d+)\s*n[ăa]m\s*(\d{4})/i);
    if (dateMatch) {
        const day = dateMatch[1] || '01';
        const month = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3];
        result.issued_date = `${year}-${month}-${day.padStart(2, '0')}`;
    }

    // ── Người ký ──
    const signerMatch = text.match(
        new RegExp(`${RANK_PATTERN}\\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+)`)
    );
    if (signerMatch) {
        result.signer = `${signerMatch[1]} ${signerMatch[2]}`.trim();
    }

    // ── Chức danh người ký ──
    // FIX 3: Tìm TẤT CẢ matches, chọn match DÀI NHẤT
    // (Text có "KT. HIỆU TRƯỞNG" và "PHÓ HIỆU TRƯỞNG" → ưu tiên PHÓ HIỆU TRƯỞNG)
    const posMatches = [...text.matchAll(new RegExp(POSITION_PATTERN, 'g'))];
    if (posMatches.length > 0) {
        const longest = posMatches.reduce((a, b) => a[1].length >= b[1].length ? a : b);
        result.signer_position = longest[1];
    }

    // ── Đơn vị ban hành ──
    const unitMatch = text.match(/QU[ÂA]N KHU\s+\d+\s*\n\s*([A-ZÀ-Ỹ][^\n]+)/);
    if (unitMatch) {
        result.issuer_unit_name = unitMatch[1].trim();
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════
// 5. CHECK trường nào còn thiếu
// ═══════════════════════════════════════════════════════════════
function getMissingFields(parsed) {
    const missing = [];
    for (const field of REQUIRED_FIELDS) {
        if (!parsed[field] || (typeof parsed[field] === 'string' && !parsed[field].trim())) {
            missing.push(field);
        }
    }
    // document_code thiếu số (chỉ có "/BC-TQS") cũng tính là thiếu
    if (parsed.document_code && parsed.document_code.startsWith('/')) {
        if (!missing.includes('document_code')) missing.push('document_code');
    }
    // FIX 2: issued_date kết thúc "-01" (fallback ngày 1) cũng tính là thiếu
    if (parsed.issued_date && parsed.issued_date.endsWith('-01')) {
        if (!missing.includes('issued_date')) missing.push('issued_date');
    }
    return missing;
}

// ═══════════════════════════════════════════════════════════════
// 6. MERGE — điền trường thiếu từ OCR
// ═══════════════════════════════════════════════════════════════
function mergeMissingFields(primary, fallback, missingFields) {
    const merged = { ...primary };
    const sources = {};

    // Đánh dấu các trường đã có từ text
    for (const key of Object.keys(primary)) {
        if (primary[key] !== null && primary[key] !== undefined) {
            sources[key] = 'text';
        }
    }

    // Chỉ điền các trường còn thiếu từ fallback
    for (const field of missingFields) {
        if (fallback[field]) {
            merged[field] = fallback[field];
            sources[field] = 'ocr';
        }
    }

    // Đặc biệt xử lý document_code — nếu text chỉ có "/BC-TQS", ghép số từ OCR
    if (
        primary.document_code &&
        primary.document_code.startsWith('/') &&
        fallback.document_number
    ) {
        merged.document_code = `${fallback.document_number}${primary.document_code}`;
        merged.document_number = fallback.document_number;
        sources.document_code = 'text+ocr';
        sources.document_number = 'ocr';
    }

    // FIX 2: issued_date — nếu text chỉ có "-01", thay ngày thật từ OCR
    if (
        primary.issued_date &&
        primary.issued_date.endsWith('-01') &&
        fallback.issued_date &&
        !fallback.issued_date.endsWith('-01')
    ) {
        merged.issued_date = fallback.issued_date;
        sources.issued_date = 'text+ocr';
    }

    return { merged, sources };
}

// ═══════════════════════════════════════════════════════════════
// 7. MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════
async function parseDocumentPdf(buffer) {
    // ── BƯỚC 1: Extract text layer ──
    const { pages, fullText } = await extractTextItems(buffer);
    const textLength = fullText.trim().length;
    const isDigital = textLength > 50;

    let parsed = {};
    let source = 'digital';

    if (isDigital) {
        parsed = extractMetadata(fullText);
    } else {
        source = 'scan';
        parsed = {
            document_code: null,
            document_number: null,
            doc_type_code: null,
            doc_type_name: null,
            title: null,
            issued_date: null,
            signer: null,
            signer_position: null,
            issuer_unit_name: null,
        };
    }

    // ── BƯỚC 2: Check trường thiếu ──
    const missing = getMissingFields(parsed);

    // ── BƯỚC 3: Nếu thiếu → OCR ──
    let sources = {};
    if (missing.length > 0) {
        console.log(`[parse] Thiếu ${missing.length} trường:`, missing.join(', '), '→ chạy OCR');

        const images = await renderPdfToImages(buffer, 3);
        if (images.length > 0) {
            const ocrText = await ocrImage(images[0]);

            if (ocrText && ocrText.trim().length > 20) {
                // DEBUG — bỏ comment nếu cần xem OCR text
                // console.log('\n[DEBUG] OCR TEXT (400 ký tự đầu):');
                // console.log(ocrText.slice(0, 400));
                // console.log('[DEBUG] =================\n');

                const ocrParsed = extractMetadata(ocrText);
                const merged = mergeMissingFields(parsed, ocrParsed, missing);
                parsed = merged.merged;
                sources = merged.sources;
            }
        }
    }

    // ── BƯỚC 4: Đánh dấu source cho các trường còn lại ──
    for (const key of Object.keys(parsed)) {
        if (parsed[key] !== null && !sources[key]) {
            sources[key] = isDigital ? 'text' : 'ocr';
        }
    }

    return {
        success: true,
        source: isDigital ? 'digital' : 'scan',
        usedOcr: missing.length > 0,
        missingFields: missing,
        parsed,
        sources,
    };
}

module.exports = { parseDocumentPdf };