
/**
 * QK7 DataHub - PDF Router & Security Module
 * Version: 2026.11
 *
 * Features:
 * - PDF Classification: TextBased / Scanned / Mixed
 * - Smart Page Sampling
 * - OCR Routing
 * - Metadata Extraction Routing
 * - Secure PDF View / Download
 * - Server-side Watermark
 * - Fingerprint Enforcement
 * - Access Logging
 * - Fail-closed Security
 */

const crypto = require('node:crypto');
const express = require('express');

const pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs');

const {
    stampPdfWatermark,
    formatServerDateTime,
} = require('./pdfWatermarkServer.js');

// ============================================================
// 1. PDF CLASSIFIER
// ============================================================

async function classifyPdf(buffer, options = {}) {
    const startTime = Date.now();

    const {
        forMetadataOnly = true,
        textLengthThreshold = 50,
        maxPagesToSample = 10,
        metadataFallbackPages = [1, 2, 3],
    } = options;

    if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
        throw new TypeError('PDF buffer không hợp lệ');
    }

    if (!Number.isInteger(textLengthThreshold) ||
        textLengthThreshold < 0) {
        throw new RangeError('textLengthThreshold không hợp lệ');
    }

    if (!Number.isInteger(maxPagesToSample) ||
        maxPagesToSample < 1) {
        throw new RangeError('maxPagesToSample không hợp lệ');
    }

    let loadingTask;
    let doc;

    const textPages = [];
    const scannedPages = [];
    const failedPages = [];

    let sampleText = '';
    let pagesToCheck = [];

    try {
        const pdfjsLib = await pdfjsLibPromise;

        loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(buffer),
            disableFontFace: true,
        });

        doc = await loadingTask.promise;

        const totalPages = doc.numPages;

        if (!Number.isInteger(totalPages) || totalPages < 1) {
            throw new Error('PDF không có trang hợp lệ');
        }

        // ----------------------------------------------------
        // Smart sampling
        // ----------------------------------------------------

        if (totalPages <= maxPagesToSample) {
            pagesToCheck = Array.from(
                { length: totalPages },
                (_, i) => i + 1
            );
        } else {
            const candidatePages = new Set();

            // First pages
            for (let i = 1; i <= Math.min(3, totalPages); i++) {
                candidatePages.add(i);
            }

            // Last pages
            candidatePages.add(totalPages);

            if (totalPages > 1) {
                candidatePages.add(totalPages - 1);
            }

            // Evenly distributed samples
            const remaining = Math.max(
                0,
                maxPagesToSample - candidatePages.size
            );

            for (let i = 1; i <= remaining; i++) {
                const page = Math.round(
                    1 + (i * (totalPages - 1)) / (remaining + 1)
                );

                candidatePages.add(page);
            }

            pagesToCheck = [...candidatePages]
                .filter(p => p >= 1 && p <= totalPages)
                .sort((a, b) => a - b)
                .slice(0, maxPagesToSample);
        }

        // ----------------------------------------------------
        // Analyze sampled pages
        // ----------------------------------------------------

        for (const pageNum of pagesToCheck) {
            let page;

            try {
                page = await doc.getPage(pageNum);

                const textContent = await page.getTextContent();

                const pageText = textContent.items
                    .filter(item => typeof item.str === 'string')
                    .map(item => item.str)
                    .join(' ')
                    .trim();

                if (pageNum === 1) {
                    sampleText = pageText;
                }

                const cleanLength = pageText
                    .replace(/\s+/g, '')
                    .length;

                if (cleanLength >= textLengthThreshold) {
                    textPages.push(pageNum);
                } else {
                    scannedPages.push(pageNum);
                }

            } catch (err) {
                failedPages.push(pageNum);

                console.warn(
                    `[pdf-router] Page ${pageNum} error:`,
                    err.message
                );
            } finally {
                if (page) {
                    page.cleanup();
                }
            }
        }

        // ----------------------------------------------------
        // Classification
        // ----------------------------------------------------

        let pdfType = 'TextBased';

        if (textPages.length === 0 && scannedPages.length > 0) {
            pdfType = 'Scanned';
        } else if (
            scannedPages.length > 0 ||
            failedPages.length > 0
        ) {
            pdfType = 'Mixed';
        }

        // A sample-based classification is not a full-document proof.
        const classificationConfidence =
            pagesToCheck.length === totalPages
                ? 'FULL'
                : 'SAMPLED';

        // ----------------------------------------------------
        // OCR routing
        // ----------------------------------------------------

        let pagesNeedingOcr = [];

        if (forMetadataOnly) {
            const candidates = metadataFallbackPages.filter(
                p => Number.isInteger(p) && p >= 1 && p <= totalPages
            );

            pagesNeedingOcr = candidates.filter(
                p => scannedPages.includes(p) || failedPages.includes(p)
            );
        } else {
            pagesNeedingOcr = [
                ...scannedPages,
                ...failedPages,
            ];
        }

        pagesNeedingOcr = [
            ...new Set(pagesNeedingOcr),
        ].sort((a, b) => a - b);

        const elapsedMs = Date.now() - startTime;

        console.log(
            `[pdf-router] Classified in ${elapsedMs}ms:`,
            pdfType,
            `(${totalPages} pages)`,
            `OCR: [${pagesNeedingOcr.join(', ')}]`
        );

        return {
            pdfType,
            totalPages,
            pagesChecked: pagesToCheck,
            pagesNeedingOcr,
            textPages,
            scannedPages,
            failedPages,
            sampleText,
            classificationConfidence,
            elapsedMs,
        };

    } finally {
        // ----------------------------------------------------
        // PDF.js cleanup
        // ----------------------------------------------------

        if (doc && typeof doc.destroy === 'function') {
            await doc.destroy().catch(err => {
                console.warn(
                    '[pdf-router] Document cleanup error:',
                    err.message
                );
            });
        }
        if (doc && typeof doc.cleanup === 'function') {
            await doc.cleanup().catch(() => {});
        }
        if (loadingTask && typeof loadingTask.destroy === 'function') {
            await loadingTask.destroy().catch(() => {});
        }
    }
}

