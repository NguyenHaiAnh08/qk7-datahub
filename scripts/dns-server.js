#!/usr/bin/env node
// ==============================================================================
// scripts/dns-server.js — Máy Chủ DNS Nội Bộ Tự Chủ 100% (RFC 1035 — Zero Deps)
// ==============================================================================
// Giải pháp Phương Án 2 (Cấp Đơn Vị / Trường Quân Sự — 50 đến 5.000+ PC & iPad Air M4):
//   - Không cần Internet, không cần Docker, không cần sửa file hosts trên máy con.
//   - Trả lời tức thì (<1ms) cho trungtamdulieuso.tqsqk7.edu, *.tqsqk7.edu, tqsqk7.cntt
//     trỏ về đúng SERVER_IP trong file .env (tự động nạp lại sau 3 giây khi đổi IP
//     bằng lệnh scripts\doi-ip.bat <IP_MỚI>).
//   - Hỗ trợ đồng thời UDP :53 và TCP :53, trả NOERROR/NODATA chuẩn cho AAAA & HTTPS
//     (Type 65) để Safari trên iPad Air M4 kết nối ngay lập tức qua IPv4.
// ==============================================================================
'use strict';

const dgram = require('dgram');
const net = require('net');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PATHS = [
  path.join(ROOT_DIR, '.env'),
  path.join(ROOT_DIR, 'backend', '.env'),
];

// Phân tích tham số CLI tùy chọn: --port 53 --ip 192.168.1.229 --domain trungtamdulieuso.tqsqk7.edu --upstream none
const cliArgs = {};
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith('--') && i + 1 < process.argv.length) {
    cliArgs[arg.slice(2)] = process.argv[++i];
  }
}

const DNS_PORT = parseInt(cliArgs.port || process.env.DNS_PORT || '53', 10);
const DNS_BIND = cliArgs.bind || process.env.DNS_BIND || '0.0.0.0';
const DNS_TTL = parseInt(cliArgs.ttl || process.env.DNS_TTL || '30', 10);

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in out)) out[key] = val;
  }
  return out;
}

