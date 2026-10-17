const pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// LOAD CONFIG — regex cấu trúc (JSON)
// ═══════════════════════════════════════════════════════════════
const CONFIG_PATH = path.join(__dirname, 'config', 'parser-patterns.json');
let PARSER_CONFIG = {
    document_code: 'S[ốo]\\s*:\\s*(\\d+)?[ \\t]*([\\/\\-]?)[ \\t]*([A-ZĐ][A-ZĐ0-9\\/\\-]*(?:[ \\t]+[A-ZĐ0-9][A-ZĐ0-9\\/\\-]+)*)',
    issued_date: 'ng[àa]y\\s*(\\d+)?\\s*th[áa]ng\\s*(\\d+)\\s*n[ăa]m\\s*(\\d{4})',
    title_stop: '^(Căn cứ|Kính gửi|Thực hiện|Căn cứ vào|HIỆU TRƯỞNG|CHỦ TỊCH|KT\\.|TM\\.|T\\/M|Nơi nhận)',
    roman_heading: '^\\s*(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)[\\-\\s\\.]',
    signer_name: '^[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,4}$',
};

try {
    if (fs.existsSync(CONFIG_PATH)) {
        const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        PARSER_CONFIG = { ...PARSER_CONFIG, ...raw };
        console.log('[parser] Loaded config/parser-patterns.json');
    } else {
        console.warn('[parser] Không tìm thấy config/parser-patterns.json, dùng default');
    }
} catch (err) {
    console.error('[parser] Lỗi đọc config:', err.message);
}

const STRICT_MODE = (process.env.PARSER_STRICT_MODE || 'false').toLowerCase() === 'true';

// ═══════════════════════════════════════════════════════════════
// [FIX] PHÁT HIỆN GARBAGE TEXT (PDF lỗi font nhúng)
// ═══════════════════════════════════════════════════════════════
/**
 * Trả về true nếu text là "rác" — hiện tượng PDF không nhúng font
 * khiến pdfjs đọc ra các ký tự Unicode vô nghĩa (VD:      ...).
 * Cách kiểm tra: đếm tỷ lệ ký tự thực sự (chữ cái + số) trên tổng độ dài.
 */
function isGarbageText(text) {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.length < 50) return false;

    // [FIX] TCVN3 typo: ký tự nằm trong dải U+00A0 - U+00BF (§¹¸ª¬­®¯°±²³...)
    // Đây là dấu hiệu của PDF dùng font TCVN3/VNI không nhúng Unicode map
    const tcvn3TypoCount = (trimmed.match(/[\u00A0-\u00BF]/g) || []).length;
    if (tcvn3TypoCount / trimmed.length > 0.03) {
        // > 3% là đã bất thường — văn bản VN đúng chuẩn gần như không có ký tự này
        return true;
    }

    // Heuristic cũ: đếm token có nghĩa
    const tokens = trimmed.split(/\s+/).filter(t => t.length >= 2);
    const meaningfulTokens = tokens.filter(t => /^[a-zA-Z0-9À-ỹ]{2,}$/.test(t));
    const meaningfulChars = meaningfulTokens.reduce((sum, t) => sum + t.length, 0);
    return meaningfulChars / trimmed.length < 0.3;
}

