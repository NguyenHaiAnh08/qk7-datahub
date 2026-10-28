const pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// LOAD CONFIG — regex cấu trúc (JSON)
// ═══════════════════════════════════════════════════════════════
const CONFIG_PATH = path.join(__dirname, 'config', 'parser-patterns.json');

// [PATCH 3 — 4.1]
// ═══════════════════════════════════════════════════════════════
// [v4.3] CONFIG MẶC ĐỊNH — Chỉ là fallback an toàn khi thiếu file JSON.
// Giá trị thực tế được đọc từ config/parser-patterns.json + env vars.
// ═══════════════════════════════════════════════════════════════
let PARSER_CONFIG = {
    document_code: 'S\\s*[ốo]\\s*[:.]?\\s*(\\d{1,5})?\\s*([\\/\\-])?\\s*([A-ZĐ][A-ZĐ0-9\\-]*(?:[\\/\\-][A-ZĐ0-9]+)*)',
    issued_date: 'ng[àa]y\\s*(\\d+)?\\s*th[áa]ng\\s*(\\d+)\\s*n[ăa]m\\s*(\\d{4})',
    title_stop: '^(Căn cứ|Kính gửi|Thực hiện|Căn cứ vào|HIỆU TRƯỞNG|CHỦ TỊCH|KT\\.|TM\\.|T\\/M|Nơi nhận)',
    roman_heading: '^\\s*(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)[\\-\\s\\.]',
    signer_name: '^[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,4}$',

    suspicious_code_patterns: ['^\\d{1,3}/\\d{1,3}$', '^/[^A-ZĐ]', '^-', '^\\d+$'],
    code_rematch_strict: 'S[ốo]\\s*[:.]?\\s*(\\d{1,5})\\s*[\\/\\-]\\s*([A-ZĐ][A-ZĐ0-9\\/\\-]*(?:\\s+[A-ZĐ0-9][A-ZĐ0-9\\/\\-]+)*)',
    fallback_command: '^(Đ[ẢA]NG\\s*B[ỘO]|QU[ÂA]N\\s*KHU|B[ỘO]\\s*T[ƯU]\\s*L[ỆE]NH|S[ƯU]\\s*ĐO[ÀA]N|TRUNG\\s*ĐO[ÀA]N|L[ỮU]\\s*ĐO[ÀA]N|TI[ỂE]U\\s*ĐO[ÀA]N|Đ[ẠA]I\\s*Đ[ỘO]I)',
    fallback_unit: '(Đ[ẢA]NG\\s*[ỦU]Y|TR[ƯU][ỜO]NG|S[ƯU]\\s*ĐO[ÀA]N|TRUNG\\s*ĐO[ÀA]N|L[ỮU]\\s*ĐO[ÀA]N|TI[ỂE]U\\s*ĐO[ÀA]N|PH[ÒO]NG|BAN|KHOA|VI[ỆE]N|TRUNG\\s*T[ÂA]M|Đ[ỘO]I)',
    rank_prefix: '\\b(Đại|Thượng|Trung|Thiếu|Chuẩn|Dai|Thuong|Thieu|Chuan)\\s+[A-ZÀ-Ỹa-zà-ỹ]{1,5}',

    extract_text: {
        same_line_tolerance_px: 5,
        mid_column_tolerance_ratio: 0.08,
    },
};

