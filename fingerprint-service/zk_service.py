"""
ZK9500 Service — QK7 Fingerprint Bridge
"""
import hashlib
import os
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

try:
    from pyzkfp import ZKFP2
    import pyzkfp.zkfp2 as _zk_internal

    _Array = getattr(_zk_internal, "Array", None)
    _Byte = getattr(_zk_internal, "Byte", None)
    _PYZKFP_OK = True
    _IMPORT_ERR = ""
except Exception as e:
    ZKFP2 = None
    _Array = _Byte = None
    _PYZKFP_OK = False
    _IMPORT_ERR = str(e)


def to_csharp_byte_array(data: Any) -> Any:
    if not _PYZKFP_OK or data is None or _Array is None or _Byte is None:
        return data
    if isinstance(data, (bytes, bytearray)):
        return _Array[_Byte](data)
    return data


class ZK9500Service:
    def __init__(self):
        self.zk: Optional[Any] = None
        self.sdk_loaded: bool = False
        self.device_connected: bool = False
        self.device_serial: str = "N/A"
        self.width: int = 288
        self.height: int = 375

        self._uid_to_sid: Dict[str, int] = {}
        self._sid_to_uid: Dict[int, str] = {}
        self._sid_to_template: Dict[int, bytes] = {}

        self._lock = threading.RLock()
        self._scan_lock = threading.Lock()

    def load_sdk(self) -> Tuple[bool, str]:
        if not _PYZKFP_OK:
            return False, f"pyzkfp không import được: {_IMPORT_ERR}"
        try:
            self.zk = ZKFP2()
            try:
                self.zk.Terminate()
            except Exception:
                pass
            self.zk.Init()
            self.sdk_loaded = True
            if getattr(self.zk, "width", None):
                self.width = int(self.zk.width)
            if getattr(self.zk, "height", None):
                self.height = int(self.zk.height)
            return True, "SDK đã load"
        except Exception as e:
            self.sdk_loaded = False
            return False, f"Init SDK lỗi: {e}"

    def open_device(self) -> Tuple[bool, str]:
        if not self.sdk_loaded:
            return False, "SDK chưa load"
        try:
            n = self.zk.GetDeviceCount()
            if n <= 0:
                return False, "Không tìm thấy đầu đọc ZK9500"
            self.zk.OpenDevice(0)
            raw_sn = getattr(self.zk, "dev_serial_number", "ZK9500")
            if isinstance(raw_sn, str):
                self.device_serial = raw_sn.replace("\x00", "").strip() or "ZK9500"
            else:
                self.device_serial = "ZK9500"
            self.device_connected = True
            return True, f"Đã mở {self.device_serial} ({self.width}x{self.height})"
        except Exception as e:
            self.device_connected = False
            return False, f"OpenDevice lỗi: {e}"

    def close(self):
        with self._lock:
            if self.device_connected and self.zk:
                try:
                    self.zk.CloseDevice()
                except Exception:
                    pass
            if self.sdk_loaded and self.zk:
                try:
                    self.zk.Terminate()
                except Exception:
                    pass
            self.device_connected = False
            self.sdk_loaded = False
            self.zk = None

    @staticmethod
    def _hash_user_id(user_id: str) -> int:
        h = hashlib.sha256(user_id.encode("utf-8")).hexdigest()
        sid = int(h[:7], 16)
        return sid if sid > 0 else 1

    def _assign(self, user_id: str) -> int:
        if user_id in self._uid_to_sid:
            return self._uid_to_sid[user_id]
        sid = self._hash_user_id(user_id)
        if sid in self._sid_to_uid and self._sid_to_uid[sid] != user_id:
            raise RuntimeError(f"Hash collision: {user_id} vs {self._sid_to_uid[sid]}")
        self._uid_to_sid[user_id] = sid
        self._sid_to_uid[sid] = user_id
        return sid

    def sync_templates(self, items: List[Dict[str, Any]]) -> int:
        if not self.sdk_loaded or not self.zk:
            return 0
        import base64
        count = 0
        with self._lock:
            try:
                self.zk.DBClear()
            except Exception:
                pass
            self._sid_to_template.clear()
            for it in items:
                uid = it.get("user_id")
                b64 = it.get("template_b64")
                if not uid or not b64:
                    continue
                try:
                    tpl = base64.b64decode(b64)
                    sid = self._assign(uid)
                    self.zk.DBAdd(sid, to_csharp_byte_array(tpl))
                    self._sid_to_template[sid] = tpl
                    count += 1
                except Exception as e:
                    print(f"[sync] skip {uid}: {e}")
        return count

    def add_template(self, user_id: str, template_bytes: bytes) -> int:
        if not self.sdk_loaded or not self.zk:
            raise RuntimeError("SDK chưa load")
        sid = self._assign(user_id)
        with self._lock:
            self.zk.DBAdd(sid, to_csharp_byte_array(template_bytes))
            self._sid_to_template[sid] = template_bytes
        return sid

    def remove_template(self, user_id: str) -> bool:
        if not self.sdk_loaded or not self.zk:
            return False
        sid = self._uid_to_sid.get(user_id)
        if sid is None:
            return False
        with self._lock:
            try:
                self.zk.DBDel(sid)
            except Exception:
                pass
            self._uid_to_sid.pop(user_id, None)
            self._sid_to_uid.pop(sid, None)
            self._sid_to_template.pop(sid, None)
        return True

    def _capture_once(self) -> Optional[bytes]:
        if not self.device_connected or not self.zk:
            return None
        try:
            res = self.zk.AcquireFingerprint()
            if res is not None:
                raw_template, _img = res
                return bytes(raw_template)
        except Exception:
            pass
        return None

    def wait_for_finger(self, timeout: float = 30.0) -> Optional[bytes]:
        if not self.device_connected:
            raise RuntimeError("Thiết bị chưa mở")
        if not self._scan_lock.acquire(timeout=timeout):
            return None
        try:
            start = time.time()
            while time.time() - start < timeout:
                t = self._capture_once()
                if t is not None:
                    time.sleep(0.05)
                    return t
                time.sleep(0.06)
            return None
        finally:
            self._scan_lock.release()

    def identify_against_ram(self, template_bytes: bytes) -> Tuple[Optional[str], int]:
        if not self.sdk_loaded or not self.zk:
            return None, 0
        with self._lock:
            try:
                fid, score = self.zk.DBIdentify(to_csharp_byte_array(template_bytes))
                if fid and fid > 0:
                    uid = self._sid_to_uid.get(fid)
                    return uid, int(score)
            except Exception as e:
                print(f"[identify] {e}")
        return None, 0

    def compare_templates(self, t1_bytes: bytes, t2_bytes: bytes) -> Tuple[bool, int]:
        if not self.sdk_loaded or not self.zk:
            raise RuntimeError("SDK chưa load")

        TEMP_ID = 999_999_999

        with self._lock:
            cached = list(self._sid_to_template.items())

            try:
                self.zk.DBClear()
                self.zk.DBAdd(TEMP_ID, to_csharp_byte_array(t1_bytes))

                try:
                    fid, score = self.zk.DBIdentify(to_csharp_byte_array(t2_bytes))
                finally:
                    try:
                        self.zk.DBDel(TEMP_ID)
                    except Exception:
                        pass

                threshold = int(os.getenv("MATCH_SCORE_THRESHOLD", "45"))
                matched = (fid == TEMP_ID)
                final_score = int(score) if matched else 0
                return (matched and final_score >= threshold, final_score)
            finally:
                if cached:
                    try:
                        self.zk.DBClear()
                        for sid, tpl in cached:
                            self.zk.DBAdd(sid, to_csharp_byte_array(tpl))
                    except Exception as e:
                        print(f"[compare] restore cache fail: {e}")