// ═══════════════════════════════════════════════════════════════
// CACHE CATALOGS
// ═══════════════════════════════════════════════════════════════
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
let catalogCache = { data: null, loadedAt: 0 };

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function loadCatalogs(getPool, sql) {
    if (catalogCache.data && Date.now() - catalogCache.loadedAt < CATALOG_CACHE_TTL_MS) {
        return catalogCache.data;
    }

    const pool = await getPool();

    const [typesRes, ranksRes, positionsRes, unitsRes, patternsRes] = await Promise.all([
        pool.request().query(`SELECT type_id, name FROM DOCUMENT_TYPE`),
        pool.request().query(`SELECT name FROM MILITARY_RANK WHERE active = 1 ORDER BY sort_order`),
        pool.request().query(`SELECT name FROM MILITARY_POSITION WHERE active = 1 ORDER BY sort_order`),
        pool.request().query(`
            SELECT u.unit_id, u.name, u.parent_id
            FROM UNIT u
            UNION
            SELECT ua.unit_id, ua.alias_text AS name, u.parent_id
            FROM UNIT_ALIAS ua
            JOIN UNIT u ON u.unit_id = ua.unit_id
        `),
        pool.request().query(`
            SELECT type_id, pattern_type, regex, priority
            FROM DOCUMENT_TYPE_PATTERN
            WHERE active = 1
            ORDER BY priority DESC, pattern_id
        `),
    ]);

    const docTypes = typesRes.recordset;
    const ranks = ranksRes.recordset.map(r => r.name).filter(Boolean);
    const positions = positionsRes.recordset.map(p => p.name).filter(Boolean);
    const units = unitsRes.recordset;
    const patterns = patternsRes.recordset;

    const buildPattern = (items) =>
        items.filter(Boolean).map(s => s.trim()).filter(s => s.length > 0)
            .sort((a, b) => b.length - a.length)
            .map(escapeRegex).join('|');

    const rankPattern = buildPattern(ranks);
    const positionPattern = buildPattern(positions);

    const docTypeMap = {};
    for (const dt of docTypes) docTypeMap[dt.name.toUpperCase()] = dt.type_id;

    const rootUnits = units.filter(u => !u.parent_id).map(u => u.name.toUpperCase());
    const childUnits = units.filter(u => u.parent_id).map(u => u.name.toUpperCase());

    const compiledPatterns = patterns.map(p => {
        try {
            return { ...p, compiled: new RegExp(p.regex, 'm') };
        } catch (err) {
            console.error(`[parser] Regex lỗi pattern #${p.pattern_id}:`, err.message);
            return null;
        }
    }).filter(Boolean);

    catalogCache.data = {
        docTypes, docTypeMap, ranks, positions, units,
        rankPattern, positionPattern,
        rootUnits, childUnits,
        patterns: compiledPatterns,
    };
    catalogCache.loadedAt = Date.now();

    console.log(`[catalog] Loaded: ${docTypes.length} types, ${ranks.length} ranks, ${positions.length} positions, ${units.length} unit aliases, ${compiledPatterns.length} patterns`);
    console.log(`[catalog] Mode: ${STRICT_MODE ? 'STRICT (DB only)' : 'LENIENT (có fallback)'}`);

    return catalogCache.data;
}

function invalidateCatalogCache() {
    catalogCache.data = null;
    catalogCache.loadedAt = 0;
}

async function matchUnitByName(getPool, sql, name) {
    if (!name || !name.trim()) return null;
    const normalize = (s) => (s || '').trim().replace(/\s+/g, ' ').toUpperCase().normalize('NFC');
    const target = normalize(name);
    const catalog = await loadCatalogs(getPool, sql);
    const matches = catalog.units
        .map(u => ({ ...u, normalized: normalize(u.name) }))
        .filter(u => u.normalized === target);
    if (matches.length === 0) return null;
    return { unit_id: matches[0].unit_id, matched_by: 'name/alias' };
}

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
                width: it.width || 0,
                height: it.height || 0,
            }));
        pages.push({
            pageNum: i,
            items,
            height: viewport.height,
            width: viewport.width,
        });
    }
    const fullText = pages.map(p => p.items.map(it => it.str).join('\n')).join('\n\n');
    return { pages, fullText };
}

async function renderPdfToImages(buffer, scale = 3) {
    try {
        const { pdf: pdfToImg } = await import('pdf-to-img');
        const images = [];
        const document = await pdfToImg(buffer, { scale });
        for await (const page of document) images.push(page);
        return images;
    } catch (err) {
        console.error('[renderPdfToImages]', err.message);
        return [];
    }
}

async function ocrImage(imageBuffer) {
    try {
        const { data: { text } } = await Tesseract.recognize(imageBuffer, 'vie+eng', { logger: () => {} });
        return text || '';
    } catch (err) {
        console.error('[ocrImage]', err.message);
        return '';
    }
}