function isValidIPv4(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

let state = {
  serverIp: '127.0.0.1',
  serverDomain: 'trungtamdulieuso.tqsqk7.edu',
  baseZone: 'tqsqk7.edu',
  upstream: '',
  envMtimes: {},
};

function loadConfig(forceLog = false) {
  const merged = {};
  const mtimes = {};
  let changed = false;

  for (const p of ENV_PATHS) {
    try {
      const st = fs.statSync(p);
      mtimes[p] = st.mtimeMs;
      if (state.envMtimes[p] !== st.mtimeMs) changed = true;
    } catch (_) {
      mtimes[p] = 0;
    }
  }

  if (!changed && !forceLog) return;
  state.envMtimes = mtimes;

  // Root .env ưu tiên cao hơn backend/.env
  for (const p of ENV_PATHS) {
    const parsed = parseEnvFile(p);
    for (const [k, v] of Object.entries(parsed)) {
      if (!(k in merged) && v !== '') merged[k] = v;
    }
  }

  const nextIp = cliArgs.ip || merged.SERVER_IP || process.env.SERVER_IP || '127.0.0.1';
  const nextDomain = (cliArgs.domain || merged.SERVER_DOMAIN || process.env.SERVER_DOMAIN || 'trungtamdulieuso.tqsqk7.edu').toLowerCase();
  const nextUpstreamRaw = (cliArgs.upstream ?? merged.DNS_UPSTREAM ?? process.env.DNS_UPSTREAM ?? '192.168.1.1').trim().toLowerCase();
  const nextUpstream = (nextUpstreamRaw && nextUpstreamRaw !== 'none' && nextUpstreamRaw !== 'off' && isValidIPv4(nextUpstreamRaw) && nextUpstreamRaw !== nextIp)
    ? nextUpstreamRaw
    : '';

  const parts = nextDomain.split('.');
  const nextBaseZone = parts.length >= 2 ? parts.slice(-2).join('.') : nextDomain;

  const ipChanged = nextIp !== state.serverIp || nextDomain !== state.serverDomain || nextUpstream !== state.upstream;

  if (isValidIPv4(nextIp)) {
    state.serverIp = nextIp;
  } else {
    console.warn(`[DNS] ⚠️ SERVER_IP "${nextIp}" không phải IPv4 hợp lệ, giữ nguyên ${state.serverIp}`);
  }
  state.serverDomain = nextDomain;
  state.baseZone = nextBaseZone;
  state.upstream = nextUpstream;

  if (forceLog || ipChanged) {
    console.log(`[DNS] 🔄 Cấu hình phân giải: ${state.serverDomain} (*.${state.baseZone}, tqsqk7.cntt) -> ${state.serverIp} (TTL ${DNS_TTL}s)`);
    console.log(`[DNS]    Chế độ ngoài miền: ${state.upstream ? `Chuyển tiếp nội bộ tới ${state.upstream}:53` : '100% Air-Gapped (Trả NXDOMAIN tức thì)'}`);
  }
}

function parseQuestion(msg) {
  if (!Buffer.isBuffer(msg) || msg.length < 12) return null;
  const qdcount = msg.readUInt16BE(4);
  if (qdcount < 1) return null;

  let offset = 12;
  const labels = [];
  let safety = 0;

  while (offset < msg.length && safety < 128) {
    safety++;
    const len = msg[offset];
    if (len === 0) {
      offset += 1;
      break;
    }
    if ((len & 0xc0) === 0xc0) {
      // Compression pointer (hiếm gặp ở Question, dừng an toàn)
      offset += 2;
      break;
    }
    offset += 1;
    if (offset + len > msg.length) return null;
    labels.push(msg.subarray(offset, offset + len).toString('ascii'));
    offset += len;
  }

  if (offset + 4 > msg.length) return null;
  const qtype = msg.readUInt16BE(offset);
  const qclass = msg.readUInt16BE(offset + 2);
  const questionEnd = offset + 4;

  return {
    id: msg.readUInt16BE(0),
    flags: msg.readUInt16BE(2),
    qname: labels.join('.').toLowerCase(),
    qtype,
    qclass,
    rawQuestion: msg.subarray(12, questionEnd),
  };
}

function isAuthoritativeDomain(qname) {
  if (!qname) return false;
  if (qname === state.serverDomain) return true;
  if (qname === state.baseZone || qname.endsWith('.' + state.baseZone)) return true;
  if (qname === 'tqsqk7.cntt' || qname.endsWith('.tqsqk7.cntt')) return true;
  return false;
}

function buildResponse(query, { rcode = 0, authoritative = true, answerIp = null }) {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(query.id, 0);

  const opcode = query.flags & 0x7800;
  const rd = query.flags & 0x0100;
  const aa = authoritative ? 0x0400 : 0x0000;
  const ra = 0x0080;
  const qr = 0x8000;
  const outFlags = qr | opcode | aa | rd | ra | (rcode & 0x000f);

  header.writeUInt16BE(outFlags, 2);
  header.writeUInt16BE(1, 4); // QDCOUNT
  header.writeUInt16BE(answerIp ? 1 : 0, 6); // ANCOUNT
  header.writeUInt16BE(0, 8); // NSCOUNT
  header.writeUInt16BE(0, 10); // ARCOUNT

  if (!answerIp) {
    return Buffer.concat([header, query.rawQuestion]);
  }

  const ipBytes = answerIp.split('.').map((n) => parseInt(n, 10) & 0xff);
  const answer = Buffer.alloc(16);
  answer.writeUInt16BE(0xc00c, 0); // Con trỏ trỏ về QNAME tại offset 12
  answer.writeUInt16BE(1, 2);      // TYPE = A (IPv4)
  answer.writeUInt16BE(1, 4);      // CLASS = IN
  answer.writeUInt32BE(DNS_TTL, 6);// TTL
  answer.writeUInt16BE(4, 10);     // RDLENGTH = 4
  answer[12] = ipBytes[0];
  answer[13] = ipBytes[1];
  answer[14] = ipBytes[2];
  answer[15] = ipBytes[3];

  return Buffer.concat([header, query.rawQuestion, answer]);
}

function forwardToUpstream(msg, callback) {
  const client = dgram.createSocket('udp4');
  let finished = false;

  const timer = setTimeout(() => {
    if (finished) return;
    finished = true;
    try { client.close(); } catch (_) {}
    callback(null);
  }, 2000);

  client.once('message', (reply) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    try { client.close(); } catch (_) {}
    callback(reply);
  });

  client.once('error', () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    try { client.close(); } catch (_) {}
    callback(null);
  });

  client.send(msg, 53, state.upstream);
}

