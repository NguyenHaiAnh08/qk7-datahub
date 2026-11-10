/**
 * PDF Router & Classifier Module
 * Phân loại trang PDF (TextBased, Scanned, Mixed) và định tuyến thông minh.
 * QK7 DataHub - Architecture Upgrade (v2026.11)
 */

const pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs');

/**
 * Phân tích và phân loại buffer PDF
 * @param {Buffer|Uint8Array} buffer - Nội dung file PDF
 * @param {Object} options - Tùy chọn phân tích
 * @param {boolean} [options.forMetadataOnly=true] - Chỉ nhắm các trang phục vụ trích xuất metadata (trang đầu & cuối)
 * @param {number} [options.textLengthThreshold=50] - Số ký tự tối thiểu để coi một trang là text-based
 * @param {number} [options.maxPagesToSample=10] - Giới hạn số trang quét lấy mẫu cho tài liệu lớn
 * @returns {Promise<{
 *   pdfType: 'TextBased' | 'Scanned' | 'Mixed',
 *   totalPages: number,
 *   pagesNeedingOcr: number[],
 *   textPages: number[],
 *   scannedPages: number[],
 *   sampleText: string,
 *   elapsedMs: number
 * }>}
 */
async function classifyPdf(buffer, options = {}) {
    const startTime = Date.now();
    const {
        forMetadataOnly = true,
        textLengthThreshold = 50,
        maxPagesToSample = 10,
    } = options;

    const pdfjsLib = await pdfjsLibPromise;
    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        disableFontFace: true,
    });

    const doc = await loadingTask.promise;
    const totalPages = doc.numPages;

    const textPages = [];
    const scannedPages = [];
    let sampleText = '';

    // Xác định danh sách các trang cần kiểm tra
    let pagesToCheck = [];
    if (totalPages <= maxPagesToSample) {
        pagesToCheck = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
        // Quét các trang chiến lược: 3 trang đầu và 2 trang cuối
        const head = [1, 2, 3].filter(p => p <= totalPages);
        const tail = [totalPages - 1, totalPages].filter(p => p > 3 && p <= totalPages);
        pagesToCheck = [...new Set([...head, ...tail])];
    }

    for (const pageNum of pagesToCheck) {
        try {
            const page = await doc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .filter(it => typeof it.str === 'string')
                .map(it => it.str)
                .join(' ')
                .trim();

            if (pageNum === 1 && pageText.length > 0) {
                sampleText = pageText;
            }

            // Kiểm tra mật độ text thực sự (loại bỏ khoảng trắng)
            const cleanLength = pageText.replace(/\s+/g, '').length;
            if (cleanLength >= textLengthThreshold) {
                textPages.push(pageNum);
            } else {
                scannedPages.push(pageNum);
            }
        } catch (err) {
            console.warn(`[pdf-router] Lỗi đọc text trang ${pageNum}:`, err.message);
            scannedPages.push(pageNum);
        }
    }

    // Phân loại tổng thể
    let pdfType = 'TextBased';
    if (textPages.length === 0) {
        pdfType = 'Scanned';
    } else if (scannedPages.length > 0) {
        pdfType = 'Mixed';
    }

    // Tính toán pagesNeedingOcr
    let pagesNeedingOcr = [];
    if (forMetadataOnly) {
        // Phục vụ form upload điền nhanh: Trang 1 chứa 100% metadata (Số hiệu, Ngày, Trích yếu, Cơ quan)
        // Chỉ quét Trang 1 để tối ưu thời gian xử lý xuống < 5 giây (thay vì 15s cho 2 trang)
        if (scannedPages.includes(1)) {
            pagesNeedingOcr = [1];
        } else {
            pagesNeedingOcr = [];
        }
    } else {
        pagesNeedingOcr = [...scannedPages];
    }

    // Đảm bảo không trùng lặp và sắp xếp thứ tự trang
    pagesNeedingOcr = [...new Set(pagesNeedingOcr)].sort((a, b) => a - b);

    const elapsedMs = Date.now() - startTime;
    console.log(`[pdf-router] Classified in ${elapsedMs}ms: ${pdfType} (${totalPages} pages) -> OCR needed for pages: [${pagesNeedingOcr.join(', ')}]`);

    return {
        pdfType,
        totalPages,
        pagesNeedingOcr,
        textPages,
        scannedPages,
        sampleText,
        elapsedMs,
    };
}

module.exports = {
    classifyPdf,
};