// ═══════════════════════════════════════════════════════════════
// OCR CHỈ VÙNG HEADER (sau "Số:") — đọc số hiệu bị ẩn dạng ảnh
// ═══════════════════════════════════════════════════════════════
async function ocrNumberFromHeader(buffer, pages) {
    if (!pages || pages.length === 0) return null;

    const page1 = pages[0];
    const items = page1.items || [];
    const pageHeight = page1.height || 842;

    const soItem = items.find(it => /^S[ốo]\s*:?\s*$/.test(it.str.trim()));
    if (!soItem) {
        console.log('[header-ocr] Không tìm thấy "Số:"');
        return null;
    }

    console.log(`[header-ocr] "Số:" tại x=${soItem.x.toFixed(1)}, y=${soItem.y.toFixed(1)}`);

    const sameLine = items
        .filter(it => Math.abs(it.y - soItem.y) < 5 && it.x > soItem.x - 2)
        .sort((a, b) => a.x - b.x);

    let xStart = soItem.x + (soItem.width || 25);
    let xEnd = xStart + 100;

    for (const it of sameLine) {
        if (it.x <= soItem.x + 5) continue;
        if (!it.str.trim()) {
            xEnd = it.x + (it.width || 40);
            break;
        }
        if (it.str.includes('/')) {
            xEnd = it.x;
            break;
        }
    }

    if (xEnd <= xStart + 10) xEnd = xStart + 80;
    const cropWidthPDF = xEnd - xStart;
    if (cropWidthPDF < 20) {
        console.log('[header-ocr] Vùng crop quá nhỏ:', cropWidthPDF);
        return null;
    }

    console.log(`[header-ocr] Crop: x=${xStart.toFixed(1)}-${xEnd.toFixed(1)}, y=${soItem.y.toFixed(1)}, w=${cropWidthPDF.toFixed(1)}`);

    const images = await renderPdfToImages(buffer, 4);
    if (images.length === 0) return null;
    const pageImage = images[0];

    const scale = 4;
    const yTopPDF = pageHeight - soItem.y - 12;
    const yBottomPDF = pageHeight - soItem.y + 18;

    const cropX = Math.max(0, Math.round(xStart * scale) - 15);
    const cropY = Math.max(0, Math.round(yTopPDF * scale));
    const cropW = Math.round(cropWidthPDF * scale) + 30;
    const cropH = Math.round((yBottomPDF - yTopPDF) * scale);

    try {
        const sharp = require('sharp');
        const cropped = await sharp(pageImage)
            .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
            .grayscale()
            .normalize()
            .resize({ width: cropW * 3, kernel: 'lanczos3' })
            .sharpen()
            .threshold(140)
            .png()
            .toBuffer();

        const { data: { text } } = await Tesseract.recognize(cropped, 'eng', {
            tessedit_char_whitelist: '0123456789',
            logger: () => {},
        });

        const cleaned = text.replace(/\D/g, '').trim();
        console.log(`[header-ocr] Đọc: "${text.trim()}" → "${cleaned}"`);

        if (cleaned && cleaned.length >= 1 && cleaned.length <= 6) {
            return cleaned;
        }
        return null;
    } catch (err) {
        console.error('[header-ocr]', err.message);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// DB-FIRST SCAN — tìm đơn vị trong header text từ catalog DB
// ═══════════════════════════════════════════════════════════════
function findUnitsInText(text, catalog, opts = {}) {
    const {
        maxLinesToScan = 12,
        minLength = 5,
        allowSingleLevel = true,
    } = opts;

    if (!catalog || !catalog.units || catalog.units.length === 0) {
        return { parent: null, unit: null, candidates: [] };
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const headerText = lines.slice(0, maxLinesToScan).join('\n');

    const normalize = (s) =>
        (s || '').trim().replace(/\s+/g, ' ').toUpperCase().normalize('NFC');

    const normalizedHeader = normalize(headerText);

    const sortedUnits = catalog.units
        .map(u => ({
            unit_id: u.unit_id,
            name: u.name,
            parent_id: u.parent_id,
            normalized: normalize(u.name),
        }))
        .filter(u => u.normalized.length >= minLength)
        .sort((a, b) => b.normalized.length - a.normalized.length);

    const rawMatches = [];
    for (const unit of sortedUnits) {
        let searchFrom = 0;
        while (true) {
            const idx = normalizedHeader.indexOf(unit.normalized, searchFrom);
            if (idx < 0) break;

            const charBefore = idx === 0 ? ' ' : normalizedHeader[idx - 1];
            const charAfter = idx + unit.normalized.length >= normalizedHeader.length
                ? ' '
                : normalizedHeader[idx + unit.normalized.length];

            const isWordBoundary = /[\s\-\/,.;:]/.test(charBefore) && /[\s\-\/,.;:]/.test(charAfter);

            if (isWordBoundary) {
                rawMatches.push({
                    unit_id: unit.unit_id,
                    name: unit.name,
                    parent_id: unit.parent_id,
                    position: idx,
                    length: unit.normalized.length,
                });
            }
            searchFrom = idx + 1;
        }
    }

    rawMatches.sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return b.length - a.length;
    });

    const nonOverlapping = [];
    for (const candidate of rawMatches) {
        const cStart = candidate.position;
        const cEnd = candidate.position + candidate.length;
        const overlaps = nonOverlapping.some(existing => {
            const eStart = existing.position;
            const eEnd = existing.position + existing.length;
            return !(cEnd <= eStart || cStart >= eEnd);
        });
        if (!overlaps) nonOverlapping.push(candidate);
    }

    nonOverlapping.sort((a, b) => a.position - b.position);

    console.log('[findUnits] Candidates:',
        nonOverlapping.map(m => `${m.unit_id}="${m.name}"@${m.position}`).join(', ') || '(none)'
    );

    if (nonOverlapping.length === 0) return { parent: null, unit: null, candidates: [] };
    if (nonOverlapping.length === 1) {
        if (!allowSingleLevel) return { parent: null, unit: null, candidates: nonOverlapping };
        return { parent: null, unit: nonOverlapping[0], candidates: nonOverlapping };
    }

    const m0 = nonOverlapping[0];
    const m1 = nonOverlapping[1];

    if (m1.parent_id && m1.parent_id === m0.unit_id) {
        return { parent: m0, unit: m1, candidates: nonOverlapping };
    }
    if (!m0.parent_id) {
        return { parent: m0, unit: m1, candidates: nonOverlapping };
    }
    if (!m1.parent_id) {
        return { parent: m1, unit: m0, candidates: nonOverlapping };
    }

    const longer = m0.length >= m1.length ? m0 : m1;
    const shorter = m0.length >= m1.length ? m1 : m0;
    return { parent: shorter, unit: longer, candidates: nonOverlapping };
}

// ═══════════════════════════════════════════════════════════════
// EXTRACT METADATA
// ═══════════════════════════════════════════════════════════════
function extractMetadata(text, catalog) {
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
        issuer_parent_unit_name: null,
    };

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // ── Số hiệu ──
    const codeRegex = new RegExp(PARSER_CONFIG.document_code, 'i');
    const codeMatch = text.match(codeRegex);
    if (codeMatch) {
        const num = codeMatch[1] || null;
        const sep = codeMatch[2] || '';
        const rawSuffix = codeMatch[3].replace(/\s*([\/\-])\s*/g, '$1').trim();

        result.document_number = num;
        result.document_code = num
            ? `${num}${sep || '/'}${rawSuffix}`
            : (sep ? `${sep}${rawSuffix}` : rawSuffix);

        const guessType = rawSuffix.split(/[-\/]/)[0];
        const catalogType = catalog.docTypes.find(
            t => t.type_id.toUpperCase() === guessType.toUpperCase()
        );
        if (catalogType) {
            result.doc_type_code = catalogType.type_id;
            result.doc_type_name = catalogType.name.toUpperCase();
        }
    }

    // ── Loại VB + Title ──
    const TITLE_STOP = new RegExp(PARSER_CONFIG.title_stop, 'i');
    const ROMAN_HEADING = new RegExp(PARSER_CONFIG.roman_heading);

    for (const pattern of catalog.patterns) {
        const match = text.match(pattern.compiled);
        if (!match) continue;

        result.doc_type_code = pattern.type_id;
        const catalogType = catalog.docTypes.find(t => t.type_id === pattern.type_id);
        if (catalogType) result.doc_type_name = catalogType.name.toUpperCase();

        const inlineTitle = match[1]?.trim();
        if (inlineTitle) {
            let mergedTitle = inlineTitle;
            const matchedLineIdx = lines.findIndex(l => l.includes(inlineTitle) || l === inlineTitle);

            if (matchedLineIdx >= 0) {
                for (let k = matchedLineIdx + 1; k < Math.min(matchedLineIdx + 4, lines.length); k++) {
                    const next = lines[k];
                    if (!next) break;
                    if (TITLE_STOP.test(next)) break;
                    if (ROMAN_HEADING.test(next)) break;
                    if (/^-\s/.test(next)) break;
                    if (/^#/.test(next)) break;
                    if (/^[A-ZÀ-Ỹ0-9\s\.\-]+$/.test(next) && next.length > 10) break;

                    if (/^[a-zà-ỹ]/.test(next) || /^(và|của|về|nhằm|để)\s/i.test(next)) {
                        mergedTitle += ' ' + next;
                    } else {
                        break;
                    }
                }
            }
            result.title = mergedTitle;
        } else {
            const idx = lines.findIndex(l => {
                try { return pattern.compiled.test(l); } catch { return false; }
            });
            if (idx >= 0) {
                const parts = [];
                for (let j = idx + 1; j < Math.min(idx + 6, lines.length); j++) {
                    const line = lines[j];
                    if (TITLE_STOP.test(line)) break;
                    if (ROMAN_HEADING.test(line)) break;
                    if (/^-\s/.test(line)) break;
                    if (/^#/.test(line)) break;
                    if (line.length < 5 && !/^\d+$/.test(line)) break;
                    parts.push(line);
                }
                if (parts.length > 0) result.title = parts.join(' ');
            }
        }
        break;
    }

    // ── Ngày ban hành ──
    const dateRegex = new RegExp(PARSER_CONFIG.issued_date, 'i');
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
        const day = dateMatch[1] || '01';
        const month = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3];
        result.issued_date = `${year}-${month}-${day.padStart(2, '0')}`;
    }

    // ── Người ký ──
    if (catalog.rankPattern) {
        const signerRegex = new RegExp(
            `(${catalog.rankPattern})\\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+)`
        );
        const signerMatch = text.match(signerRegex);
        if (signerMatch) {
            result.signer = `${signerMatch[1]} ${signerMatch[2]}`.trim();
        }
    }

    if (!result.signer) {
        const POSITION_SIGNER = /^(BÍ THƯ|PHÓ BÍ THƯ|T\/M|KT\.|TM\.|CHỦ TỊCH|PHÓ CHỦ TỊCH|CHÍNH ỦY|CHÍNH UỶ)/i;
        const NAME_REGEX = new RegExp(PARSER_CONFIG.signer_name);

        for (let i = 0; i < lines.length - 1; i++) {
            if (POSITION_SIGNER.test(lines[i])) {
                for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                    if (NAME_REGEX.test(lines[j])) {
                        result.signer = lines[j];
                        break;
                    }
                }
                if (result.signer) break;
            }
        }
        if (!result.signer) {
            const tail = lines.slice(-15).reverse();
            for (const line of tail) {
                if (NAME_REGEX.test(line)) { result.signer = line; break; }
            }
        }
    }

    // ── Chức danh ──
    if (catalog.positionPattern) {
        const posMatches = [...text.matchAll(new RegExp(catalog.positionPattern, 'g'))];
        if (posMatches.length > 0) {
            const longest = posMatches.reduce((a, b) => a[0].length >= b[0].length ? a : b);
            result.signer_position = longest[0];
        }
    }

    // ── ĐƠN VỊ BAN HÀNH — DB-first scan ──
    const unitScan = findUnitsInText(text, catalog, {
        maxLinesToScan: 12,
        minLength: 5,
        allowSingleLevel: true,
    });

    if (unitScan.parent) {
        result.issuer_parent_unit_name = unitScan.parent.name;
    }
    if (unitScan.unit) {
        result.issuer_unit_name = unitScan.unit.name;
    }

    // Fallback regex đơn giản — CHỈ khi LENIENT mode và DB không match
    if (!STRICT_MODE && !result.issuer_unit_name) {
        const FALLBACK_COMMAND = /^(Đ[ẢA]NG\s*B[ỘO]|QU[ÂA]N\s*KHU|B[ỘO]\s*T[ƯU]\s*L[ỆE]NH|S[ƯU]\s*ĐO[ÀA]N|TRUNG\s*ĐO[ÀA]N|L[ỮU]\s*ĐO[ÀA]N|TI[ỂE]U\s*ĐO[ÀA]N|Đ[ẠA]I\s*Đ[ỘO]I)/;
        const FALLBACK_UNIT = /(Đ[ẢA]NG\s*[ỦU]Y|TR[ƯU][ỜO]NG|S[ƯU]\s*ĐO[ÀA]N|TRUNG\s*ĐO[ÀA]N|L[ỮU]\s*ĐO[ÀA]N|TI[ỂE]U\s*ĐO[ÀA]N|PH[ÒO]NG|BAN|KHOA|VI[ỆE]N|TRUNG\s*T[ÂA]M|Đ[ỘO]I)/;

        for (let i = 0; i < Math.min(lines.length - 1, 8); i++) {
            const l1 = lines[i];
            const l2 = lines[i + 1];
            const isUpper1 = /^[A-ZÀ-Ỹ0-9\s\.\-]+$/.test(l1) && l1.length >= 4;
            const isUpper2 = /^[A-ZÀ-Ỹ0-9\s\.\-]+$/.test(l2) && l2.length >= 4;
            if (!isUpper1 || !isUpper2) continue;
            if (/C[ỘO]NG\s*HO[ÀA]/i.test(l1)) continue;
            if (/^S[ốo]\s*:/i.test(l2)) continue;

            if (FALLBACK_COMMAND.test(l1) || FALLBACK_UNIT.test(l2)) {
                result.issuer_parent_unit_name = l1;
                result.issuer_unit_name = l2;
                break;
            }
        }

        if (!result.issuer_unit_name) {
            for (const line of lines.slice(0, 15)) {
                if (!/^[A-ZÀ-Ỹ0-9\s\.\-]+$/.test(line)) continue;
                if (line.length < 5) continue;
                if (/C[ỘO]NG\s*HO[ÀA]/i.test(line)) continue;
                if (FALLBACK_UNIT.test(line)) {
                    result.issuer_unit_name = line;
                    break;
                }
            }
        }
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════
// MISSING / MERGE
// ═══════════════════════════════════════════════════════════════
function getMissingFields(parsed) {
    const missing = [];
    const required = ['document_code', 'doc_type_code', 'title', 'issued_date', 'signer'];
    for (const f of required) {
        if (!parsed[f] || (typeof parsed[f] === 'string' && !parsed[f].trim())) missing.push(f);
    }
    if (parsed.document_code && !parsed.document_number && (
        parsed.document_code.startsWith('/') ||
        parsed.document_code.startsWith('-') ||
        /^[A-ZĐ]/.test(parsed.document_code)
    )) {
        if (!missing.includes('document_code')) missing.push('document_code');
    }
    if (parsed.issued_date && parsed.issued_date.endsWith('-01')) {
        if (!missing.includes('issued_date')) missing.push('issued_date');
    }
    return missing;
}

function mergeMissingFields(primary, fallback, missingFields) {
    const merged = { ...primary };
    const sources = {};
    for (const key of Object.keys(primary)) {
        if (primary[key] !== null && primary[key] !== undefined) sources[key] = 'text';
    }
    for (const field of missingFields) {
        if (fallback[field]) {
            merged[field] = fallback[field];
            sources[field] = 'ocr';
        }
    }
    if (primary.document_code && fallback.document_number) {
        let rebuilt = null;
        if (primary.document_code.startsWith('/') || primary.document_code.startsWith('-')) {
            rebuilt = `${fallback.document_number}${primary.document_code}`;
        } else if (!primary.document_number && /^[A-ZĐ]/.test(primary.document_code)) {
            rebuilt = `${fallback.document_number}/${primary.document_code}`;
        }
        if (rebuilt) {
            merged.document_code = rebuilt;
            merged.document_number = fallback.document_number;
            sources.document_code = 'text+ocr';
            sources.document_number = 'ocr';
        }
    }
    if (primary.issued_date && primary.issued_date.endsWith('-01') &&
        fallback.issued_date && !fallback.issued_date.endsWith('-01')) {
        merged.issued_date = fallback.issued_date;
        sources.issued_date = 'text+ocr';
    }
    return { merged, sources };
}

// ═══════════════════════════════════════════════════════════════
// [FIX] OCR các trang cuối để tìm người ký
// ═══════════════════════════════════════════════════════════════
async function ocrSignerFromTail(buffer, catalog, nLastPages = 3) {
    console.log(`[signer-ocr] OCR ${nLastPages} trang cuối để tìm người ký...`);
    const images = await renderPdfToImages(buffer, 3);
    if (images.length === 0) {
        console.log('[signer-ocr] Không render được PDF');
        return null;
    }

    const lastPages = images.slice(-nLastPages);
    for (let i = 0; i < lastPages.length; i++) {
        const pageIdx = images.length - lastPages.length + i + 1;
        const ocrText = await ocrImage(lastPages[i]);
        if (!ocrText || ocrText.trim().length < 20) {
            console.log(`[signer-ocr] Page ${pageIdx}: OCR rỗng/ngắn, bỏ qua`);
            continue;
        }

        // Bước 1: extract theo catalog (rank + name)
        const parsed = extractMetadata(ocrText, catalog);
        if (parsed.signer) {
            console.log(`[signer-ocr] ✅ Page ${pageIdx} (catalog): "${parsed.signer}"`);
            return { signer: parsed.signer, signer_position: parsed.signer_position, page: pageIdx };
        }

        // [FIX] Bước 2: fallback rank hardcoded (khi DB MILITARY_RANK thiếu data)
        const RANK_HARDCODED = /(Đại tướng|Thượng tướng|Trung tướng|Thiếu tướng|Đại tá|Thượng tá|Trung tá|Thiếu tá|Đại úy|Thượng úy|Trung úy|Thiếu úy|Chuẩn úy)/;
        const rankMatch = ocrText.match(RANK_HARDCODED);
        if (rankMatch) {
            // Tìm tên người VN gần sau rank
            const afterRank = ocrText.slice(rankMatch.index + rankMatch[0].length);
            const nameMatch = afterRank.match(/^\s*,?\s*([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})/);
            if (nameMatch) {
                const fullSigner = `${rankMatch[0]} ${nameMatch[1]}`.trim();
                console.log(`[signer-ocr] ✅ Page ${pageIdx} (hardcoded): "${fullSigner}"`);
                return { signer: fullSigner, signer_position: null, page: pageIdx };
            }
        }

        // [FIX] Bước 3: fallback tên thuần Việt — lấy dòng cuối cùng có dạng tên người
        const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);
        const nameRegex = /^[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3}$/;
        for (let k = lines.length - 1; k >= Math.max(0, lines.length - 15); k--) {
            if (nameRegex.test(lines[k]) && lines[k].length >= 8) {
                console.log(`[signer-ocr] ⚠️ Page ${pageIdx} (name-only, không rõ rank): "${lines[k]}"`);
                return { signer: lines[k], signer_position: null, page: pageIdx, warning: 'no_rank' };
            }
        }

        console.log(`[signer-ocr] Page ${pageIdx}: không match signer. OCR text 200 ký tự cuối:`);
        console.log('   >', ocrText.slice(-200).replace(/\n/g, ' | '));
    }
    console.log('[signer-ocr] ⚠️ Không tìm thấy người ký sau khi OCR các trang cuối');
    return null;
}

