// backend/src/lecture-package-worker.js
// Kiểm tra gói bài giảng trong luồng riêng: gói lớn mất vài giây, không được làm treo máy chủ.
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (!isMainThread) {
  const AdmZip = require('adm-zip');
  const { validatePackage } = require('./lecture-package-validator');
  let out;
  try {
    const { ok, format, issues } = validatePackage(new AdmZip(workerData.zipPath));
    out = { ok, format, issues };
  } catch (e) {
    // Không đọc/kiểm tra được thì coi như không đạt
    out = { ok: false, format: null, issues: [{ file: '(gói)', reason: `Không kiểm tra được tệp ZIP: ${e.message}` }] };
  }
  parentPort.postMessage(out);
}

/** @returns {Promise<{ok:boolean, format:string|null, issues:{file:string,reason:string}[]}>} */
function checkPackageFile(zipPath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { zipPath },
      resourceLimits: { maxOldGenerationSizeMb: 1024 },
    });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => reject(new Error(`Tiến trình kiểm tra gói dừng bất thường (mã ${code})`)));
  });
}

module.exports = { checkPackageFile };