// ============================================================
// 2. SECURITY ROUTER
// ============================================================

function createSecurePdfRouter(dependencies) {
    const router = express.Router();

    const {
        requireAuth,
        getFileForUser,
        canViewFile,
        canDownloadFile,
        enforceFingerprintIfNeeded,
        readStoredPdfBuffer,
        writeAccessLog,
        safeFilename,
    } = dependencies || {};

    const requiredFunctions = {
        requireAuth,
        getFileForUser,
        canViewFile,
        canDownloadFile,
        enforceFingerprintIfNeeded,
        readStoredPdfBuffer,
        writeAccessLog,
        safeFilename,
    };

    for (const [name, fn] of Object.entries(requiredFunctions)) {
        if (typeof fn !== 'function') {
            throw new TypeError(
                `Missing required dependency: ${name}`
            );
        }
    }

    // --------------------------------------------------------
    // Secure View / Download
    // --------------------------------------------------------

    router.get(
        '/:fileId/view',
        requireAuth,
        async (req, res, next) => {
            try {
                const fileId = req.params.fileId;
                const isDownload = req.query.download === '1';

                // 1. Retrieve file
                const file = await getFileForUser(
                    fileId,
                    req.user
                );

                if (!file) {
                    return res.status(404).json({
                        error: 'Không tìm thấy tài liệu',
                    });
                }

                // 2. Permission checks
                if (!await canViewFile(file, req.user)) {
                    return res.status(403).json({
                        error: 'Không đủ quyền xem tài liệu',
                    });
                }

                if (
                    isDownload &&
                    !await canDownloadFile(file, req.user)
                ) {
                    return res.status(403).json({
                        error: 'Tài liệu này không được phép tải về máy',
                    });
                }

                // 3. Fingerprint enforcement
                await enforceFingerprintIfNeeded(req, file);

                // 4. Read internal PDF
                const rawBuffer = await readStoredPdfBuffer(file);

                if (
                    !Buffer.isBuffer(rawBuffer) ||
                    rawBuffer.length === 0
                ) {
                    throw new Error('Stored PDF buffer không hợp lệ');
                }

                // 5. Server-generated trace ID and time
                const traceId =
                    req.traceId || `REF-${crypto.randomUUID()}`;

                const serverNow = new Date();

                const userDisplayName =
                    req.user.full_name ||
                    req.user.username ||
                    req.user.email ||
                    `User#${req.user.id}`;

                const timeStr = formatServerDateTime(serverNow);

                // 6. Mandatory server-side watermark
                // Fail closed: never return original PDF on error.
                const watermarkedPdf = await stampPdfWatermark(
                    rawBuffer,
                    {
                        userDisplayName,
                        timeStr,
                        traceId,
                        opacity: 0.18,
                    }
                );

                if (
                    !Buffer.isBuffer(watermarkedPdf) ||
                    watermarkedPdf.length === 0
                ) {
                    throw new Error(
                        'Watermark service returned invalid PDF'
                    );
                }

                // 7. Access logging
                await writeAccessLog({
                    userId: req.user.id,
                    fileId,
                    traceId,
                    action: isDownload ? 'DOWNLOAD' : 'VIEW',
                    at: serverNow,
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                });

                // 8. Safe filename
                const safeName = safeFilename(
                    file.original_name ||
                    `${file.document_code || fileId}.pdf`
                );

                // 9. Security headers
                res.setHeader(
                    'Content-Type',
                    'application/pdf'
                );

                res.setHeader(
                    'Content-Disposition',
                    `${isDownload ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(safeName)}`
                );

                res.setHeader(
                    'Cache-Control',
                    'no-store, no-cache, must-revalidate, private'
                );

                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');

                res.setHeader(
                    'X-Content-Type-Options',
                    'nosniff'
                );

                // 10. Trace headers
                res.setHeader('X-Trace-Id', traceId);

                res.setHeader(
                    'X-Server-Time',
                    serverNow.toUTCString()
                );

                res.setHeader(
                    'X-Clock-Timestamp',
                    String(serverNow.getTime())
                );

                res.setHeader(
                    'Content-Length',
                    String(watermarkedPdf.length)
                );

                // 11. Return watermarked PDF only
                return res.send(watermarkedPdf);

            } catch (err) {
                return next(err);
            }
        }
    );

    return router;
}

// ============================================================
// 3. EXPORTS
// ============================================================

module.exports = {
    classifyPdf,
    createSecurePdfRouter,
};
