import ssl
import json
import urllib.request
import urllib.error
import pytest

BASE_URL = 'https://localhost:8000'

@pytest.fixture
def ssl_ctx():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

def test_guest_can_list_level1_and_level2_documents(ssl_ctx):
    req = urllib.request.Request(f'{BASE_URL}/api/documents')
    with urllib.request.urlopen(req, context=ssl_ctx) as res:
        assert res.status == 200
        data = json.loads(res.read().decode('utf-8'))
        assert 'items' in data
        items = data['items']
        assert len(items) > 0
        # Assert GUEST only sees docs with security_level_id <= 2
        for item in items:
            assert item.get('security_level_id', 1) <= 2

def test_guest_can_view_and_download_level1_or_2_doc(ssl_ctx):
    # Get a level 1 or 2 doc
    req = urllib.request.Request(f'{BASE_URL}/api/documents')
    with urllib.request.urlopen(req, context=ssl_ctx) as res:
        data = json.loads(res.read().decode('utf-8'))
        items = data['items']
        assert len(items) > 0
        sample_doc = items[0]
        file_id = sample_doc['file_id']

    # View doc
    req_view = urllib.request.Request(f'{BASE_URL}/api/files/{file_id}/view')
    with urllib.request.urlopen(req_view, context=ssl_ctx) as res_view:
        assert res_view.status == 200
        assert 'pdf' in res_view.headers.get('Content-Type', '').lower()
        pdf_bytes = res_view.read()
        assert len(pdf_bytes) > 100

    # Download doc
    req_download = urllib.request.Request(f'{BASE_URL}/api/files/{file_id}/view?download=1')
    with urllib.request.urlopen(req_download, context=ssl_ctx) as res_dl:
        assert res_dl.status == 200
        assert 'attachment' in res_dl.headers.get('Content-Disposition', '')
        dl_bytes = res_dl.read()
        assert len(dl_bytes) > 100

def test_guest_is_forbidden_from_viewing_level3_secret_doc(ssl_ctx):
    # Login as commander USR-002 (Cấp 5) with password 123456789 to discover a secret doc file_id
    login_data = json.dumps({'username': 'USR-002', 'password': '123456789'}).encode('utf-8')
    req_login = urllib.request.Request(
        f'{BASE_URL}/api/auth/login',
        data=login_data,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req_login, context=ssl_ctx) as res_login:
        token = json.loads(res_login.read().decode('utf-8'))['token']

    req_admin_docs = urllib.request.Request(
        f'{BASE_URL}/api/documents',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req_admin_docs, context=ssl_ctx) as res_docs:
        all_docs = json.loads(res_docs.read().decode('utf-8'))['items']
        secret_docs = [d for d in all_docs if d.get('security_level_id', 1) >= 3]
        assert len(secret_docs) > 0
        secret_file_id = secret_docs[0]['file_id']

    # Now verify GUEST (unauthenticated) gets 403 Forbidden with require_login
    req_guest_secret = urllib.request.Request(f'{BASE_URL}/api/files/{secret_file_id}/view')
    with pytest.raises(urllib.error.HTTPError) as exc_info:
        urllib.request.urlopen(req_guest_secret, context=ssl_ctx)
    
    assert exc_info.value.code == 403
    err_body = json.loads(exc_info.value.read().decode('utf-8'))
    assert err_body.get('require_login') is True
    assert 'đăng nhập tài khoản quân nhân' in err_body.get('error', '').lower()
