document.addEventListener('DOMContentLoaded', () => {
    const serverListContainer = document.getElementById('serverList');
    const btnRefresh = document.getElementById('btnRefresh');
    const searchInput = document.getElementById('searchInput');
    const btnClearSearch = document.getElementById('btnClearSearch');

    // Lưu data gốc của dashboard để restore khi clear search
    let allServersData = [];
    // Timer cho debounce search
    let searchTimer;

    // ============ 1. HELPERS ============

    // Mã hóa HTML chống XSS
    function escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g,
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // Icon theo extension file
    const FILE_ICONS = {
        pdf: '📕', doc: '📘', docx: '📘',
        xls: '📗', xlsx: '📗',
        ppt: '📙', pptx: '📙',
        txt: '📄', csv: '📊',
        json: '⚙️', xml: '⚙️',
        png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️', bmp: '🖼️', svg: '🖼️',
        mp4: '🎬', webm: '🎬',
        mp3: '🎵', wav: '🎵',
        zip: '🗜️', rar: '🗜️', '7z': '🗜️', tar: '🗜️', gz: '🗜️'
    };

    function getFileIcon(filename) {
        const ext = (filename.split('.').pop() || '').toLowerCase();
        return FILE_ICONS[ext] || '📄';
    }

    // Format size: B / KB / MB / GB
    function formatSize(bytes) {
        if (!bytes || bytes < 0) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
        return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    }

    // Highlight keyword trong text (sau khi đã escape HTML)
    function highlight(text, keyword) {
        const safe = escapeHTML(text);
        if (!keyword) return safe;
        const safeKw = escapeHTML(keyword);
        const regexSafe = safeKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${regexSafe})`, 'gi');
        return safe.replace(regex, '<mark>$1</mark>');
    }

    // ============ 2. RENDER TREE (DASHBOARD) ============

    function renderFileTree(items, serverIp, serverPort) {
        if (!items || !Array.isArray(items) || items.length === 0) {
            return '<li class="empty-item"><i>Thư mục trống</i></li>';
        }

        return items.map(item => {
            // Backward compat: item dạng string
            if (typeof item === 'string') {
                const fileUrl = `/api/stream-file?ip=${serverIp}&port=${serverPort}&fileName=${encodeURIComponent(item)}`;
                return `
                    <li class="file-item">
                        📄 <a href="${fileUrl}" target="_blank" rel="noopener noreferrer">
                            ${escapeHTML(item)}
                        </a>
                    </li>
                `;
            }

            const itemType = String(item.type || '').toLowerCase();

            // === FOLDER ===
            if (itemType === 'folder' || itemType === 'directory') {
                const childrenList = Array.isArray(item.children) ? item.children : [];
                return `
                    <li class="folder-item">
                        <details>
                            <summary>📁 <b>${escapeHTML(item.name || 'Thư mục không tên')}</b></summary>
                            <ul class="sub-folder">
                                ${renderFileTree(childrenList, serverIp, serverPort)}
                            </ul>
                        </details>
                    </li>
                `;
            }

            // === FILE ===
            const filePath = item.path || item.name;
            const fileUrl = `/api/stream-file?ip=${serverIp}&port=${serverPort}&fileName=${encodeURIComponent(filePath)}`;
            const icon = getFileIcon(item.name || filePath);
            return `
                <li class="file-item">
                    ${icon} <a href="${fileUrl}" target="_blank" rel="noopener noreferrer">
                        ${escapeHTML(item.name || filePath)}
                    </a>
                </li>
            `;
        }).join('');
    }

    // ============ 3. RENDER SERVERS (DASHBOARD) ============

    function renderServers(servers) {
        serverListContainer.innerHTML = '';

        if (!servers || servers.length === 0) {
            serverListContainer.innerHTML = '<p>Không có máy chủ nào trong danh sách.</p>';
            return;
        }

        servers.forEach(server => {
            const card = document.createElement('div');
            card.className = 'server-card';

            const statusClass = server.connected ? 'online' : 'offline';
            const statusText = server.connected ? 'Đã kết nối' : 'Mất kết nối (Offline)';

            let fileListHTML = '';
            if (server.connected && server.files && server.files.length > 0) {
                fileListHTML = renderFileTree(server.files, server.ip, server.port);
            } else if (server.connected) {
                fileListHTML = '<li class="empty-item"><i>Không có file/folder nào được chia sẻ</i></li>';
            } else {
                fileListHTML = '<li style="color:red;"><i>Không thể đọc dữ liệu từ máy chủ</i></li>';
            }

            card.innerHTML = `
                <h3>${escapeHTML(server.name)}</h3>
                <p><b>IP:</b> ${escapeHTML(server.ip)}:${server.port}</p>
                <p>
                    <span class="status-dot ${statusClass}"></span>
                    <b>Trạng thái:</b> ${statusText}
                </p>
                <hr>
                <h4>Danh sách File & Thư mục:</h4>
                <ul class="file-tree">${fileListHTML}</ul>
            `;

            serverListContainer.appendChild(card);
        });
    }

    // ============ 4. LOAD DASHBOARD ============

    async function loadDashboard() {
        // Nếu đang có keyword search → không load dashboard
        if (searchInput && searchInput.value.trim().length >= 2) return;

        serverListContainer.innerHTML = '<p>Đang kiểm tra kết nối tới các máy chủ...</p>';

        try {
            const response = await fetch('/api/dashboard-data');
            const result = await response.json();

            if (result.success) {
                allServersData = result.data;   // ← LƯU data gốc
                renderServers(result.data);
            } else {
                serverListContainer.innerHTML = `<p style="color:red;">Lỗi API: ${escapeHTML(result.message || 'Không thể lấy dữ liệu')}</p>`;
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            serverListContainer.innerHTML = '<p style="color:red;">Lỗi kết nối tới Server Trung Gian!</p>';
        }
    }

    // ============ 5. SEARCH ============

    function handleSearchInput() {
        clearTimeout(searchTimer);
        const kw = searchInput.value.trim();

        // Keyword ngắn → về dashboard
        if (kw.length < 2) {
            if (allServersData.length > 0) {
                renderServers(allServersData);
            } else {
                loadDashboard();
            }
            return;
        }

        // Debounce 400ms
        searchTimer = setTimeout(() => performSearch(kw), 400);
    }

    async function performSearch(keyword) {
        serverListContainer.innerHTML = `<p>🔍 Đang tìm "<b>${escapeHTML(keyword)}</b>"...</p>`;

        try {
            const r = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`);
            const data = await r.json();

            // User đã đổi keyword trong lúc chờ → bỏ qua kết quả cũ
            if (searchInput.value.trim() !== keyword) return;

            if (data.success) {
                renderSearchResults(data.data, keyword);
            } else {
                serverListContainer.innerHTML = '<p style="color:red;">Lỗi tìm kiếm</p>';
            }
        } catch (err) {
            console.error('Search error:', err);
            serverListContainer.innerHTML = '<p style="color:red;">Lỗi tìm kiếm</p>';
        }
    }

    function renderSearchResults(servers, keyword) {
        serverListContainer.innerHTML = '';

        const totalResults = servers.reduce((sum, s) => sum + (s.files?.length || 0), 0);

        // Không có kết quả
        if (totalResults === 0) {
            serverListContainer.innerHTML = `
                <p><i>Không tìm thấy kết quả nào cho "<b>${escapeHTML(keyword)}</b>"</i></p>
            `;
            return;
        }

        // Header tổng
        const header = document.createElement('p');
        header.style.marginBottom = '16px';
        header.innerHTML = `<b>Tìm thấy ${totalResults} kết quả cho "${escapeHTML(keyword)}"</b>`;
        serverListContainer.appendChild(header);

        // Render từng server
        servers.forEach(server => {
            // Server offline → hiện card báo lỗi
            if (!server.connected) {
                const card = document.createElement('div');
                card.className = 'server-card';
                card.innerHTML = `
                    <h3>${escapeHTML(server.name)}</h3>
                    <p style="color:red;"><i>Mất kết nối — không thể tìm</i></p>
                `;
                serverListContainer.appendChild(card);
                return;
            }

            // Server online nhưng không có kết quả → bỏ qua
            if (!server.files || server.files.length === 0) return;

            const card = document.createElement('div');
            card.className = 'server-card';

            const listHTML = server.files.map(item => {
                const icon = item.type === 'folder' ? '📁' : getFileIcon(item.name);
                const pathInfo = `<small class="file-path">— ${escapeHTML(item.path)}</small>`;

                // Folder → chỉ hiện thông tin, không click
                if (item.type === 'folder') {
                    return `
                        <li class="file-item">
                            ${icon} <b>${highlight(item.name, keyword)}</b> ${pathInfo}
                        </li>
                    `;
                }

                // File → link stream
                const fileUrl = `/api/stream-file?ip=${server.ip}&port=${server.port}&fileName=${encodeURIComponent(item.path)}`;
                const size = item.size ? ` <span class="file-size">(${formatSize(item.size)})</span>` : '';

                return `
                    <li class="file-item">
                        ${icon} <a href="${fileUrl}" target="_blank" rel="noopener noreferrer">${highlight(item.name, keyword)}</a>${size} ${pathInfo}
                    </li>
                `;
            }).join('');

            card.innerHTML = `
                <h3>${escapeHTML(server.name)} (${server.files.length})</h3>
                <ul class="file-tree">${listHTML}</ul>
            `;
            serverListContainer.appendChild(card);
        });
    }

    // ============ 6. ĐĂNG KÝ SỰ KIỆN ============

    // Refresh button
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            // Nếu đang search → clear trước rồi refresh
            if (searchInput && searchInput.value.trim()) {
                searchInput.value = '';
            }
            allServersData = [];
            loadDashboard();
        });
    }

    // Search input (debounce)
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
    }

    // Clear search button
    if (btnClearSearch) {
        btnClearSearch.addEventListener('click', () => {
            searchInput.value = '';
            if (allServersData.length > 0) {
                renderServers(allServersData);
            } else {
                loadDashboard();
            }
            searchInput.focus();
        });
    }

    // ============ 7. KHỞI ĐỘNG ============
    loadDashboard();
});