function handleDnsPacket(msg, remoteAddr, sendReply) {
  const query = parseQuestion(msg);
  if (!query) return;

  if (isAuthoritativeDomain(query.qname)) {
    // TYPE 1 = A, TYPE 255 = ANY -> Trả IP máy chủ ngay lập tức
    if (query.qtype === 1 || query.qtype === 255) {
      const resp = buildResponse(query, { rcode: 0, authoritative: true, answerIp: state.serverIp });
      sendReply(resp);
      return;
    }
    // TYPE 28 = AAAA, TYPE 65 = HTTPS/SVCB (iPadOS Safari!) -> Trả NOERROR không bản ghi để chuyển sang IPv4 ngay
    const resp = buildResponse(query, { rcode: 0, authoritative: true, answerIp: null });
    sendReply(resp);
    return;
  }

  // Miền ngoài tqsqk7.edu: nếu có DNS_UPSTREAM thì chuyển tiếp, nếu không (Air-Gap) trả NXDOMAIN tức thì
  if (state.upstream) {
    forwardToUpstream(msg, (upstreamReply) => {
      if (upstreamReply) {
        sendReply(upstreamReply);
      } else {
        sendReply(buildResponse(query, { rcode: 3, authoritative: false, answerIp: null }));
      }
    });
  } else {
    sendReply(buildResponse(query, { rcode: 3, authoritative: false, answerIp: null }));
  }
}

// ─── Khởi tạo cấu hình & Theo dõi thay đổi .env ───
loadConfig(true);
setInterval(() => loadConfig(false), 3000);

// ─── 1. UDP DNS Server (:53) ───
const udpServer = dgram.createSocket('udp4');

udpServer.on('message', (msg, rinfo) => {
  handleDnsPacket(msg, rinfo.address, (reply) => {
    udpServer.send(reply, rinfo.port, rinfo.address, () => {});
  });
});

udpServer.on('error', (err) => {
  if (err.code === 'EACCES' || err.code === 'EADDRINUSE') {
    console.error(`[DNS:UDP:${DNS_PORT}] ❌ Không thể mở cổng ${DNS_PORT} (${err.code}).`);
    console.error('   - Hãy chạy với quyền Administrator (Run as Administrator).');
    console.error('   - Hoặc kiểm tra xem đã có dịch vụ DNS khác đang chạy trên cổng 53 chưa.');
    process.exit(1);
  }
  console.error('[DNS:UDP] Lỗi:', err.message);
});

udpServer.bind(DNS_PORT, DNS_BIND, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════════════════╗');
  console.log('  ║  QK7 DataHub — MÁY CHỦ DNS NỘI BỘ TỰ CHỦ (PHƯƠNG ÁN 2)          ║');
  console.log('  ╠══════════════════════════════════════════════════════════════════╣');
  console.log(`  ║  Lắng nghe UDP/TCP : ${DNS_BIND}:${DNS_PORT}`);
  console.log(`  ║  Tên miền nội bộ   : ${state.serverDomain} -> ${state.serverIp}`);
  console.log(`  ║  Cổng cài chứng chỉ: http://${state.serverDomain}/ca`);
  console.log(`  ║  Trang truy cập    : https://${state.serverDomain}`);
  console.log('  ╠══════════════════════════════════════════════════════════════════╣');
  console.log(`  ║  Hướng dẫn Router  : Đặt Primary DNS = ${state.serverIp} trong DHCP`);
  console.log('  ║  Hiệu lực          : Mọi PC & iPad Air M4 tự nhận, không sửa hosts');
  console.log('  ╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
});

// ─── 2. TCP DNS Server (:53 — Dự phòng chuẩn RFC 1035) ───
const tcpServer = net.createServer((socket) => {
  let buf = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const len = buf.readUInt16BE(0);
      if (buf.length < 2 + len) break;
      const packet = buf.subarray(2, 2 + len);
      buf = buf.subarray(2 + len);
      handleDnsPacket(packet, socket.remoteAddress, (reply) => {
        const prefix = Buffer.alloc(2);
        prefix.writeUInt16BE(reply.length, 0);
        try {
          socket.write(Buffer.concat([prefix, reply]));
        } catch (_) {}
      });
    }
  });
  socket.on('error', () => {});
});

tcpServer.on('error', (err) => {
  console.warn(`[DNS:TCP:${DNS_PORT}] ⚠️ Không mở được TCP DNS (${err.code}), UDP vẫn hoạt động bình thường.`);
});

tcpServer.listen(DNS_PORT, DNS_BIND);
