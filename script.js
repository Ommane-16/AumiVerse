// AumiVerse File Manager - Re-architected for Google Drive API
class AumiVerseGoogleDrive {
    constructor() {
        // -----------------------------------------------------------------------------
        // PASTE YOUR GOOGLE CLOUD CREDENTIALS HERE
        // -----------------------------------------------------------------------------
        this.API_KEY = 'AIzaSyCAAOAiGWxH_nZf7UcuMEO92u2G91j_-no'; // <-- ⚠️ PASTE YOUR API KEY HERE
        this.CLIENT_ID = '507253073583-n0k94779a2o7hphade0b6or4btq065pc.apps.googleusercontent.com'; // ✅ YOUR CLIENT ID IS ADDED
        // -----------------------------------------------------------------------------

        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
        this.tokenClient = null;

        // --- UPDATED TO USE YOUR STATIC PASSWORD LIST ---
        this.predefinedFolders = [
            { name: 'F1', password: '8yU1o' }, { name: 'F2', password: '3xY5q' }, { name: 'F3', password: 'pL8m2' },
            { name: 'F4', password: '9kF1r' }, { name: 'F5', password: 'd4N6s' }, { name: 'F6', password: 'T5vG7' },
            { name: 'F7', password: '2wE4h' }, { name: 'F8', password: 'j3R9t' }, { name: 'F9', password: '6bM1k' },
            { name: 'F10', password: 'Q8zP4' }, { name: 'F11', password: '1gH5j' }, { name: 'F12', password: 's7K2l' },
            { name: 'F13', password: '4nD9x' }, { name: 'F14', password: 'L3cV8' }, { name: 'F15', password: 'm5W6f' },
            { name: 'F16', password: '7aB9c' }, { name: 'F17', password: 'e2X7i' }, { name: 'F18', password: 'B9aR3' },
            { name: 'F19', password: '5tS4u' }, { name: 'F20', password: 'k6J2h' }, { name: 'F21', password: 'Z4qG7' },
            { name: 'F22', password: 'f3Y8p' }, { name: 'F23', password: '7rT1v' }, { name: 'F24', password: 'H5nD9' },
            { name: 'F25', password: 'w2K6m' }, { name: 'F26', password: '9vL4b' }, { name: 'F27', password: 'C8sF3' },
            { name: 'F28', password: 'i1A5z' }, { name: 'F29', password: '4jM7x' }, { name: 'F30', password: 'P6oQ2' },
            { name: 'F31', password: 'u3V9c' }, { name: 'F32', password: 'X5gH8' }, { name: 'F33', password: '2bN7y' },
            { name: 'F34', password: 'R4kE1' }, { name: 'F35', password: 'l6W3t' }, { name: 'F36', password: 'S9dF5' },
            { name: 'F37', password: 'o7P2q' }, { name: 'F38', password: 'G1hJ4' }, { name: 'F39', password: '3zU6r' },
            { name: 'F40', password: 'D8mK2' }, { name: 'F41', password: 'a5B9s' }, { name: 'F42', password: 'J4vL7' },
            { name: 'F43', password: 'q6T3p' }, { name: 'F44', password: 'F2xY8' }, { name: 'F45', password: 'y7C1n' },
            { name: 'F46', password: 'K5wE9' }, { name: 'F47', password: 't3Z6d' }, { name: 'F48', password: 'M8rS4' },
            { name: 'F49', password: 'h1Q5f' }, { name: 'F50', password: 'V9bN2' }
        ].map(folder => ({...folder, driveId: null, occupied: false }));

        this.aumiverseRootFolderId = null;
        this.currentFolder = null;
        this.folderToUnlock = null;
    }

    // The generatePassword() function has been removed as it's no longer needed

    gapiLoaded() {
        gapi.load('client', async() => {
            await gapi.client.init({
                apiKey: this.API_KEY,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            this.updateAuthStatus();
        });
    }

    gisLoaded() {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: () => {
                this.updateAuthStatus();
            },
        });
        this.updateAuthStatus();
    }

    updateAuthStatus() {
        const token = gapi.client.getToken();
        const isSignedIn = token !== null;
        document.getElementById('authorize_button').style.display = isSignedIn ? 'none' : 'flex';
        document.getElementById('signout_button').style.display = isSignedIn ? 'flex' : 'none';
        document.getElementById('main-content').style.display = isSignedIn ? 'flex' : 'none';
        document.getElementById('pre-auth-view').style.display = isSignedIn ? 'none' : 'flex';

        if (isSignedIn) {
            document.getElementById('auth-status').innerText = `Signed in.`;
            this.setupApplication();
        } else {
            document.getElementById('auth-status').innerText = 'Not signed in.';
        }
    }

    handleAuthClick() {
        if (gapi.client.getToken() === null) {
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            this.tokenClient.requestAccessToken({ prompt: '' });
        }
    }