// ═══════════════════════════════════════════════════════════════
// [v4.3] ĐỌC NGƯỠNG TỪ ENV (không hard-code nữa)
// ═══════════════════════════════════════════════════════════════
const PARSER_THRESHOLDS = {
    garbageTcvnRatio: parseFloat(process.env.PARSER_GARBAGE_TCVN_RATIO || '0.03'),
    garbageMeaningfulRatio: parseFloat(process.env.PARSER_GARBAGE_MEANINGFUL_RATIO || '0.3'),
    ocrConfidenceMin: parseFloat(process.env.PARSER_OCR_CONFIDENCE_MIN || '70'),
    headerOcrDarkRatioMin: parseFloat(process.env.PARSER_HEADER_OCR_DARK_RATIO_MIN || '0.005'),
    headerOcrThreshold: parseInt(process.env.PARSER_HEADER_OCR_THRESHOLD || '140', 10),
    renderScale: parseInt(process.env.PARSER_RENDER_SCALE || '3', 10),
    headerRenderScale: parseInt(process.env.PARSER_HEADER_RENDER_SCALE || '4', 10),
    signerTailPages: parseInt(process.env.PARSER_SIGNER_TAIL_PAGES || '3', 10),
    earlyOcrPages: parseInt(process.env.PARSER_EARLY_OCR_PAGES || '1', 10),
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

// [PATCH 3 — 4.2]
// ═══════════════════════════════════════════════════════════════
// [v4.3] Compile 1 lần — tái sử dụng cho mọi lần parse
// ═══════════════════════════════════════════════════════════════
const COMPILED = {
    suspiciousCodePatterns: [],
    codeRematchStrict: null,
    fallbackCommand: null,
    fallbackUnit: null,
    rankPrefix: null,
    signerName: null,
    titleStop: null,
    romanHeading: null,
    codeStandard: null,
    issuedDate: null,
};

function compileParserRegexes() {
    try {
        COMPILED.suspiciousCodePatterns = (PARSER_CONFIG.suspicious_code_patterns || []).map((p) => new RegExp(p, 'i'));
        COMPILED.codeRematchStrict = new RegExp(PARSER_CONFIG.code_rematch_strict, 'i');
        COMPILED.fallbackCommand = new RegExp(PARSER_CONFIG.fallback_command);
        COMPILED.fallbackUnit = new RegExp(PARSER_CONFIG.fallback_unit);
        COMPILED.rankPrefix = new RegExp(PARSER_CONFIG.rank_prefix, 'gi');
        COMPILED.signerName = new RegExp(PARSER_CONFIG.signer_name, 'i');
        COMPILED.titleStop = new RegExp(PARSER_CONFIG.title_stop, 'i');
        COMPILED.romanHeading = new RegExp(PARSER_CONFIG.roman_heading);
        COMPILED.codeStandard = new RegExp(PARSER_CONFIG.document_code, 'i');
        COMPILED.issuedDate = new RegExp(PARSER_CONFIG.issued_date, 'i');
        console.log('[parser] ✅ Compiled all regexes from config');
    } catch (err) {
        console.error('[parser] ❌ Lỗi compile regex:', err.message);
        throw err;
    }
}
compileParserRegexes();

// [PATCH 3 — NEW] Helper làm sạch ký tự ẩn (zero-width, control, nbsp)
function sanitizeHiddenChars(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

const STRICT_MODE = (process.env.PARSER_STRICT_MODE || 'false').toLowerCase() === 'true';

// [PATCH 3 — 4.3] isGarbageText đọc ngưỡng từ PARSER_THRESHOLDS
function isGarbageText(text) {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.length < 50) return false;

    const tcvn3TypoCount = (trimmed.match(/[\u00A0-\u00BF]/g) || []).length;
    if (tcvn3TypoCount / trimmed.length > PARSER_THRESHOLDS.garbageTcvnRatio) return true;

    const tokens = trimmed.split(/\s+/).filter(t => t.length >= 2);
    const meaningfulTokens = tokens.filter(t => /^[a-zA-Z0-9À-ỹ]{2,}$/.test(t));
    const meaningfulChars = meaningfulTokens.reduce((sum, t) => sum + t.length, 0);
    return meaningfulChars / trimmed.length < PARSER_THRESHOLDS.garbageMeaningfulRatio;
}

// ═══════════════════════════════════════════════════════════════
// CACHE CATALOGS
// ═══════════════════════════════════════════════════════════════
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
let catalogCache = { data: null, loadedAt: 0 };

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ═══════════════════════════════════════════════════════════════
// FUZZY MATCHING
// ═══════════════════════════════════════════════════════════════
function removeDiacritics(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return dp[a.length][b.length];
}

function fuzzyMatch(input, candidates, threshold = 2) {
    if (!input || !candidates || candidates.length === 0) return null;
    const inputNorm = removeDiacritics(input);
    let best = null;
    let bestDist = Infinity;

    for (const c of candidates) {
        const cName = typeof c === 'string' ? c : (c?.name || '');
        if (!cName) continue;
        const cNorm = removeDiacritics(cName);
        const dist = levenshtein(inputNorm, cNorm);
        if (dist === 0) return cName;
        if (dist < bestDist && dist <= threshold) {
            bestDist = dist;
            best = cName;
        }
    }
    return best;
}

async function loadCatalogs(getPool, sql) {
    if (catalogCache.data && Date.now() - catalogCache.loadedAt < CATALOG_CACHE_TTL_MS) {
        return catalogCache.data;
    }

    const pool = await getPool();

    let docTypes = [];
    try {
        const typesRes = await pool.request().query(`SELECT type_id, name FROM DOCUMENT_TYPE`);
        docTypes = typesRes.recordset || [];
    } catch (err) {
        console.warn('[parser] Lỗi đọc DOCUMENT_TYPE:', err.message);
    }

    let ranks = [];
    try {
        const ranksRes = await pool.request().query(`SELECT name FROM MILITARY_RANK WHERE active = 1 ORDER BY sort_order`);
        ranks = ranksRes.recordset.map(r => r.name).filter(Boolean);
    } catch (err) {
        console.warn('[parser] Lỗi đọc MILITARY_RANK:', err.message);
    }

    let positions = [];
    try {
        const positionsRes = await pool.request().query(`SELECT name FROM MILITARY_POSITION WHERE active = 1 ORDER BY sort_order`);
        positions = positionsRes.recordset.map(p => p.name).filter(Boolean);
    } catch (err) {
        console.warn('[parser] Lỗi đọc MILITARY_POSITION:', err.message);
    }

    let units = [];
    try {
        const unitsRes = await pool.request().query(`
            SELECT u.unit_id, u.name, u.parent_id
            FROM UNIT u
            UNION
            SELECT ua.unit_id, ua.alias_text AS name, u.parent_id
            FROM UNIT_ALIAS ua
            JOIN UNIT u ON u.unit_id = ua.unit_id
        `);
        units = unitsRes.recordset || [];
    } catch (err) {
        console.warn('[parser] Không đọc được UNIT_ALIAS, fallback query bảng UNIT:', err.message);
        try {
            const fallbackUnits = await pool.request().query(`SELECT unit_id, name, parent_id FROM UNIT`);
            units = fallbackUnits.recordset || [];
        } catch (e) {
            console.error('[parser] Lỗi query UNIT:', e.message);
        }
    }

    let patterns = [];
    try {
        const patternsRes = await pool.request().query(`
            SELECT type_id, pattern_type, regex, priority
            FROM DOCUMENT_TYPE_PATTERN
            WHERE active = 1
            ORDER BY priority DESC, pattern_id
        `);
        patterns = patternsRes.recordset || [];
    } catch (err) {
        console.warn('[parser] Không đọc được DOCUMENT_TYPE_PATTERN từ DB, dùng pattern mặc định:', err.message);
    }

    if (!patterns || patterns.length === 0) {
        patterns = docTypes.map((dt, idx) => ({
            pattern_id: idx + 1,
            type_id: dt.type_id,
            pattern_type: 'header',
            regex: `^\\s*${escapeRegex(dt.name.toUpperCase())}\\s*(?:[:\\-\\.]\\s*(.*)|$)`,
            priority: 10
        }));
    }

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

    const posPatternStr = positions
        .map(p => {
            const withD = escapeRegex(p);
            const withoutD = escapeRegex(removeDiacritics(p));
            return withD === withoutD ? withD : `(?:${withD}|${withoutD})`;
        })
        .sort((a, b) => b.length - a.length)
        .join('|');

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
        posPatternStr,
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

// [PATCH 3 — 4.4] extractTextItems đọc tolerance từ config
async function extractTextItems(buffer) {
    const pdfjsLib = await pdfjsLibPromise;
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages = [];

    const sameLineTol = PARSER_CONFIG.extract_text?.same_line_tolerance_px ?? 5;
    const midColRatio = PARSER_CONFIG.extract_text?.mid_column_tolerance_ratio ?? 0.08;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();

        const rawItems = textContent.items
            .filter(it => typeof it.str === 'string' && it.str.length > 0)
            .map(it => ({
                str: it.str,
                x: it.transform?.[4] ?? 0,
                y: it.transform?.[5] ?? 0,
                width: it.width || 0,
                height: it.height || 0,
            }));

        rawItems.sort((a, b) => {
            const yDiff = b.y - a.y;
            if (Math.abs(yDiff) < sameLineTol) return a.x - b.x;
            return yDiff;
        });

        const lines = [];
        for (const it of rawItems) {
            const lastLine = lines[lines.length - 1];
            if (lastLine && Math.abs(lastLine.y - it.y) < sameLineTol) {
                lastLine.items.push(it);
                lastLine.maxX = Math.max(lastLine.maxX || 0, it.x + it.width);
            } else {
                lines.push({ y: it.y, items: [it], maxX: it.x + it.width });
            }
        }

        const midX = viewport.width / 2;
        const tolerance = viewport.width * midColRatio;

        const pageLines = lines.map(line => {
            const sortedItems = line.items.sort((a, b) => a.x - b.x);

            const leftItems = sortedItems.filter(it => it.x < midX - tolerance);
            const rightItems = sortedItems.filter(it => it.x > midX + tolerance);
            const crossItems = sortedItems.filter(it =>
                it.x >= midX - tolerance && it.x <= midX + tolerance
            );

            if (leftItems.length === 0 || rightItems.length === 0) {
                return sortedItems.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
            }

            const leftText = leftItems.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
            const rightText = rightItems.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
            const crossText = crossItems.map(it => it.str).join(' ').trim();

            const parts = [leftText, crossText, rightText].filter(Boolean);
            return parts.join(' | ');
        }).filter(Boolean);

        const pageText = pageLines.join('\n');

        pages.push({
            pageNum: i,
            items: rawItems,
            lines: pageLines,
            text: pageText,
            height: viewport.height,
            width: viewport.width,
        });
    }

    const fullText = pages.map(p => p.text).join('\n\n');
    return { pages, fullText };
}

// [PATCH 3 — 4.5] renderPdfToImages đọc scale mặc định từ PARSER_THRESHOLDS
async function renderPdfToImages(buffer, scale = PARSER_THRESHOLDS.renderScale) {
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

// [PATCH 3 — 4.6] ocrNumberFromHeader dùng PARSER_THRESHOLDS
async function ocrNumberFromHeader(buffer, pages) {
    if (!pages || pages.length === 0) return null;

    const page1 = pages[0];
    const items = page1.items || [];
    const pageHeight = page1.height || 842;

    const soItem = items.find(it => /^S[ốo]\s*:?\s*$/.test(it.str.trim()));
    if (!soItem) return null;

    const sameLine = items
        .filter(it => Math.abs(it.y - soItem.y) < 5 && it.x > soItem.x - 2)
        .sort((a, b) => a.x - b.x);

    let xStart = soItem.x + (soItem.width || 25);
    let xEnd = xStart + 100;

    for (const it of sameLine) {
        if (it.x <= soItem.x + 5) continue;
        if (!it.str.trim()) { xEnd = it.x + (it.width || 40); break; }
        if (it.str.includes('/')) { xEnd = it.x; break; }
    }

    if (xEnd <= xStart + 10) xEnd = xStart + 80;
    const cropWidthPDF = xEnd - xStart;
    if (cropWidthPDF < 20) return null;

    const images = await renderPdfToImages(buffer, PARSER_THRESHOLDS.headerRenderScale);
    if (images.length === 0) return null;
    const pageImage = images[0];

    const scale = PARSER_THRESHOLDS.headerRenderScale;
    const yTopPDF = pageHeight - soItem.y - 12;
    const yBottomPDF = pageHeight - soItem.y + 18;

    const cropX = Math.max(0, Math.round(xStart * scale) - 15);
    const cropY = Math.max(0, Math.round(yTopPDF * scale));
    const cropW = Math.round(cropWidthPDF * scale) + 30;
    const cropH = Math.round((yBottomPDF - yTopPDF) * scale);

    try {
        const sharp = require('sharp');
        const croppedBuffer = await sharp(pageImage)
            .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
            .grayscale()
            .normalize()
            .resize({ width: cropW * 3, kernel: 'lanczos3' })
            .sharpen()
            .threshold(PARSER_THRESHOLDS.headerOcrThreshold)
            .png()
            .toBuffer();

        const { data: rawPixels, info } = await sharp(croppedBuffer).raw().toBuffer({ resolveWithObject: true });

        let darkPixels = 0;
        const totalPixels = info.width * info.height;
        for (let i = 0; i < rawPixels.length; i += info.channels) {
            if (rawPixels[i] < 128) darkPixels++;
        }
        const darkRatio = darkPixels / totalPixels;

        if (darkRatio < PARSER_THRESHOLDS.headerOcrDarkRatioMin) return null;

        const { data } = await Tesseract.recognize(croppedBuffer, 'eng', {
            tessedit_char_whitelist: '0123456789',
            logger: () => {},
        });

        const cleaned = data.text.replace(/\D/g, '').trim();
        const confidence = data.confidence || 0;

        if (confidence < PARSER_THRESHOLDS.ocrConfidenceMin) return null;

        if (cleaned && cleaned.length >= 1 && cleaned.length <= 4) {
            const numVal = parseInt(cleaned, 10);
            if (numVal > 0 && numVal <= 9999) return cleaned;
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

// [PATCH 3 — 4.8] extractMetadata — dùng COMPILED thay toàn bộ regex hard-code
function extractMetadata(rawText, catalog) {
    const text = sanitizeHiddenChars(rawText);

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

    // ═══════════════════════════════════════════════════════════════
    // Số hiệu — Dùng COMPILED.codeStandard
    // ═══════════════════════════════════════════════════════════════
    const codeMatch = text.match(COMPILED.codeStandard);
    if (codeMatch) {
        const num = (codeMatch[1] || '').trim();
        const sep = codeMatch[2] || '/';
        const rawSuffix = (codeMatch[3] || '').replace(/\s*([\/\-])\s*/g, '$1').trim().toUpperCase();

        if (num) {
            result.document_number = num;
            result.document_code = `${num}${sep}${rawSuffix}`;
            const guessType = rawSuffix.split(/[\/\-]/)[0];
            const catalogType = catalog.docTypes.find(t => t.type_id.toUpperCase() === guessType.toUpperCase());
            if (catalogType) {
                result.doc_type_code = catalogType.type_id;
                result.doc_type_name = catalogType.name.toUpperCase();
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // [v4.3] Re-match suspicious code — đọc từ COMPILED
    // ═══════════════════════════════════════════════════════════════
    if (result.document_code) {
        const isSuspicious = COMPILED.suspiciousCodePatterns.some(p => p.test(result.document_code));
        if (isSuspicious) {
            const strictMatch = text.match(COMPILED.codeRematchStrict);
            if (strictMatch) {
                const fixedCode = `${strictMatch[1]}/${strictMatch[2]}`.replace(/\s+/g, '');
                if (fixedCode.length > result.document_code.length) {
                    result.document_number = strictMatch[1];
                    result.document_code = fixedCode;
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Ngày ban hành — COMPILED.issuedDate
    // ═══════════════════════════════════════════════════════════════
    const dateMatch = text.match(COMPILED.issuedDate);
    if (dateMatch) {
        const day = (dateMatch[1] || '').trim();
        const month = (dateMatch[2] || '').padStart(2, '0');
        const year = dateMatch[3];
        if (!day) result.issued_date = null;
        else result.issued_date = `${year}-${month}-${day.padStart(2, '0')}`;
    }

    // ═══════════════════════════════════════════════════════════════
    // Loại VB + Tiêu đề — COMPILED.titleStop / COMPILED.romanHeading
    // ═══════════════════════════════════════════════════════════════
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
                    if (COMPILED.titleStop.test(next)) break;
                    if (COMPILED.romanHeading.test(next)) break;
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
            const idx = lines.findIndex(l => { try { return pattern.compiled.test(l); } catch { return false; } });
            if (idx >= 0) {
                const parts = [];
                for (let j = idx + 1; j < Math.min(idx + 6, lines.length); j++) {
                    const line = lines[j];
                    if (COMPILED.titleStop.test(line)) break;
                    if (COMPILED.romanHeading.test(line)) break;
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

    // ═══════════════════════════════════════════════════════════════
    // Người ký — COMPILED.rankPrefix / COMPILED.signerName
    // ═══════════════════════════════════════════════════════════════
    if (catalog.rankPattern) {
        const signerRegex = new RegExp(`(${catalog.rankPattern})\\s+(?:QNCN\\s+)?([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,4})`);
        const signerMatch = text.match(signerRegex);
        if (signerMatch) result.signer = `${signerMatch[1]} ${signerMatch[2]}`.trim();
    }

    if (!result.signer && catalog.ranks && catalog.ranks.length > 0) {
        COMPILED.rankPrefix.lastIndex = 0;   // reset state (global regex)
        let rankMatch;
        while ((rankMatch = COMPILED.rankPrefix.exec(text)) !== null) {
            const matchedRank = fuzzyMatch(rankMatch[0], catalog.ranks);
            if (matchedRank) {
                const after = text.slice(rankMatch.index + rankMatch[0].length);
                const nameMatch = after.match(/^\s*,?\s*([A-ZÀ-Ỹa-zà-ỹ]+(?:\s+[A-ZÀ-Ỹa-zà-ỹ]+){1,4})/i);
                if (nameMatch) {
                    result.signer = `${matchedRank} ${nameMatch[1]}`.trim().replace(/\s+/g, ' ');
                    break;
                }
            }
        }
    }

    if (!result.signer && catalog.posPatternStr) {
        const POSITION_SIGNER = new RegExp(`(?:${catalog.posPatternStr})`, 'i');
        for (let i = lines.length - 1; i >= 0; i--) {
            if (POSITION_SIGNER.test(lines[i])) {
                for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                    if (POSITION_SIGNER.test(lines[j])) continue;
                    if (COMPILED.signerName.test(lines[j])) { result.signer = lines[j]; break; }
                }
                if (result.signer) break;
            }
        }
    }

    if (!result.signer) {
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            if (line.length < 8) continue;
            if (/^[0-9\s\.\,\-\/]+$/.test(line)) continue;
            if (!/[À-Ỹà-ỹ]/.test(line) && !/Đ|đ/.test(line)) continue;
            if (COMPILED.signerName.test(line)) { result.signer = line; break; }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Chức danh — từ catalog (DB)
    // ═══════════════════════════════════════════════════════════════
    if (catalog.positionPattern) {
        const posMatches = [...text.matchAll(new RegExp(catalog.positionPattern, 'g'))];
        if (posMatches.length > 0) {
            const longest = posMatches.reduce((a, b) => a[0].length >= b[0].length ? a : b);
            result.signer_position = longest[0];
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Đơn vị — DB-first (giữ nguyên logic cũ)
    // ═══════════════════════════════════════════════════════════════
    const unitScan = findUnitsInText(text, catalog, { maxLinesToScan: 12, minLength: 5, allowSingleLevel: true });
    if (unitScan.parent) result.issuer_parent_unit_name = unitScan.parent.name;
    if (unitScan.unit) result.issuer_unit_name = unitScan.unit.name;

    // Fallback — dùng COMPILED.fallbackCommand / COMPILED.fallbackUnit
    if (!STRICT_MODE && !result.issuer_unit_name) {
        for (let i = 0; i < Math.min(lines.length - 1, 8); i++) {
            const l1 = lines[i], l2 = lines[i + 1];
            const isUpper1 = /^[A-ZÀ-Ỹ0-9\s\.\-]+$/.test(l1) && l1.length >= 4;
            const isUpper2 = /^[A-ZÀ-Ỹ0-9\s\.\-]+$/.test(l2) && l2.length >= 4;
            if (!isUpper1 || !isUpper2) continue;
            if (/C[ỘO]NG\s*HO[ÀA]/i.test(l1)) continue;
            if (/^S[ốo]\s*:/i.test(l2)) continue;
            if (COMPILED.fallbackCommand.test(l1) || COMPILED.fallbackUnit.test(l2)) {
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
                if (COMPILED.fallbackUnit.test(line)) { result.issuer_unit_name = line; break; }
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

// [PATCH 3 — 4.7] ocrSignerFromTail default nLastPages từ env
async function ocrSignerFromTail(buffer, catalog, nLastPages = PARSER_THRESHOLDS.signerTailPages) {
    console.log(`[signer-ocr] OCR ${nLastPages} trang cuối để tìm người ký...`);
    const images = await renderPdfToImages(buffer, PARSER_THRESHOLDS.renderScale);
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

        const parsed = extractMetadata(ocrText, catalog);
        if (parsed.signer) {
            console.log(`[signer-ocr] ✅ Page ${pageIdx} (catalog): "${parsed.signer}"`);
            return { signer: parsed.signer, signer_position: parsed.signer_position, page: pageIdx };
        }

        if (catalog.ranks && catalog.ranks.length > 0) {
            const rankPrefixRegex = /\b(Đại|Thượng|Trung|Thiếu|Chuẩn|Dai|Thuong|Thieu|Chuan)\s+[A-ZÀ-Ỹa-zà-ỹ]{1,5}/gi;
            let rankMatch;
            while ((rankMatch = rankPrefixRegex.exec(ocrText)) !== null) {
                const matchedRank = fuzzyMatch(rankMatch[0], catalog.ranks);
                if (matchedRank) {
                    const after = ocrText.slice(rankMatch.index + rankMatch[0].length);
                    const nameMatch = after.match(/^\s*,?\s*([A-ZÀ-Ỹa-zà-ỹ]+(?:\s+[A-ZÀ-Ỹa-zà-ỹ]+){1,4})/i);
                    if (nameMatch) {
                        const fullSigner = `${matchedRank} ${nameMatch[1]}`.trim().replace(/\s+/g, ' ');
                        console.log(`[signer-ocr] ✅ Page ${pageIdx} (fuzzy DB): "${fullSigner}"`);
                        return { signer: fullSigner, signer_position: null, page: pageIdx };
                    }
                }
            }
        }

        const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);
        const nameRegex = /^[A-ZÀ-Ỹa-zà-ỹ]+(?:\s+[A-ZÀ-Ỹa-zà-ỹ]+){1,4}$/i;

        for (let k = lines.length - 1; k >= Math.max(0, lines.length - 20); k--) {
            const line = lines[k];
            if (line.length < 8) continue;
            if (/^[0-9\s\.\,\-\/]+$/.test(line)) continue;
            if (!/[À-Ỹà-ỹ]/.test(line) && !/Đ|đ/.test(line)) continue;

            if (nameRegex.test(line)) {
                console.log(`[signer-ocr] ⚠️ Page ${pageIdx} (name-only, không rõ rank): "${line}"`);
                return { signer: line, signer_position: null, page: pageIdx, warning: 'no_rank' };
            }
        }

        console.log(`[signer-ocr] Page ${pageIdx}: không match signer. OCR text 200 ký tự cuối:`);
        console.log('   >', ocrText.slice(-200).replace(/\n/g, ' | '));
    }
    console.log('[signer-ocr] ⚠️ Không tìm thấy người ký sau khi OCR các trang cuối');
    return null;
}

async function ocrWholeDocument(buffer) {
    console.log('[full-ocr] OCR toàn bộ document (phát hiện garbage text)...');
    const images = await renderPdfToImages(buffer, PARSER_THRESHOLDS.renderScale);
    if (images.length === 0) return '';
    let fullText = '';
    for (let i = 0; i < images.length; i++) {
        const t = await ocrImage(images[i]);
        fullText += t + '\n\n';
    }
    return fullText;
}

function normalizeRankName(signer, catalog) {
    if (!signer || !catalog || !catalog.ranks || catalog.ranks.length === 0) return signer;

    const parts = signer.trim().split(/\s+/);
    for (let n = Math.min(3, parts.length - 1); n >= 2; n--) {
        const rankPart = parts.slice(0, n).join(' ');
        const matched = fuzzyMatch(rankPart, catalog.ranks);
        if (matched) {
            const namePart = parts.slice(n).join(' ');
            return namePart ? `${matched} ${namePart}` : matched;
        }
    }
    return signer;
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

    const missing = getMissingFields(parsed);

    const earlyMissing = missing.filter(f =>
        ['document_code', 'doc_type_code', 'title', 'issued_date'].includes(f)
    );
    const lateMissing = missing.filter(f =>
        ['signer', 'signer_position'].includes(f)
    );

    if (earlyMissing.length > 0) {
        console.log(`[parse] Thiếu (đầu VB): ${earlyMissing.join(', ')} → OCR page 1`);
        const images = await renderPdfToImages(buffer, PARSER_THRESHOLDS.renderScale);
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
        // [PATCH 3 — 4.7] không truyền cứng 3 → dùng PARSER_THRESHOLDS.signerTailPages
        const signerResult = await ocrSignerFromTail(buffer, catalog);
        if (signerResult) {
            parsed.signer = signerResult.signer;
            if (!parsed.signer_position && signerResult.signer_position) {
                parsed.signer_position = signerResult.signer_position;
            }
            sources.signer = 'ocr-tail';
            console.log(`[parse] ✅ Signer từ OCR cuối: "${parsed.signer}"`);
        }
    }

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

    for (const key of Object.keys(parsed)) {
        if (parsed[key] !== null && !sources[key]) {
            sources[key] = isDigital ? 'text' : 'ocr';
        }
    }

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

    if (parsed.signer && catalog) {
        parsed.signer = normalizeRankName(parsed.signer, catalog);
    }

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

// [PATCH 3 — 4.9] Export thêm để test/script bên ngoài dùng
module.exports = {
    parseDocumentPdf,
    invalidateCatalogCache,
    sanitizeHiddenChars,
    PARSER_THRESHOLDS,
    compileParserRegexes,
};