// ═══════════════════════════════════════════════════════════════
// [FIX] OCR toàn bộ document khi phát hiện garbage text
// ═══════════════════════════════════════════════════════════════
async function ocrWholeDocument(buffer) {
    console.log('[full-ocr] OCR toàn bộ document (phát hiện garbage text)...');
    const images = await renderPdfToImages(buffer, 3);
    if (images.length === 0) return '';
    let fullText = '';
    for (let i = 0; i < images.length; i++) {
        const t = await ocrImage(images[i]);
        fullText += t + '\n\n';
    }
    return fullText;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function parseDocumentPdf(buffer, deps = {}) {
    let catalog = null;
    if (deps.sql && deps.getPool) {
        try { catalog = await loadCatalogs(deps.getPool, deps.sql); }
        catch (err) { console.error('[parseDocumentPdf] Load catalog:', err.message); }
    }
    if (!catalog) {
        catalog = {
            docTypes: [], docTypeMap: {}, ranks: [], positions: [], units: [],
            rankPattern: '', positionPattern: '',
            rootUnits: [], childUnits: [], patterns: [],
        };
    }

    const { pages, fullText } = await extractTextItems(buffer);

    // [FIX] Phát hiện garbage text theo từng trang
    const pageTexts = pages.map(p => p.items.map(it => it.str).join(' '));
    const garbageFlags = pageTexts.map(t => isGarbageText(t));
    const garbageCount = garbageFlags.filter(Boolean).length;
    const garbageRatio = pages.length > 0 ? garbageCount / pages.length : 0;

    console.log(`[parse] Pages: ${pages.length}, garbage: ${garbageCount}/${pages.length} (${(garbageRatio * 100).toFixed(0)}%)`);

    const isDigital = fullText.trim().length > 50 && garbageRatio < 0.5;

    let parsed;
    let sources = {};

    if (isDigital) {
        parsed = extractMetadata(fullText, catalog);
        if (garbageCount > 0) {
            console.log(`[parse] ⚠️ Có ${garbageCount} trang bị garbage (sẽ OCR bổ sung nếu thiếu trường)`);
        }
    } else {
        // [FIX] OCR toàn bộ khi đa số trang là garbage
        console.log('[parse] Phát hiện scan/garbage → OCR toàn bộ document');
        const ocrFullText = await ocrWholeDocument(buffer);
        if (ocrFullText && ocrFullText.trim().length > 20) {
            parsed = extractMetadata(ocrFullText, catalog);
            sources = Object.fromEntries(Object.keys(parsed).filter(k => parsed[k]).map(k => [k, 'ocr']));
        } else {
            parsed = {
                document_code: null, document_number: null,
                doc_type_code: null, doc_type_name: null,
                title: null, issued_date: null,
                signer: null, signer_position: null,
                issuer_unit_name: null, issuer_parent_unit_name: null,
            };
        }
    }

    // ── [FIX] Xử lý theo nhóm trường thiếu ──
    const missing = getMissingFields(parsed);

    // Nhóm 1: trường ở đầu văn bản → OCR page 1
    const earlyMissing = missing.filter(f =>
        ['document_code', 'doc_type_code', 'title', 'issued_date'].includes(f)
    );
    // Nhóm 2: trường ở cuối văn bản → OCR các trang cuối
    const lateMissing = missing.filter(f =>
        ['signer', 'signer_position'].includes(f)
    );

    if (earlyMissing.length > 0) {
        console.log(`[parse] Thiếu (đầu VB): ${earlyMissing.join(', ')} → OCR page 1`);
        const images = await renderPdfToImages(buffer, 3);
        if (images.length > 0) {
            const ocrText = await ocrImage(images[0]);
            if (ocrText && ocrText.trim().length > 20) {
                const ocrParsed = extractMetadata(ocrText, catalog);
                const merged = mergeMissingFields(parsed, ocrParsed, earlyMissing);
                parsed = merged.merged;
                sources = { ...sources, ...merged.sources };
            }
        }
    }

    if (lateMissing.includes('signer')) {
        console.log(`[parse] Thiếu (cuối VB): signer → OCR các trang cuối`);
        const signerResult = await ocrSignerFromTail(buffer, catalog, 3);
        if (signerResult) {
            parsed.signer = signerResult.signer;
            if (!parsed.signer_position && signerResult.signer_position) {
                parsed.signer_position = signerResult.signer_position;
            }
            sources.signer = 'ocr-tail';
            console.log(`[parse] ✅ Signer từ OCR cuối: "${parsed.signer}"`);
        }
    }

    // ── Số hiệu bị ẩn → OCR vùng header ──
    if (
        parsed.document_code &&
        !parsed.document_number &&
        (parsed.document_code.startsWith('/') || parsed.document_code.startsWith('-'))
    ) {
        console.log('[parse] Số hiệu bị ẩn → OCR vùng header');
        const headerNumber = await ocrNumberFromHeader(buffer, pages);

        if (headerNumber) {
            parsed.document_number = headerNumber;
            parsed.document_code = `${headerNumber}${parsed.document_code}`;
            sources.document_code = 'text+header-ocr';
            sources.document_number = 'header-ocr';
            console.log(`[parse] ✅ Số hiệu: "${parsed.document_code}"`);
        } else {
            console.log('[parse] ⚠️ Header OCR không đọc được — user nhập tay');
        }
    }

    // Gán source mặc định cho các field đã có
    for (const key of Object.keys(parsed)) {
        if (parsed[key] !== null && !sources[key]) {
            sources[key] = isDigital ? 'text' : 'ocr';
        }
    }

    // ── Match đơn vị với DB ──
    let issuer_parent_unit_id = null, issuer_unit_id = null;
    let parent_matched = false, unit_matched = false;

    if (deps.sql && deps.getPool) {
        if (parsed.issuer_parent_unit_name) {
            const m = await matchUnitByName(deps.getPool, deps.sql, parsed.issuer_parent_unit_name);
            if (m) { issuer_parent_unit_id = m.unit_id; parent_matched = true; }
        }
        if (parsed.issuer_unit_name) {
            const m = await matchUnitByName(deps.getPool, deps.sql, parsed.issuer_unit_name);
            if (m) { issuer_unit_id = m.unit_id; unit_matched = true; }
        }
    }

    let issuer_display = null;
    if (parsed.issuer_parent_unit_name && parsed.issuer_unit_name) {
        issuer_display = `${parsed.issuer_parent_unit_name} — ${parsed.issuer_unit_name}`;
    } else if (parsed.issuer_unit_name) {
        issuer_display = parsed.issuer_unit_name;
    } else if (parsed.issuer_parent_unit_name) {
        issuer_display = parsed.issuer_parent_unit_name;
    }

    // ── [FIX] Cập nhật lại missingFields sau khi OCR ──
    const finalMissing = getMissingFields(parsed);

    return {
        success: true,
        source: isDigital ? 'digital' : 'scan',
        usedOcr: finalMissing.length < missing.length || missing.length > 0,
        missingFields: finalMissing,
        parsed: {
            ...parsed,
            issuer_parent_unit_id,
            issuer_unit_id,
            issuer_display,
            parent_matched,
            unit_matched,
        },
        sources,
        diagnostics: {
            totalPages: pages.length,
            garbagePages: garbageCount,
            garbageRatio: parseFloat(garbageRatio.toFixed(2)),
            detectedGarbage: garbageCount > 0,
        },
    };
}

module.exports = { parseDocumentPdf, invalidateCatalogCache };