    handleSignoutClick() {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token, () => {
                gapi.client.setToken('');
                this.updateAuthStatus();
            });
        }
    }

    async setupApplication() {
        this.setupEventListeners();
        document.getElementById('loading-spinner').style.display = 'block';
        await this.findOrCreateAumiVerseFolders();
        await this.checkAllFoldersStatus();
        this.renderFolders();
        document.getElementById('loading-spinner').style.display = 'none';
    }

    async findOrCreateAumiVerseFolders() {
        try {
            let response = await gapi.client.drive.files.list({
                q: "mimeType='application/vnd.google-apps.folder' and name='AumiVerse' and trashed=false",
                fields: 'files(id, name)',
            });

            if (response.result.files.length > 0) {
                this.aumiverseRootFolderId = response.result.files[0].id;
            } else {
                response = await gapi.client.drive.files.create({ resource: { name: 'AumiVerse', mimeType: 'application/vnd.google-apps.folder' }, fields: 'id' });
                this.aumiverseRootFolderId = response.result.id;
            }

            response = await gapi.client.drive.files.list({
                q: `'${this.aumiverseRootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id, name)',
                pageSize: 50
            });
            const existingFolders = response.result.files;

            const batch = gapi.client.newBatch();
            for (const folder of this.predefinedFolders) {
                const found = existingFolders.find(f => f.name === folder.name);
                if (found) {
                    folder.driveId = found.id;
                } else {
                    const fileMetadata = { name: folder.name, mimeType: 'application/vnd.google-apps.folder', parents: [this.aumiverseRootFolderId] };
                    batch.add(gapi.client.drive.files.create({ resource: fileMetadata, fields: 'id, name' }));
                }
            }
            if (batch.Zb.length > 0) {
                const batchResponse = await batch;
                Object.values(batchResponse.result).forEach(res => {
                    const folder = this.predefinedFolders.find(f => f.name === res.result.name);
                    if (folder) folder.driveId = res.result.id;
                });
            }
        } catch (error) {
            console.error("Error setting up Drive folders:", error);
            alert("Could not set up required folders in your Google Drive.");
        }
    }

    async checkAllFoldersStatus() {
        const promises = this.predefinedFolders.map(async(folder) => {
            if (!folder.driveId) return;
            const response = await gapi.client.drive.files.list({
                q: `'${folder.driveId}' in parents and trashed=false`,
                pageSize: 1,
                fields: 'files(id)',
            });
            folder.occupied = response.result.files.length > 0;
        });
        await Promise.all(promises);
    }

    renderFolders() {
        const container = document.getElementById('folders-container');
        const currentDate = new Date().toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
        container.innerHTML = this.predefinedFolders.map(folder => {
            const storageText = folder.occupied ? 'Used' : '0.0MB';
            const fileCountText = folder.occupied ? '> 0' : '0';
            return `
                <div class="folder-card bg-gradient-to-br from-purple-800/50 to-purple-900/40 border border-purple-500/30 rounded-xl p-5 backdrop-blur-lg flex flex-col justify-between space-y-4 transition-all duration-300">
                    <div class="flex justify-between items-start">
                        <div class="flex items-center gap-3">
                            <i class="fas fa-folder text-2xl text-purple-300"></i>
                            <span class="text-lg font-bold text-white">${folder.name}</span>
                        </div>
                        <span class="bg-slate-700/50 text-xs text-gray-300 px-2 py-1 rounded-full">${currentDate}</span>
                    </div>
                    <div class="space-y-2 text-sm">
                        <p class="text-gray-400"><i class="fas fa-database mr-2 text-yellow-400"></i>Storage: ${storageText}</p>
                        <p class="text-gray-400"><i class="fas fa-file mr-2 text-blue-400"></i>Files: ${fileCountText}</p>
                    </div>
                    <button class="w-full py-3 bg-slate-700/60 hover:bg-slate-600/80 border border-slate-500/50 text-white font-semibold rounded-lg transition-all" onclick="aumiverse.openUnlockModal('${folder.name}')">
                        <i class="fas fa-lock mr-2"></i> Unlock Slot
                    </button>
                </div>
            `;
        }).join('');
    }

    async renderFiles() {
        const filesGrid = document.getElementById('folder-files');
        const emptyState = document.getElementById('empty-state');
        if (!this.currentFolder) return;

        try {
            const response = await gapi.client.drive.files.list({
                q: `'${this.currentFolder.driveId}' in parents and trashed=false`,
                fields: 'files(id, name, size, webContentLink, iconLink)',
            });
            const files = response.result.files;

            if (files.length === 0) {
                emptyState.style.display = 'block';
                filesGrid.innerHTML = '';
            } else {
                emptyState.style.display = 'none';
                filesGrid.innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${files.map(file => this.createFileCardHTML(file)).join('')}
                    </div>
                `;
            }
        } catch (error) {
            console.error("Error rendering files:", error);
            alert("Could not load files from Google Drive.");
        }
    }

    createFileCardHTML(file) {
        const fileSize = file.size ? (parseInt(file.size) / 1024 / 1024).toFixed(2) : 'N/A';
        return `
            <div class="file-card bg-slate-700/50 p-3 rounded-lg flex items-center gap-3">
                <img src="${file.iconLink}" class="w-5 h-5">
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-white font-medium truncate">${file.name}</p>
                    <p class="text-xs text-gray-400">${fileSize} MB</p>
                </div>
                <button class="w-7 h-7 text-green-400 hover:bg-white/10 rounded" title="Download" onclick="window.open('${file.webContentLink}', '_blank')"><i class="fas fa-download"></i></button>
                <button class="w-7 h-7 text-red-400 hover:bg-white/10 rounded" title="Delete" onclick="aumiverse.deleteFile('${file.id}', this)"><i class="fas fa-trash"></i></button>
            </div>`;
    }

    async uploadFile() {
        const fileInput = document.getElementById('file-upload');
        const file = fileInput.files[0];
        if (!file || !this.currentFolder) return;

        const metadata = { name: file.name, parents: [this.currentFolder.driveId] };
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', file);

        try {
            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({ 'Authorization': `Bearer ${gapi.client.getToken().access_token}` }),
                body: formData,
            });
            if (!response.ok) throw new Error('Upload failed');
            this.currentFolder.occupied = true;
            await this.renderFiles();
            this.renderFolders();
        } catch (error) {
            console.error("Upload failed:", error);
            alert(`Upload failed: ${error.message}`);
        } finally {
            fileInput.value = '';
        }
    }

    async deleteFile(fileId, element) {
        if (!confirm(`Are you sure you want to permanently delete this file from your Google Drive?`)) return;

        element.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
        try {
            await gapi.client.drive.files.delete({ fileId: fileId });
            element.closest('.file-card').remove();
            const response = await gapi.client.drive.files.list({
                q: `'${this.currentFolder.driveId}' in parents and trashed=false`,
                pageSize: 1,
            });
            if (response.result.files.length === 0) {
                this.currentFolder.occupied = false;
                this.renderFolders();
            }
        } catch (error) {
            console.error("Deletion failed:", error);
            alert("Could not delete the file.");
            element.innerHTML = `<i class="fas fa-trash"></i>`;
        }
    }

    openUnlockModal(folderName) {
        const folder = this.predefinedFolders.find(f => f.name === folderName);
        if (!folder) return;
        document.getElementById('unlock-title').textContent = `🔐 Unlock Slot - ${folderName}`;
        this.showModal('unlock-modal');
        this.folderToUnlock = folder;
    }

    async unlockFolder() {
        if (!this.folderToUnlock) return;
        const password = document.getElementById('unlock-password').value;
        if (password === this.folderToUnlock.password) {
            this.currentFolder = this.folderToUnlock;
            this.hideModal('unlock-modal');
            document.getElementById('unlock-password').value = '';
            document.getElementById('folder-title').textContent = `📁 ${this.currentFolder.name}`;
            this.showModal('folder-modal');
            await this.renderFiles();
        } else {
            alert('Incorrect password!');
        }
    }

    showModal(modalId) { document.getElementById(modalId).classList.replace('hidden', 'flex'); }
    hideModal(modalId) { document.getElementById(modalId).classList.replace('flex', 'hidden'); }

    setupEventListeners() {
        document.getElementById('authorize_button').onclick = () => this.handleAuthClick();
        document.getElementById('signout_button').onclick = () => this.handleSignoutClick();
        document.getElementById('unlock-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.unlockFolder();
        });
        document.getElementById('upload-btn').addEventListener('click', () => document.getElementById('file-upload').click());
        document.getElementById('file-upload').addEventListener('change', () => this.uploadFile());
        document.getElementById('close-folder').addEventListener('click', () => this.hideModal('folder-modal'));
        document.getElementById('cancel-unlock').addEventListener('click', () => this.hideModal('unlock-modal'));
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const folders = document.querySelectorAll('.folder-card');
            folders.forEach(folder => {
                const folderName = folder.querySelector('span.font-bold').textContent.toLowerCase();
                if (folderName.includes(searchTerm)) {
                    folder.style.display = 'flex';
                } else {
                    folder.style.display = 'none';
                }
            });
        });
    }
}

// Initialize the application
const aumiverse = new AumiVerseGoogleDrive();
window.aumiverse = aumiverse;

// Global functions to link HTML onload events to our class
function gapiLoaded() { aumiverse.gapiLoaded(); }

function gisLoaded() { aumiverse.gisLoaded(); }