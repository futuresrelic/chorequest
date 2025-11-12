// admin.js - Admin panel functionality

const API_URL = '../api/api.php';
let currentUser = null;
let currentSubmissionsStatus = 'pending';

// Utility functions
async function apiCall(action, data = {}) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...data })
        });
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        return { ok: false, error: 'Network error' };
    }
}

function showError(message) {
    alert(message);
}

function showSuccess(message) {
    alert(message);
}

function formatDate(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function formatRelativeTime(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Modal functions
function openModal(content) {
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

// Tab navigation
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) btn.classList.add('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Load data for the tab
    loadTabData(tabName);
}

async function loadTabData(tabName) {
    switch(tabName) {
        case 'dashboard':
            await loadDashboard();
            break;
        case 'family-board':
            await loadFamilyBoard();
            break;
        case 'point-economics':
            await loadPointEconomics();
            break;
        case 'kids':
            await loadKids();
            await loadPairingCodes();
            await loadDevices();
            break;
        case 'chores':
            await loadChores();
            break;
        case 'quests':
            await loadQuests();
            break;
        case 'rewards':
            await loadRewards();
            break;
        case 'submissions':
            await loadSubmissions('pending');
            break;
        case 'quest-tasks':  // ← ADD THIS
            await loadQuestTaskSubmissions('pending');
            break;
        case 'themes':
            await loadThemes();
            break;
        case 'redemptions':
            await loadRedemptions('pending');
            break;
        case 'setup-wizard':
            loadWizard();
            break;
    }
}

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';
    
    const result = await apiCall('admin_login', { email, password });
    
    if (result.ok) {
        // Login successful - reload page to show app
        window.location.reload();
    } else {
        alert('Login failed: ' + (result.error || 'Invalid credentials'));
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
    }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
    await apiCall('admin_logout');
    location.reload();
});

// Check if already logged in
async function checkAuth() {
    const result = await apiCall('admin_me');
    if (result.ok) {
        currentUser = result.data;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        document.getElementById('admin-email').textContent = currentUser.email;
        
        // Show version
        fetch('/api/version.php')
            .then(r => r.json())
            .then(data => {
                const versionEl = document.getElementById('app-version');
                if (versionEl) {
                    versionEl.textContent = `v${data.version}`;
                }
            })
            .catch(() => {});
        
        await loadDashboard();
    }
    // If not authenticated, login screen stays visible (default state)
}

// Dashboard
async function loadDashboard() {
    const result = await apiCall('stats_overview');
    if (result.ok) {
        const stats = result.data;
        document.getElementById('stat-submissions').textContent = stats.pending_submissions;
        document.getElementById('stat-redemptions').textContent = stats.pending_redemptions;
        document.getElementById('stat-quests').textContent = stats.pending_quest_tasks;
        document.getElementById('stat-today').textContent = stats.today_completions;
        
        // Streak leaders
        const streakHtml = stats.streak_leaders.length > 0 
            ? stats.streak_leaders.map(s => `
                <div class="list-item">
                    <div class="list-item-info">
                        <h4>${s.kid_name} - ${s.chore_title}</h4>
                        <p>${s.streak_count} day streak 🔥</p>
                    </div>
                </div>
            `).join('')
            : '<p>No streaks yet</p>';
        document.getElementById('streak-leaders').innerHTML = streakHtml;
        
        // Points leaders
        const pointsHtml = stats.points_leaders.length > 0
            ? stats.points_leaders.map(p => `
                <div class="list-item">
                    <div class="list-item-info">
                        <h4>${p.kid_name}</h4>
                        <p>${p.total_points} points</p>
                    </div>
                </div>
            `).join('')
            : '<p>No points yet</p>';
        document.getElementById('points-leaders').innerHTML = pointsHtml;
    }
}

// Kids Management
async function loadKids() {
    const result = await apiCall('list_kids');
    if (result.ok) {
        const html = result.data.map(kid => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>
                        ${kid.kid_name} 
                        ${kid.is_test_account ? '<span style="background: #FEF3C7; color: #92400E; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">TEST</span>' : ''}
                    </h4>
                    <p>${kid.total_points} points • ${kid.device_count} device(s) • ${kid.chore_count} chore(s)</p>
                    <p>Created: ${formatDate(kid.created_at)}</p>
                </div>
                <div class="list-item-actions">
                    <button class="secondary-btn small-btn" onclick="manageKid(${kid.id}, '${kid.kid_name}', ${kid.is_test_account})">Manage</button>
                    <button class="secondary-btn small-btn" onclick="generatePairingCode(${kid.id})">Get Code</button>
                    <button class="secondary-btn small-btn" onclick="viewKidChores(${kid.id}, '${kid.kid_name}')">Chores</button>
                    <button class="danger-btn small-btn" onclick="deleteKid(${kid.id})">Delete</button>
                </div>
            </div>
        `).join('');
        document.getElementById('kids-list').innerHTML = html || '<p>No kids added yet</p>';
    }
}

document.getElementById('add-kid-btn').addEventListener('click', () => {
    openModal(`
        <h3>Add Kid</h3>
        <input type="text" id="new-kid-name" placeholder="Kid's Name" required>
        <div class="modal-actions">
            <button class="secondary-btn" onclick="closeModal()">Cancel</button>
            <button class="primary-btn" onclick="createKid()">Add Kid</button>
        </div>
    `);
});

async function createKid() {
    const name = document.getElementById('new-kid-name').value.trim();
    if (!name) {
        showError('Name is required');
        return;
    }
    
    const result = await apiCall('create_kid', { name });
    if (result.ok) {
        closeModal();
        showSuccess('Kid added successfully');
        loadKids();
    } else {
        showError(result.error);
    }
}

async function deleteKid(kidId) {
    if (!confirm('Are you sure? This will delete all chores and progress for this kid.')) return;
    
    const result = await apiCall('delete_kid', { kid_id: kidId });
    if (result.ok) {
        showSuccess('Kid deleted');
        loadKids();
    } else {
        showError(result.error);
    }
}

function manageKid(kidId, kidName, isTestAccount) {
    openModal(`
        <h3>Manage: ${kidName}</h3>
        
        <div style="background: #F3F4F6; padding: 15px; border-radius: 12px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0;">Test Account Mode</h4>
            <p style="font-size: 13px; color: #6B7280; margin-bottom: 15px;">
                Test accounts are excluded from Family Board analytics and statistics.
            </p>
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="test-mode-toggle" ${isTestAccount ? 'checked' : ''} 
                    style="width: 20px; height: 20px;">
                <span style="font-weight: 600;">Mark as Test Account</span>
            </label>
        </div>
        
        <div style="background: #FEF3C7; padding: 15px; border-radius: 12px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #92400E;">⚠️ Reset Points</h4>
            <p style="font-size: 13px; color: #92400E; margin-bottom: 15px;">
                Choose what to reset for this kid:
            </p>
            <button class="secondary-btn" style="width: 100%; margin-bottom: 10px;" 
                onclick="resetKidPoints(${kidId}, '${kidName}', false)">
                Reset Points Only
            </button>
            <button class="danger-btn" style="width: 100%;" 
                onclick="resetKidPoints(${kidId}, '${kidName}', true)">
                Reset Everything (Points + History)
            </button>
        </div>
        
        <div class="modal-actions">
            <button class="secondary-btn" onclick="closeModal()">Cancel</button>
            <button class="primary-btn" onclick="saveKidSettings(${kidId})">Save Settings</button>
        </div>
    `);
}

async function saveKidSettings(kidId) {
    const isTest = document.getElementById('test-mode-toggle').checked;
    
    const result = await apiCall('toggle_kid_test_mode', { kid_id: kidId });
    
    if (result.ok) {
        closeModal();
        showSuccess('Settings saved');
        loadKids();
    } else {
        showError(result.error);
    }
}

async function resetKidPoints(kidId, kidName, clearHistory) {
    const message = clearHistory
        ? `Reset ALL data for ${kidName}?\n\nThis will delete:\n• All points\n• Submission history\n• Redemption history\n• Quest progress\n• Streaks\n• Game scores\n\nTHIS CANNOT BE UNDONE!`
        : `Reset points to 0 for ${kidName}?\n\nHistory will be preserved.`;
    
    if (!confirm(message)) return;
    
    const result = await apiCall('reset_kid_points', {
        kid_id: kidId,
        clear_history: clearHistory ? 1 : 0
    });
    
    if (result.ok) {
        closeModal();
        showSuccess(result.data.message);
        loadKids();
        loadDashboard();
    } else {
        showError(result.error);
    }
}

async function generatePairingCode(kidId) {
    const result = await apiCall('generate_pairing_code', { kid_id: kidId });
    if (result.ok) {
        openModal(`
            <h3>Pairing Code Generated</h3>
            <p>Share this code with the kid's device:</p>
            <h2 style="text-align: center; font-size: 48px; color: var(--primary); margin: 20px 0;">${result.data.code}</h2>
            <p style="text-align: center; color: var(--text-light);">Code expires when paired</p>
            <div class="modal-actions">
                <button class="primary-btn" onclick="closeModal()">Close</button>
            </div>
        `);
        loadPairingCodes();
    } else {
        showError(result.error);
    }
}

async function loadPairingCodes() {
    const result = await apiCall('list_pairing_codes');
    if (result.ok) {
        const html = result.data.map(code => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>Code: ${code.pairing_code}</h4>
                    <p>${code.kid_name} - Waiting to be paired</p>
                </div>
            </div>
        `).join('');
        document.getElementById('pairing-codes-list').innerHTML = html || '<p>No pending pairing codes</p>';
    }
}

async function loadDevices() {
    const result = await apiCall('list_devices');
    if (result.ok) {
        const html = result.data.map(device => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${device.kid_name} - ${device.device_label}</h4>
                    <p>Paired: ${formatDate(device.paired_at)} • Last seen: ${formatRelativeTime(device.last_seen_at)}</p>
                </div>
                <div class="list-item-actions">
                    <button class="danger-btn small-btn" onclick="revokeDevice(${device.id})">Revoke</button>
                </div>
            </div>
        `).join('');
        document.getElementById('devices-list').innerHTML = html || '<p>No paired devices</p>';
    }
}

async function revokeDevice(deviceId) {
    if (!confirm('Revoke this device? The kid will need to pair again.')) return;
    
    const result = await apiCall('revoke_device', { device_id: deviceId });
    if (result.ok) {
        showSuccess('Device revoked');
        loadDevices();
    } else {
        showError(result.error);
    }
}

async function clearUnpairedCodes() {
    const result = await apiCall('list_pairing_codes');
    if (!result.ok || result.data.length === 0) {
        alert('No unpaired codes to clear');
        return;
    }
    
    if (!confirm(`Clear ${result.data.length} unpaired pairing code(s)?`)) return;  // ← FIXED: Added opening (
    
    const clearResult = await apiCall('clear_unpaired_codes');
    if (clearResult.ok) {
        showSuccess(clearResult.data.message);
        loadPairingCodes();
    } else {
        showError(clearResult.error);
    }
}

async function clearStaleDevices() {
    console.log('🧹 clearStaleDevices() called');
    
    // Ask how many days
    const days = prompt('Clear devices not seen in how many days?\n\nRecommended: 30 days\n\nEnter number:', '30');
    console.log('User entered days:', days);
    
    if (!days || isNaN(days)) {
        console.log('Invalid days input, aborting');
        return;
    }
    
    const daysNum = parseInt(days);
    if (daysNum < 1) {
        alert('Please enter a valid number of days');
        return;
    }
    
    console.log('Calling API with days:', daysNum);
    
    // Show confirmation
    const message = daysNum === 1 
        ? `Clear devices not seen in the last 24 hours?`
        : `Clear devices not seen in the last ${daysNum} days?`;
    
    if (!confirm(message + '\n\nThis will remove old/unused paired devices.\n\nActive devices will NOT be affected.')) {
        console.log('User cancelled');
        return;
    }
    
    console.log('User confirmed, calling clear_stale_devices API...');
    const result = await apiCall('clear_stale_devices', { days: daysNum });
    console.log('API result:', result);
    
    if (result.ok) {
        if (result.data.count === 0) {
            alert('No stale devices found! All devices are active.');
        } else {
            const deviceList = result.data.devices.map(d => 
                `  • ${d.kid_name} - ${d.device_label} (last seen: ${d.last_seen_at || 'never'})`
            ).join('\n');
            
            alert(`${result.data.message}\n\nRemoved:\n${deviceList}`);  // ← FIXED: Added opening (
        }
        loadDevices();
        loadPairingCodes();
    } else {
        console.error('API error:', result.error);
        alert('Error: ' + (result.error || 'Unknown error'));
    }
}

// Attach button listeners (only once, no duplicates)
document.getElementById('clear-unpaired-btn')?.addEventListener('click', clearUnpairedCodes);
document.getElementById('clear-stale-btn')?.addEventListener('click', clearStaleDevices);

// Chores Management
async function loadChores() {
    const result = await apiCall('list_chores');
    if (result.ok) {
        const html = result.data.map(chore => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${chore.title}</h4>
                    <p>${chore.description || 'No description'}</p>
                    <p>
                        <span class="badge badge-info">${chore.frequency}</span>
                        <span class="badge badge-success">${chore.default_points} pts</span>
                        ${chore.requires_approval ? '<span class="badge badge-warning">Requires Approval</span>' : '<span class="badge badge-success">Auto-approve</span>'}
                        • Assigned to ${chore.assigned_count} kid(s)
                    </p>
                </div>
                <div class="list-item-actions">
                    <button class="secondary-btn small-btn" onclick="assignChore(${chore.id}, '${chore.title}')">Assign</button>
                    <button class="secondary-btn small-btn" onclick="editChore(${chore.id})">Edit</button>
                    <button class="danger-btn small-btn" onclick="deleteChore(${chore.id})">Delete</button>
                </div>
            </div>
        `).join('');
        document.getElementById('chores-list').innerHTML = html || '<p>No chores created yet</p>';
    }
}

document.getElementById('add-chore-btn').addEventListener('click', () => {
    openModal(`
        <h3>Add Chore</h3>
        <input type="text" id="chore-title" placeholder="Title" required>
        <textarea id="chore-description" placeholder="Description"></textarea>
        <select id="chore-frequency">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="once">One-time</option>
        </select>
        <input type="number" id="chore-points" placeholder="Points" value="10" min="1">
        <label>
            <input type="checkbox" id="chore-requires-approval" checked>
            Requires Approval
        </label>
        <div class="modal-actions">
            <button class="secondary-btn" onclick="closeModal()">Cancel</button>
            <button class="primary-btn" onclick="createChore()">Add Chore</button>
        </div>
    `);
});

async function createChore() {
    const title = document.getElementById('chore-title').value.trim();
    const description = document.getElementById('chore-description').value.trim();
    const frequency = document.getElementById('chore-frequency').value;
    const points = parseInt(document.getElementById('chore-points').value);
    const requiresApproval = document.getElementById('chore-requires-approval').checked ? 1 : 0;
    
    if (!title) {
        showError('Title is required');
        return;
    }
    
    const result = await apiCall('create_chore', {
        title,
        description,
        frequency,
        default_points: points,
        requires_approval: requiresApproval,
        is_recurring: frequency !== 'once' ? 1 : 0
    });
    
    if (result.ok) {
        closeModal();
        showSuccess('Chore created');
        loadChores();
    } else {
        showError(result.error);
    }
}

async function editChore(choreId) {
    const result = await apiCall('list_chores');
    if (!result.ok) return;
    
    const chore = result.data.find(c => c.id === choreId);
    if (!chore) return;
    
    openModal(`
        <h3>Edit Chore</h3>
        <input type="text" id="chore-title" placeholder="Title" value="${chore.title}" required>
        <textarea id="chore-description" placeholder="Description">${chore.description || ''}</textarea>
        <select id="chore-frequency">
            <option value="daily" ${chore.frequency === 'daily' ? 'selected' : ''}>Daily</option>
            <option value="weekly" ${chore.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
            <option value="once" ${chore.frequency === 'once' ? 'selected' : ''}>One-time</option>
        </select>
        <input type="number" id="chore-points" placeholder="Points" value="${chore.default_points}" min="1">
        <label>
            <input type="checkbox" id="chore-requires-approval" ${chore.requires_approval ? 'checked' : ''}>
            Requires Approval
        </label>
        <div class="modal-actions">
            <button class="secondary-btn" onclick="closeModal()">Cancel</button>
            <button class="primary-btn" onclick="updateChore(${choreId})">Save Changes</button>
        </div>
    `);
}

async function updateChore(choreId) {
    const title = document.getElementById('chore-title').value.trim();
    const description = document.getElementById('chore-description').value.trim();
    const frequency = document.getElementById('chore-frequency').value;
    const points = parseInt(document.getElementById('chore-points').value);
    const requiresApproval = document.getElementById('chore-requires-approval').checked ? 1 : 0;
    
    if (!title) {
        showError('Title is required');
        return;
    }
    
    const result = await apiCall('update_chore', {
        chore_id: choreId,
        title,
        description,
        frequency,
        default_points: points,
        requires_approval: requiresApproval,
        is_recurring: frequency !== 'once' ? 1 : 0
    });
    
    if (result.ok) {
        closeModal();
        showSuccess('Chore updated');
        loadChores();
    } else {
        showError(result.error);
    }
}

async function deleteChore(choreId) {
    if (!confirm('Delete this chore? It will be removed from all kids.')) return;
    
    const result = await apiCall('delete_chore', { chore_id: choreId });
    if (result.ok) {
        showSuccess('Chore deleted');
        loadChores();
    } else {
        showError(result.error);
    }
}

async function editChore(choreId) {
    // Get chore details first
    const result = await apiCall('list_chores');
    if (!result.ok) return;
    
    const chore = result.data.find(c => c.id === choreId);
    if (!chore) return;
    
    openModal(`
        <h3>Edit Chore</h3>
        <input type="text" id="chore-title" placeholder="Title" value="${chore.title}" required>
        <textarea id="chore-description" placeholder="Description">${chore.description || ''}</textarea>
        <select id="chore-frequency">
            <option value="daily" ${chore.frequency === 'daily' ? 'selected' : ''}>Daily</option>
            <option value="weekly" ${chore.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
            <option value="once" ${chore.frequency === 'once' ? 'selected' : ''}>One-time</option>
        </select>
        <input type="number" id="chore-points" placeholder="Points" value="${chore.default_points}" min="1">
        <label>
            <input type="checkbox" id="chore-requires-approval" ${chore.requires_approval ? 'checked' : ''}>
            Requires Approval
        </label>
        <div class="modal-actions">
            <button class="secondary-btn" onclick="closeModal()">Cancel</button>
            <button class="primary-btn" onclick="updateChore(${choreId})">Save Changes</button>
        </div>
    `);
}

async function updateChore(choreId) {
    const title = document.getElementById('chore-title').value.trim();
    const description = document.getElementById('chore-description').value.trim();
    const frequency = document.getElementById('chore-frequency').value;
    const points = parseInt(document.getElementById('chore-points').value);
    const requiresApproval = document.getElementById('chore-requires-approval').checked ? 1 : 0;
    
    if (!title) {
        showError('Title is required');
        return;
    }
    
    const result = await apiCall('update_chore', {
        chore_id: choreId,
        title,
        description,
        frequency,
        default_points: points,
        requires_approval: requiresApproval,
        is_recurring: frequency !== 'once' ? 1 : 0
    });
    
    if (result.ok) {
        closeModal();
        showSuccess('Chore updated');
        loadChores();
    } else {
        showError(result.error);
    }
}

async function assignChore(choreId, choreTitle) {
    const kidsResult = await apiCall('list_kids');
    if (!kidsResult.ok) {
        showError('Failed to load kids');
        return;
    }
    
    const kidsOptions = kidsResult.data.map(kid => 
        `<option value="${kid.id}">${kid.kid_name}</option>`
    ).join('');
    
    openModal(`
        <h3>Assign "${choreTitle}"</h3>
        <select id="assign-kid-id">
            <option value="">Select a kid</option>
            ${kidsOptions}
        </select>
        <div class="modal-actions">
            <button class="secondary-btn" onclick="closeModal()">Cancel</button>
            <button class="primary-btn" onclick="submitAssignChore(${choreId})">Assign</button>
        </div>
    `);
}

async function submitAssignChore(choreId) {
    const kidId = document.getElementById('assign-kid-id').value;
    if (!kidId) {
        showError('Please select a kid');
        return;
    }
    
    const result = await apiCall('assign_chore_to_kid', { kid_id: kidId, chore_id: choreId });
    if (result.ok) {
        closeModal();
        showSuccess('Chore assigned');
        loadChores();
    } else {
        showError(result.error);
    }
}

async function viewKidChores(kidId, kidName) {
    const result = await apiCall('list_kid_chores', { kid_id: kidId });
    if (result.ok) {
        const html = result.data.map(kc => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${kc.title}</h4>
                    <p>Streak: ${kc.streak_count} days • Next due: ${formatDate(kc.next_due_at)}</p>
                </div>
                <div class="list-item-actions">
                    <button class="danger-btn small-btn" onclick="unassignChore(${kidId}, ${kc.chore_id})">Unassign</button>
                </div>
            </div>
        `).join('');
        
        openModal(`
            <h3>${kidName}'s Chores</h3>
            <div class="list-container">
                ${html || '<p>No chores assigned</p>'}
            </div>
            <div class="modal-actions">
                <button class="primary-btn" onclick="closeModal()">Close</button>
            </div>
        `);
    }
}

async function unassignChore(kidId, choreId) {
    const result = await apiCall('unassign_chore', { kid_id: kidId, chore_id: choreId });
    if (result.ok) {
        closeModal();
        showSuccess('Chore unassigned');
        loadKids();
    } else {
        showError(result.error);
    }
}

// Submissions
async function loadSubmissions(status) {
    currentSubmissionsStatus = status;
    const result = await apiCall('list_submissions', { status });
    if (result.ok) {
        const html = result.data.map(sub => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${sub.kid_name} - ${sub.chore_title}</h4>
                    <p>Submitted: ${formatDate(sub.submitted_at)}</p>
                    ${sub.note ? `<p><em>"${sub.note}"</em></p>` : ''}
                    ${sub.status !== 'pending' ? `<p>Points: ${sub.points_awarded}</p>` : ''}
                </div>
                <div class="list-item-actions">
                    ${sub.status === 'pending' ? `
                        <button class="success-btn small-btn" onclick="reviewSubmission(${sub.id}, 'approved', ${sub.chore_id})">Approve</button>
                        <button class="danger-btn small-btn" onclick="reviewSubmission(${sub.id}, 'rejected')">Reject</button>
                    ` : `
                        <span class="badge badge-${sub.status === 'approved' ? 'success' : 'danger'}">${sub.status}</span>
                    `}
                </div>
            </div>
        `).join('');
        document.getElementById('submissions-list').innerHTML = html || `<p>No ${status} submissions</p>`;
    }
}

async function reviewSubmission(submissionId, status, choreId = null) {
    let pointsOverride = null;
    if (status === 'approved') {
        const points = prompt('Points to award (leave empty for default):');
        if (points !== null && points !== '') {
            pointsOverride = parseInt(points);
        }
    }
    
    const result = await apiCall('review_submission', {
        submission_id: submissionId,
        status,
        points_override: pointsOverride
    });
    
    if (result.ok) {
        showSuccess(`Submission ${status}`);
        loadSubmissions(currentSubmissionsStatus);
        loadDashboard();
    } else {
        showError(result.error);
    }
}

// Quests
async function loadQuests() {
    const result = await apiCall('list_quests');
    if (result.ok) {
        const html = result.data.map(quest => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${quest.title}</h4>
                    <p>${quest.description || 'No description'}</p>
                    <p>Reward: ${quest.target_reward} • ${quest.task_count} task(s) • ${quest.is_active ? '✅ Active' : '❌ Inactive'}</p>
                </div>
                <div class="list-item-actions">
                    <button class="secondary-btn small-btn" onclick="viewQuestTasks(${quest.id}, '${quest.title}')">Tasks</button>
                    <button class="secondary-btn small-btn" onclick="toggleQuest(${quest.id})">${quest.is_active ? 'Deactivate' : 'Activate'}</button>
                </div>
            </div>
        `).join('');
        document.getElementById('quests-list').innerHTML = html || '<p>No quests created yet</p>';
    }
}

document.getElementById('add-quest-btn').addEventListener('click', () => {
    openModal(`
        <h3>Add Quest</h3>
        <input type="text" id="quest-title" placeholder="Title" required>
        <textarea id="quest-description" placeholder="Description"></textarea>
        <input type="text" id="quest-reward" placeholder="Target Reward (e.g., Waterpark trip)">
        <div class="modal-actions">
            <button class="secondary-btn" onclick="closeModal()">Cancel</button>
            <button class="primary-btn" onclick="createQuest()">Add Quest</button>
        </div>
    `);
});

async function createQuest() {
    const title = document.getElementById('quest-title').value.trim();
    const description = document.getElementById('quest-description').value.trim();
    const targetReward = document.getElementById('quest-reward').value.trim();
    
    if (!title) {
        showError('Title is required');
        return;
    }
    
    const result = await apiCall('create_quest', { title, description, target_reward: targetReward });
    if (result.ok) {
        closeModal();
        showSuccess('Quest created');
        loadQuests();
    } else {
        showError(result.error);
    }
}

async function toggleQuest(questId) {
    const result = await apiCall('toggle_quest', { quest_id: questId });
    if (result.ok) {
        loadQuests();
    }
}

async function viewQuestTasks(questId, questTitle) {
    const result = await apiCall('list_quest_tasks', { quest_id: questId });
    if (result.ok) {
        const html = result.data.map((task, index) => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${index + 1}. ${task.title}</h4>
                    <p>${task.description || 'No description'}</p>
                    <p>${task.points} points</p>
                </div>
                <div class="list-item-actions">
                    <button class="danger-btn small-btn" onclick="deleteQuestTask(${task.id}, ${questId}, '${questTitle}')">Delete</button>
                </div>
            </div>
        `).join('');
        
        openModal(`
            <h3>${questTitle} - Tasks</h3>
            <div class="list-container">
                ${html || '<p>No tasks yet</p>'}
            </div>
            <button class="primary-btn" onclick="addQuestTask(${questId}, '${questTitle}')" style="width: 100%; margin-top: 15px;">Add Task</button>
            <div class="modal-actions">
                <button class="secondary-btn" onclick="closeModal()">Close</button>
            </div>
        `);
    }
}

function addQuestTask(questId, questTitle) {
    openModal(`
        <h3>Add Task to "${questTitle}"</h3>
        <input type="text" id="task-title" placeholder="Task Title" required>
        <textarea id="task-description" placeholder="Description"></textarea>
        <input type="number" id="task-points" placeholder="Points" value="10" min="1">
        <div class="modal-actions">
            <button class="secondary-btn" onclick="viewQuestTasks(${questId}, '${questTitle}')">Back</button>
            <button class="primary-btn" onclick="submitQuestTask(${questId}, '${questTitle}')">Add Task</button>
        </div>
    `);
}

async function submitQuestTask(questId, questTitle) {
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-description').value.trim();
    const points = parseInt(document.getElementById('task-points').value);
    
    if (!title) {
        showError('Title is required');
        return;
    }
    
    const result = await apiCall('create_quest_task', {
        quest_id: questId,
        title,
        description,
        points
    });
    
    if (result.ok) {
        viewQuestTasks(questId, questTitle);
    } else {
        showError(result.error);
    }
}

async function deleteQuestTask(taskId, questId, questTitle) {
    if (!confirm('Delete this task?')) return;
    
    const result = await apiCall('delete_quest_task', { task_id: taskId });
    if (result.ok) {
        viewQuestTasks(questId, questTitle);
    } else {
        showError(result.error);
    }
}

// Quest Task Submissions
let currentQuestTaskStatus = 'pending';

async function loadQuestTaskSubmissions(status) {
    console.log('Loading quest task submissions with status:', status);
    currentQuestTaskStatus = status;
    
    const result = await apiCall('list_quest_task_submissions', { status });
    console.log('Quest task submissions API result:', result);
    
    const container = document.getElementById('quest-tasks-list');
    if (!container) {
        console.error('quest-tasks-list container not found!');
        return;
    }
    
    if (result.ok) {
        if (!result.data || result.data.length === 0) {
            container.innerHTML = `<p>No ${status} quest task submissions</p>`;
            return;
        }
        
        const html = result.data.map(task => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${task.kid_name} - ${task.quest_title}</h4>
                    <p><strong>Task:</strong> ${task.task_title} (${task.points} points)</p>
                    ${task.note ? `<p><em>"${task.note}"</em></p>` : ''}
                    <p>Submitted: ${formatDate(task.submitted_at)}</p>
                    ${task.status !== 'pending' ? `<p>Reviewed: ${formatDate(task.reviewed_at)}</p>` : ''}
                </div>
                <div class="list-item-actions">
                    ${task.status === 'pending' ? `
                        <button class="success-btn small-btn" onclick="reviewQuestTask(${task.id}, 'approved')">Approve</button>
                        <button class="danger-btn small-btn" onclick="reviewQuestTask(${task.id}, 'rejected')">Reject</button>
                    ` : `
                        <span class="badge badge-${task.status === 'approved' ? 'success' : 'danger'}">${task.status.toUpperCase()}</span>
                    `}
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    } else {
        console.error('Quest task submissions API error:', result.error);
        container.innerHTML = `<p style="color: red;">Error: ${result.error || 'Unknown error'}</p>`;
    }
}

async function reviewQuestTask(statusId, status) {
    if (!confirm(`${status === 'approved' ? 'Approve' : 'Reject'} this quest task?`)) return;
    
    const result = await apiCall('review_quest_task', {
        status_id: statusId,
        status: status
    });
    
    if (result.ok) {
        showSuccess(`Quest task ${status}`);
        loadQuestTaskSubmissions(currentQuestTaskStatus);
        loadDashboard(); // Refresh dashboard stats
    } else {
        showError(result.error);
    }
}

// Themes
async function loadThemes() {
    console.log('Loading themes...');
    const result = await apiCall('list_themes');
    console.log('Themes API result:', result);
    
    if (result.ok) {
        const container = document.getElementById('themes-list');
        if (!container) {
            console.error('themes-list container not found!');
            return;
        }
        
        container.innerHTML = '';
        
        result.data.forEach(theme => {
            const themeCard = document.createElement('div');
            themeCard.className = 'list-item';
            themeCard.style.cssText = `border-left: 5px solid ${theme.accent_color}; background: ${theme.bg_gradient};`;
            
            themeCard.innerHTML = `
                <div class="list-item-info" style="color: ${theme.text_color};">
                    <h4 style="color: ${theme.text_color};">${theme.name}</h4>
                    <p style="color: ${theme.text_color}; opacity: 0.9;">
                        Border: ${theme.border_width} ${theme.border_style} • 
                        Radius: ${theme.border_radius} • 
                        Font: ${theme.font_family}
                    </p>
                </div>
                <div class="list-item-actions">
                    <button class="secondary-btn small-btn edit-theme-btn">Edit</button>
                </div>
            `;
            
            // Attach click handler
            const editBtn = themeCard.querySelector('.edit-theme-btn');
            editBtn.addEventListener('click', () => {
                editTheme(theme.id, theme);
            });
            
            container.appendChild(themeCard);
        });
        
        if (result.data.length === 0) {
            container.innerHTML = '<p>No themes found</p>';
        }
    } else {
        console.error('Themes API error:', result.error);
        const container = document.getElementById('themes-list');
        if (container) {
            container.innerHTML = `<p style="color: red;">Error loading themes: ${result.error || 'Unknown error'}</p>`;
        }
    }
}

function editTheme(themeId, themeData) {
    const theme = typeof themeData === 'string' ? JSON.parse(themeData) : themeData;
    
    // Helper function
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
            '255, 255, 255';
    }
    
    const cardBgRgb = hexToRgb(theme.card_bg_color || '#FFFFFF');
    const cardOpacity = theme.card_opacity || 0.95;
    
    openModal(`
        <h3>Edit Theme: ${theme.name}</h3>
        <div style="max-height: 70vh; overflow-y: auto; padding-right: 10px;">
            
            <!-- Theme Name -->
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Theme Name</label>
                <input type="text" id="theme-name" value="${theme.name}" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #ddd;">
            </div>
            
            <!-- Colors -->
            <h4 style="margin: 20px 0 10px 0;">Colors</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px;">Background</label>
                    <input type="color" id="theme-bg-color" value="${theme.bg_color}" style="width: 100%; height: 40px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Text Color</label>
                    <input type="color" id="theme-text-color" value="${theme.text_color}" style="width: 100%; height: 40px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Accent Color</label>
                    <input type="color" id="theme-accent-color" value="${theme.accent_color}" style="width: 100%; height: 40px;">
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Background Gradient (CSS)</label>
                <input type="text" id="theme-gradient" value="${theme.bg_gradient}" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #ddd;">
            </div>
            
            <!-- Card Settings -->
            <h4 style="margin: 20px 0 10px 0;">Card Settings</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px;">Card Color</label>
                    <input type="color" id="theme-card-bg" value="${theme.card_bg_color || '#FFFFFF'}" style="width: 100%; height: 40px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Opacity</label>
                    <input type="number" id="theme-card-opacity" value="${theme.card_opacity || 0.95}" min="0" max="1" step="0.05" style="width: 100%; padding: 8px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Blur (px)</label>
                    <input type="number" id="theme-card-blur" value="${theme.card_blur || 10}" min="0" max="50" style="width: 100%; padding: 8px;">
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Card Shadow (CSS)</label>
                <input type="text" id="theme-card-shadow" value="${theme.card_shadow || '0 8px 32px rgba(0,0,0,0.1)'}" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #ddd;">
            </div>
            
            <!-- Header Settings -->
            <h4 style="margin: 20px 0 10px 0;">Header Settings</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px;">Header Color</label>
                    <input type="color" id="theme-header-bg" value="${theme.header_bg_color || '#FFFFFF'}" style="width: 100%; height: 40px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Opacity</label>
                    <input type="number" id="theme-header-opacity" value="${theme.header_opacity || 0.85}" min="0" max="1" step="0.05" style="width: 100%; padding: 8px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Blur (px)</label>
                    <input type="number" id="theme-header-blur" value="${theme.header_blur || 20}" min="0" max="50" style="width: 100%; padding: 8px;">
                </div>
            </div>
            
            <!-- Nav Settings -->
            <h4 style="margin: 20px 0 10px 0;">Navigation Settings</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px;">Nav Color</label>
                    <input type="color" id="theme-nav-bg" value="${theme.nav_bg_color || '#FFFFFF'}" style="width: 100%; height: 40px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Opacity</label>
                    <input type="number" id="theme-nav-opacity" value="${theme.nav_opacity || 0.95}" min="0" max="1" step="0.05" style="width: 100%; padding: 8px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Blur (px)</label>
                    <input type="number" id="theme-nav-blur" value="${theme.nav_blur || 20}" min="0" max="50" style="width: 100%; padding: 8px;">
                </div>
            </div>
            
            <!-- Border & Font -->
            <h4 style="margin: 20px 0 10px 0;">Border & Typography</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px;">Border Style</label>
                    <select id="theme-border-style" style="width: 100%; padding: 8px;">
                        <option value="solid" ${theme.border_style === 'solid' ? 'selected' : ''}>Solid</option>
                        <option value="dashed" ${theme.border_style === 'dashed' ? 'selected' : ''}>Dashed</option>
                        <option value="dotted" ${theme.border_style === 'dotted' ? 'selected' : ''}>Dotted</option>
                        <option value="double" ${theme.border_style === 'double' ? 'selected' : ''}>Double</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Width</label>
                    <input type="text" id="theme-border-width" value="${theme.border_width}" style="width: 100%; padding: 8px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Radius</label>
                    <input type="text" id="theme-border-radius" value="${theme.border_radius}" style="width: 100%; padding: 8px;">
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Font Family</label>
                <select id="theme-font-family" style="width: 100%; padding: 8px;">
                    <option value="Quicksand" ${theme.font_family === 'Quicksand' ? 'selected' : ''}>Quicksand</option>
                    <option value="Poppins" ${theme.font_family === 'Poppins' ? 'selected' : ''}>Poppins</option>
                    <option value="Nunito" ${theme.font_family === 'Nunito' ? 'selected' : ''}>Nunito</option>
                    <option value="Roboto" ${theme.font_family === 'Roboto' ? 'selected' : ''}>Roboto</option>
                    <option value="Comic Neue" ${theme.font_family === 'Comic Neue' ? 'selected' : ''}>Comic Neue</option>
                    <option value="Russo One" ${theme.font_family === 'Russo One' ? 'selected' : ''}>Russo One</option>
                    <option value="Orbitron" ${theme.font_family === 'Orbitron' ? 'selected' : ''}>Orbitron</option>
                    <option value="Fredoka One" ${theme.font_family === 'Fredoka One' ? 'selected' : ''}>Fredoka One</option>
                    <option value="Press Start 2P" ${theme.font_family === 'Press Start 2P' ? 'selected' : ''}>Press Start 2P</option>
                </select>
            </div>
            
            <!-- Button Gradient -->
            <h4 style="margin: 20px 0 10px 0;">Button Styling</h4>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Button Gradient (CSS) - Optional</label>
                <input type="text" id="theme-button-gradient" value="${theme.button_gradient || ''}" placeholder="linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #ddd;">
            </div>
            
            <!-- Animation -->
            <h4 style="margin: 20px 0 10px 0;">Animation</h4>
            <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: center; margin-bottom: 15px;">
                <label>
                    <input type="checkbox" id="theme-has-animation" ${theme.has_animation ? 'checked' : ''}> Enable
                </label>
                <select id="theme-animation-type" style="width: 100%; padding: 8px;" ${!theme.has_animation ? 'disabled' : ''}>
                    <option value="">None</option>
                    <option value="stars" ${theme.animation_type === 'stars' ? 'selected' : ''}>⭐ Stars</option>
                    <option value="bubbles" ${theme.animation_type === 'bubbles' ? 'selected' : ''}>🫧 Bubbles</option>
                    <option value="snowflakes" ${theme.animation_type === 'snowflakes' ? 'selected' : ''}>❄️ Snowflakes</option>
                    <option value="embers" ${theme.animation_type === 'embers' ? 'selected' : ''}>🔥 Embers</option>
                    <option value="sparkles" ${theme.animation_type === 'sparkles' ? 'selected' : ''}>✨ Sparkles</option>
                    <option value="sand" ${theme.animation_type === 'sand' ? 'selected' : ''}>🏜️ Sand Blowing</option>
                    <option value="aurora" ${theme.animation_type === 'aurora' ? 'selected' : ''}>🌌 Aurora Borealis</option>
                    <option value="leaves" ${theme.animation_type === 'leaves' ? 'selected' : ''}>🍃 Falling Leaves</option>
                    <option value="candy" ${theme.animation_type === 'candy' ? 'selected' : ''}>🍬 Candy Sprinkles</option>
                    <option value="retro" ${theme.animation_type === 'retro' ? 'selected' : ''}>👾 8-Bit Sprites</option>
                    <option value="birds" ${theme.animation_type === 'birds' ? 'selected' : ''}>🦅 Flying Birds</option>
                </select>
            </div>
            
            <!-- Preview -->
            <h4 style="margin: 20px 0 10px 0;">Preview</h4>
            <div id="theme-preview" style="padding: 20px; background: ${theme.bg_gradient}; border-radius: 12px; margin-bottom: 15px;">
                <div style="background: rgba(${cardBgRgb}, ${cardOpacity}); padding: 15px; border-radius: 12px; backdrop-filter: blur(${theme.card_blur || 10}px);">
                    <h3 style="margin: 0; color: #1F2937;">Sample Card</h3>
                    <p style="margin: 10px 0 0 0; color: #6B7280;">Preview of card styling</p>
                </div>
            </div>
        </div>
        
        <div class="modal-actions">
            <button class="secondary-btn" onclick="closeModal()">Cancel</button>
            <button class="primary-btn" onclick="saveTheme(${themeId})">Save Theme</button>
        </div>
    `);
    
    // Animation checkbox handler
    const animCheckbox = document.getElementById('theme-has-animation');
    const animDropdown = document.getElementById('theme-animation-type');
    if (animCheckbox && animDropdown) {
        animCheckbox.addEventListener('change', () => {
            animDropdown.disabled = !animCheckbox.checked;
        });
    }
    
    // Live preview on any input change
    document.querySelectorAll('#theme-gradient, #theme-card-bg, #theme-card-opacity, #theme-card-blur').forEach(el => {
        if (el) {
            el.addEventListener('input', updateThemePreviewSimple);
        }
    });
}

function updateThemePreviewSimple() {
    const preview = document.getElementById('theme-preview');
    if (!preview) return;
    
    const gradient = document.getElementById('theme-gradient')?.value;
    const cardBg = document.getElementById('theme-card-bg')?.value || '#FFFFFF';
    const cardOpacity = document.getElementById('theme-card-opacity')?.value || 0.95;
    const cardBlur = document.getElementById('theme-card-blur')?.value || 10;
    
    if (gradient) preview.style.background = gradient;
    
    const card = preview.querySelector('div');
    if (card && cardBg) {
        const rgb = cardBg.match(/\w\w/g)?.map(x => parseInt(x, 16)).join(', ') || '255, 255, 255';
        card.style.background = `rgba(${rgb}, ${cardOpacity})`;
        card.style.backdropFilter = `blur(${cardBlur}px)`;
    }
}

async function saveTheme(themeId) {
    const name = document.getElementById('theme-name').value.trim();
    const bgColor = document.getElementById('theme-bg-color').value;
    const bgGradient = document.getElementById('theme-gradient').value.trim();
    const textColor = document.getElementById('theme-text-color').value;
    const accentColor = document.getElementById('theme-accent-color').value;
    const borderStyle = document.getElementById('theme-border-style').value;
    const borderWidth = document.getElementById('theme-border-width').value.trim();
    const borderRadius = document.getElementById('theme-border-radius').value.trim();
    const fontFamily = document.getElementById('theme-font-family').value;
    const hasAnimation = document.getElementById('theme-has-animation').checked ? 1 : 0;
    const animationType = document.getElementById('theme-animation-type').value;
    
    // New CSS controls
    const cardBgColor = document.getElementById('theme-card-bg').value;
    const cardOpacity = parseFloat(document.getElementById('theme-card-opacity').value);
    const cardBlur = parseInt(document.getElementById('theme-card-blur').value);
    const cardShadow = document.getElementById('theme-card-shadow').value.trim();
    const headerBgColor = document.getElementById('theme-header-bg').value;
    const headerOpacity = parseFloat(document.getElementById('theme-header-opacity').value);
    const headerBlur = parseInt(document.getElementById('theme-header-blur').value);
    const navBgColor = document.getElementById('theme-nav-bg').value;
    const navOpacity = parseFloat(document.getElementById('theme-nav-opacity').value);
    const navBlur = parseInt(document.getElementById('theme-nav-blur').value);
    const buttonGradient = document.getElementById('theme-button-gradient').value.trim();
    
    if (!name) {
        showError('Theme name is required');
        return;
    }
    
    const result = await apiCall('update_theme', {
        theme_id: themeId,
        name: name,
        bg_color: bgColor,
        bg_gradient: bgGradient,
        text_color: textColor,
        accent_color: accentColor,
        border_style: borderStyle,
        border_width: borderWidth,
        border_radius: borderRadius,
        font_family: fontFamily,
        has_animation: hasAnimation,
        animation_type: animationType,
        card_bg_color: cardBgColor,
        card_opacity: cardOpacity,
        card_blur: cardBlur,
        card_shadow: cardShadow,
        header_bg_color: headerBgColor,
        header_opacity: headerOpacity,
        header_blur: headerBlur,
        nav_bg_color: navBgColor,
        nav_opacity: navOpacity,
        nav_blur: navBlur,
        button_gradient: buttonGradient
    });
    
    if (result.ok) {
        closeModal();
        showSuccess('Theme updated!');
        loadThemes();
    } else {
        showError(result.error);
    }
}

// Rewards
async function loadRewards() {
    const result = await apiCall('list_rewards');
    if (result.ok) {
        const html = result.data.map(reward => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${reward.title}</h4>
                    <p>${reward.description || 'No description'}</p>
                    <p>${reward.cost_points} points • ${reward.is_active ? '✅ Active' : '❌ Inactive'}</p>
                </div>
                <div class="list-item-actions">
                    <button class="secondary-btn small-btn" onclick="toggleReward(${reward.id})">${reward.is_active ? 'Deactivate' : 'Activate'}</button>
                </div>
            </div>
        `).join('');
        document.getElementById('rewards-list').innerHTML = html || '<p>No rewards created yet</p>';
    }
}

document.getElementById('add-reward-btn').addEventListener('click', () => {
    openModal(`
        <h3>Add Reward</h3>
        <input type="text" id="reward-title" placeholder="Title" required>
        <textarea id="reward-description" placeholder="Description"></textarea>
        <input type="number" id="reward-cost" placeholder="Cost (points)" value="50" min="1">
        <div class="modal-actions">
            <button class="secondary-btn" onclick="closeModal()">Cancel</button>
            <button class="primary-btn" onclick="createReward()">Add Reward</button>
        </div>
    `);
});

async function createReward() {
    const title = document.getElementById('reward-title').value.trim();
    const description = document.getElementById('reward-description').value.trim();
    const cost = parseInt(document.getElementById('reward-cost').value);
    
    if (!title) {
        showError('Title is required');
        return;
    }
    
    const result = await apiCall('create_reward', {
        title,
        description,
        cost_points: cost
    });
    
    if (result.ok) {
        closeModal();
        showSuccess('Reward created');
        loadRewards();
    } else {
        showError(result.error);
    }
}

async function toggleReward(rewardId) {
    const result = await apiCall('toggle_reward', { reward_id: rewardId });
    if (result.ok) {
        loadRewards();
    }
}

// Settings
document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const current = document.getElementById('current-password').value;
    const newPass = document.getElementById('new-password').value;
    
    if (newPass.length < 8) {
        document.getElementById('password-message').textContent = 'Password must be at least 8 characters';
        document.getElementById('password-message').className = 'message error';
        return;
    }
    
    const result = await apiCall('admin_change_password', {
        current_password: current,
        new_password: newPass
    });
    
    if (result.ok) {
        document.getElementById('password-message').textContent = 'Password changed successfully';
        document.getElementById('password-message').className = 'message success';
        document.getElementById('change-password-form').reset();
    } else {
        document.getElementById('password-message').textContent = result.error;
        document.getElementById('password-message').className = 'message error';
    }
});

// Event Listeners
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadSubmissions(btn.dataset.status);
    });
});

document.querySelector('.close').addEventListener('click', closeModal);

window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal')) {
        closeModal();
    }
});

// Add quest task filter buttons
document.querySelectorAll('.filter-btn-quest-task').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn-quest-task').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadQuestTaskSubmissions(btn.dataset.status);
    });
});

// Add this after the submissions filter buttons
document.querySelectorAll('.filter-btn-redemption').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn-redemption').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadRedemptions(btn.dataset.status);
    });
});



// Redemptions
let currentRedemptionsStatus = 'pending';

async function loadRedemptions(status) {
    console.log('Loading redemptions with status:', status);
    currentRedemptionsStatus = status;
    
    const result = await apiCall('list_redemptions', { status });
    
    console.log('Redemptions API result:', result);
    
    if (result.ok) {
        console.log('Redemptions data:', result.data);
        
        if (!result.data || result.data.length === 0) {
            document.getElementById('redemptions-list').innerHTML = `<p>No ${status} redemptions</p>`;
            return;
        }
        
        const html = result.data.map(red => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${red.kid_name} - ${red.reward_title}</h4>
                    <p>Cost: ${red.cost_points} points</p>
                    <p>Requested: ${formatDate(red.requested_at)}</p>
                    ${red.status !== 'pending' ? `<p>Resolved: ${formatDate(red.resolved_at)}</p>` : ''}
                </div>
                <div class="list-item-actions">
                    ${red.status === 'pending' ? `
                        <button class="success-btn small-btn" onclick="reviewRedemption(${red.id}, 'approved')">Approve</button>
                        <button class="danger-btn small-btn" onclick="reviewRedemption(${red.id}, 'rejected')">Reject</button>
                    ` : `
                        <span class="badge badge-${red.status === 'approved' ? 'success' : 'danger'}">${red.status.toUpperCase()}</span>
                    `}
                </div>
            </div>
        `).join('');
        
        document.getElementById('redemptions-list').innerHTML = html;
    } else {
        console.error('Redemptions API error:', result.error);
        document.getElementById('redemptions-list').innerHTML = `<p style="color: red;">Error: ${result.error}</p>`;
    }
}

async function reviewRedemption(redemptionId, status) {
    if (!confirm(`${status === 'approved' ? 'Approve' : 'Reject'} this redemption?`)) return;
    
    const result = await apiCall('review_redemption', {
        redemption_id: redemptionId,
        status
    });
    
    if (result.ok) {
        showSuccess(`Redemption ${status}`);
        loadRedemptions(currentRedemptionsStatus);
        loadDashboard();
    } else {
        showError(result.error);
    }
}

// Admin Management
async function loadAdmins() {
    const result = await apiCall('list_admins');
    if (result.ok) {
        const html = result.data.map(admin => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${admin.name || admin.email}</h4>
                    <p>${admin.email}</p>
                    <p>Created: ${formatDate(admin.created_at)}</p>
                </div>
                <div class="list-item-actions">
                    ${admin.id !== currentUser.id ? `
                        <button class="danger-btn small-btn" onclick="deleteAdmin(${admin.id}, '${admin.email}')">Delete</button>
                    ` : `
                        <span class="badge badge-primary">Current User</span>
                    `}
                </div>
            </div>
        `).join('');
        document.getElementById('admins-list').innerHTML = html;
    }
}

function showAddAdminModal() {
    openModal(`
        <h3>Add Admin User</h3>
        <form id="add-admin-form" onsubmit="createAdmin(event); return false;">
            <input type="text" id="admin-name" placeholder="Name (optional)" autocomplete="name">
            <input type="email" id="admin-email" placeholder="Email" required autocomplete="email">
            <input type="password" id="admin-password" placeholder="Password (min 8 chars)" required autocomplete="new-password" minlength="8">
            <div class="modal-actions">
                <button type="button" class="secondary-btn" onclick="closeModal()">Cancel</button>
                <button type="submit" class="primary-btn">Create Admin</button>
            </div>
        </form>
    `);
}

async function createAdmin(event) {
    if (event) event.preventDefault();
    
    const form = document.getElementById('add-admin-form');
    if (!form) {
        console.error('Form not found');
        return;
    }
    
    const nameInput = form.querySelector('#admin-name');
    const emailInput = form.querySelector('#admin-email');
    const passwordInput = form.querySelector('#admin-password');
    
    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    
    if (!email || !password) {
        alert('Email and password required');
        return;
    }
    
    if (password.length < 8) {
        alert('Password must be at least 8 characters');
        return;
    }
    
    const result = await apiCall('create_admin', { name, email, password });
    
    if (result.ok) {
        closeModal();
        alert(`Admin created: ${email}`);
        loadAdmins();
    } else {
        alert('Error: ' + result.error);
    }
}

async function deleteAdmin(adminId, email) {
    if (!confirm(`Delete admin: ${email}?`)) return;
    
    const result = await apiCall('delete_admin', { admin_id: adminId });
    
    if (result.ok) {
        showSuccess('Admin deleted');
        loadAdmins();
    } else {
        showError(result.error);
    }
}

// Setup Wizard
let wizardPresets = null;
let selectedKidId = null;

async function loadWizard() {
    // Load presets
    const result = await apiCall('load_chore_presets');
    if (result.ok) {
        wizardPresets = result.data;
    }
    
    // Load kids for selection
    const kidsResult = await apiCall('list_kids');
    if (kidsResult.ok && kidsResult.data && kidsResult.data.length > 0) {
        const container = document.getElementById('wizard-kid-selection');
        
        kidsResult.data.forEach(kid => {
            const label = document.createElement('label');
            label.className = 'kid-option';
            label.innerHTML = `
                <input type="radio" name="wizard-kid" value="${kid.id}">
                <span>${kid.name || 'Kid #' + kid.id}</span>
            `;
            container.appendChild(label);
        });
    } else {
        console.log('No kids found or empty response:', kidsResult);
    }
}

function wizardNext(step) {
    // Hide current step
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
    
    // Show next step
    document.getElementById(`wizard-step-${step}`).classList.add('active');
    
    // Save kid selection on step 1→2
    if (step === 2) {
        const selected = document.querySelector('input[name="wizard-kid"]:checked');
        selectedKidId = selected ? selected.value : null;
    }
}

function wizardBack(step) {
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`wizard-step-${step}`).classList.add('active');
}

async function installPresets() {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Installing...';
    
    try {
        let totalChores = 0;
        
        // Get selected categories
        const selectedCategories = Array.from(document.querySelectorAll('input[name="category"]:checked'))
            .map(cb => cb.value);
        
        // Install each category
        for (const category of selectedCategories) {
            const chores = wizardPresets[category];
            
            const result = await apiCall('install_preset_category', {
                category: category,
                chores: chores,
                kid_id: selectedKidId || null
            });
            
            if (result.ok) {
                totalChores += result.data.installed;
            }
        }
        
        // Install rewards if selected
        let totalRewards = 0;
        if (document.getElementById('install-rewards').checked) {
            const result = await apiCall('install_preset_rewards', {
                rewards: wizardPresets.rewards
            });
            
            if (result.ok) {
                totalRewards = result.data.installed;
            }
        }
        
        // Show success
        document.getElementById('wizard-summary').innerHTML = `
            <strong>Successfully installed:</strong><br>
            ✓ ${totalChores} chores<br>
            ✓ ${totalRewards} rewards<br><br>
            Your family is ready to start earning points!
        `;
        
        wizardNext(4);
        
    } catch (error) {
        alert('Error installing presets: ' + error.message);
        btn.disabled = false;
        btn.textContent = '🚀 Install Everything!';
    }
}

function resetWizard() {
    // Uncheck all
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelector('input[name="wizard-kid"]').checked = true;
    
    // Go back to step 1
    wizardNext(1);
}

// Load wizard when setup tab is clicked
document.querySelector('[data-tab="setup-wizard"]')?.addEventListener('click', loadWizard);

// Family Board
async function loadFamilyBoard() {
    // Load all data
    const kidsResult = await apiCall('list_kids');
    const rewardsResult = await apiCall('list_rewards');
    const questsResult = await apiCall('list_quests');
    const analyticsResult = await apiCall('family_analytics');
    
    if (!analyticsResult.ok || !kidsResult.ok) {
        document.getElementById('family-kids-grid').innerHTML = '<p>Error loading data</p>';
        return;
    }
    
    const analytics = analyticsResult.data;
    const kids = kidsResult.data;
    
    // 1. ECONOMY STATS
    const totalPointsInCirculation = kids.reduce((sum, k) => sum + k.total_points, 0);
    const avgWeeklyEarnings = analytics.kid_stats.length > 0 
        ? Math.round(analytics.kid_stats.reduce((sum, k) => sum + k.week_earned, 0) / analytics.kid_stats.length)
        : 0;
    const avgMonthlyEarnings = analytics.kid_stats.length > 0
        ? Math.round(analytics.kid_stats.reduce((sum, k) => sum + k.month_earned, 0) / analytics.kid_stats.length)
        : 0;
    
    document.getElementById('economy-stats').innerHTML = `
        <div class="economy-stat-card">
            <div class="label">Total Points in System</div>
            <div class="value">${totalPointsInCirculation}</div>
        </div>
        <div class="economy-stat-card">
            <div class="label">Avg Weekly Earnings</div>
            <div class="value">${avgWeeklyEarnings}</div>
        </div>
        <div class="economy-stat-card">
            <div class="label">Avg Monthly Earnings</div>
            <div class="value">${avgMonthlyEarnings}</div>
        </div>
        <div class="economy-stat-card">
            <div class="label">Recent Redemptions (30d)</div>
            <div class="value">${analytics.recent_redemptions.length}</div>
        </div>
    `;
    
    // 2. KIDS CARDS
    const kidsGrid = document.getElementById('family-kids-grid');
    kidsGrid.innerHTML = analytics.kid_stats.map(kid => `
        <div class="family-kid-card">
            <h3>${kid.kid_name}</h3>
            <div class="points">${kid.total_points}</div>
            <div style="font-size: 14px; opacity: 0.9;">current points</div>
            <div style="margin-top: 10px; font-size: 13px; opacity: 0.8;">
                📊 This week: +${kid.week_earned}
            </div>
        </div>
    `).join('');
    
    // 3. EARNINGS CHART
    const maxEarnings = Math.max(...analytics.kid_stats.map(k => k.month_earned), 1);
    document.getElementById('earnings-chart').innerHTML = `
        <div style="margin-bottom: 15px; color: #6B7280; font-size: 14px;">Monthly earnings comparison (last 30 days)</div>
        ${analytics.kid_stats.map(kid => `
            <div class="earnings-bar" style="--bar-width: ${(kid.month_earned / maxEarnings * 100)}%;">
                <span class="name">${kid.kid_name}</span>
                <span class="points">${kid.month_earned} pts</span>
            </div>
        `).join('')}
    `;
    
    // 4. REWARDS WITH ANALYSIS
    if (rewardsResult.ok) {
        const rewardsGrid = document.getElementById('family-rewards-grid');
        rewardsGrid.innerHTML = rewardsResult.data
            .filter(r => r.is_active)
            .sort((a, b) => a.cost_points - b.cost_points)
            .map(reward => {
                const whoCanAfford = kids.filter(k => k.total_points >= reward.cost_points).map(k => k.kid_name);
                
                // Calculate days to earn for EACH kid individually based on monthly rate
                const kidEarningAnalysis = analytics.kid_stats.map(kid => {
                    const monthlyRate = kid.month_earned; // Points earned in last 30 days
                    const dailyRate = monthlyRate / 30;
                    
                    if (dailyRate <= 0) {
                        return { name: kid.kid_name, days: 999, rate: 0 };
                    }
                    
                    const pointsNeeded = Math.max(0, reward.cost_points - kid.total_points);
                    const daysToEarn = Math.ceil(pointsNeeded / dailyRate);
                    
                    return { 
                        name: kid.kid_name, 
                        days: daysToEarn,
                        rate: dailyRate,
                        hasEnough: kid.total_points >= reward.cost_points
                    };
                }).sort((a, b) => a.days - b.days); // Sort by fastest earner first
                
                // Find the fastest active earner
                const fastestEarner = kidEarningAnalysis.find(k => k.rate > 0);
                
                let analysisClass = 'realistic';
                let analysisText = '';
                
                if (whoCanAfford.length > 0) {
                    analysisClass = 'realistic';
                    analysisText = `✅ Available now for ${whoCanAfford.join(', ')}!`;
                } else if (fastestEarner && fastestEarner.days <= 7) {
                    analysisClass = 'realistic';
                    analysisText = `✅ ${fastestEarner.name} can earn this in ~${fastestEarner.days} day${fastestEarner.days === 1 ? '' : 's'}`;
                } else if (fastestEarner && fastestEarner.days <= 30) {
                    analysisClass = 'challenging';
                    analysisText = `⚠️ ${fastestEarner.name} can earn this in ~${fastestEarner.days} days`;
                } else if (fastestEarner) {
                    analysisClass = 'unrealistic';
                    analysisText = `❌ Takes ${fastestEarner.days}+ days - consider lowering cost`;
                } else {
                    analysisClass = 'unrealistic';
                    analysisText = `❌ No active earners - kids need to complete chores!`;
                }
                
                // Build detailed breakdown
                const earnerBreakdown = kidEarningAnalysis
                    .filter(k => k.rate > 0 && !k.hasEnough)
                    .map(k => `${k.name}: ${k.days}d`)
                    .join(' • ');
                
                return `
                    <div class="family-reward-card ${whoCanAfford.length > 0 ? 'affordable' : ''}">
                        <div class="emoji">${getRewardEmoji(reward.title)}</div>
                        <div class="title">${reward.title}</div>
                        <div class="cost">${reward.cost_points} pts</div>
                        ${reward.description ? `<div style="font-size: 13px; color: #6B7280; margin-top: 5px;">${reward.description}</div>` : ''}
                        ${whoCanAfford.length > 0 ? `<div class="can-afford">✓ ${whoCanAfford.join(', ')} can afford!</div>` : ''}
                        <div class="reward-analysis ${analysisClass}">
                            ${analysisText}
                            ${earnerBreakdown && !whoCanAfford.length ? `<div style="font-size: 11px; margin-top: 5px; opacity: 0.8;">${earnerBreakdown}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
    }

    // 5. QUESTS WITH TOTAL VALUE
    if (questsResult.ok) {
        const questsList = document.getElementById('family-quests-list');
        
        const activeQuests = questsResult.data.filter(q => q.is_active);
        
        if (activeQuests.length === 0) {
            questsList.innerHTML = '<p style="color: #6B7280; text-align: center;">No active quests</p>';
        } else {
            questsList.innerHTML = await Promise.all(
                activeQuests.map(async quest => {
                    const tasksResult = await apiCall('list_quest_tasks', { quest_id: quest.id });
                    const totalValue = tasksResult.ok 
                        ? tasksResult.data.reduce((sum, t) => sum + t.points, 0)
                        : 0;
                    
                    const daysToComplete = avgWeeklyEarnings > 0 && totalValue > 0
                        ? Math.ceil((totalValue / avgWeeklyEarnings) * 7)
                        : 0;
                    
                    return `
                        <div class="family-quest-card">
                            <h4>⭐ ${quest.title}</h4>
                            ${quest.description ? `<p style="color: #6B7280; margin: 5px 0 15px 0;">${quest.description}</p>` : ''}
                            ${quest.target_reward ? `<p style="color: #92400E; font-weight: 600; margin-bottom: 15px;">🎯 Goal: ${quest.target_reward}</p>` : ''}
                            
                            ${tasksResult.ok && tasksResult.data.length > 0 ? `
                                <div class="quest-tasks-grid">
                                    ${tasksResult.data.map(task => `
                                        <div class="quest-task-box">
                                            <div style="font-weight: 600; margin-bottom: 5px;">${task.title}</div>
                                            <div style="font-size: 18px; color: #F59E0B; font-weight: bold;">${task.points} pts</div>
                                        </div>
                                    `).join('')}
                                </div>
                                
                                <div class="quest-value-box">
                                    <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">
                                        Total Quest Value: ${totalValue} points
                                    </div>
                                    <div style="font-size: 13px; color: #92400E;">
                                        ${daysToComplete > 0 ? `Equivalent to ~${daysToComplete} days of regular chores` : 'Complete all tasks to earn!'}
                                    </div>
                                </div>
                            ` : '<p style="color: #6B7280; font-size: 14px;">No tasks yet</p>'}
                        </div>
                    `;
                })
            ).then(html => html.join(''));
        }
    }
}

function getRewardEmoji(title) {
    const lower = title.toLowerCase();
    if (lower.includes('phone') || lower.includes('screen')) return '📱';
    if (lower.includes('game') || lower.includes('play')) return '🎮';
    if (lower.includes('movie') || lower.includes('tv')) return '🎬';
    if (lower.includes('treat') || lower.includes('candy') || lower.includes('ice cream')) return '🍦';
    if (lower.includes('toy')) return '🧸';
    if (lower.includes('money') || lower.includes('cash') || lower.includes('$')) return '💰';
    if (lower.includes('bike')) return '🚲';
    if (lower.includes('book')) return '📚';
    if (lower.includes('pet')) return '🐶';
    if (lower.includes('trip') || lower.includes('outing')) return '🚗';
    return '🎁';
}

// Point Economics
async function loadPointEconomics() {
    const result = await apiCall('point_economics');
    
    if (!result.ok) {
        document.getElementById('earning-potential-grid').innerHTML = '<p>Error loading data</p>';
        return;
    }
    
    const { chores, rewards, kid_count } = result.data;
    
    // Calculate earning potential
    let dailyPotential = 0;
    let weeklyPotential = 0;
    let monthlyPotential = 0;
    
    chores.forEach(chore => {
        const timesPerKid = chore.assigned_count; // Number of kids assigned
        
        switch(chore.recurrence_type) {
            case 'daily':
                dailyPotential += chore.default_points * timesPerKid;
                weeklyPotential += chore.default_points * timesPerKid * 7;
                monthlyPotential += chore.default_points * timesPerKid * 30;
                break;
            case 'weekly':
                weeklyPotential += chore.default_points * timesPerKid;
                monthlyPotential += chore.default_points * timesPerKid * 4;
                break;
            case 'monthly':
                monthlyPotential += chore.default_points * timesPerKid;
                break;
            case 'once':
                // One-time chores counted toward monthly potential
                monthlyPotential += chore.default_points * timesPerKid;
                break;
        }
    });
    
    // Display earning potential
    document.getElementById('earning-potential-grid').innerHTML = `
        <div class="earning-potential-card">
            <div class="period">Per Day</div>
            <div class="amount">${dailyPotential}</div>
            <div class="label">max points/day</div>
        </div>
        <div class="earning-potential-card">
            <div class="period">Per Week</div>
            <div class="amount">${weeklyPotential}</div>
            <div class="label">max points/week</div>
        </div>
        <div class="earning-potential-card">
            <div class="period">Per Month</div>
            <div class="amount">${monthlyPotential}</div>
            <div class="label">max points/month</div>
        </div>
        <div class="earning-potential-card" style="border-color: #10B981;">
            <div class="period">Per Kid/Month</div>
            <div class="amount" style="color: #10B981;">${kid_count > 0 ? Math.round(monthlyPotential / kid_count) : 0}</div>
            <div class="label">average if all complete</div>
        </div>
    `;
    
    // Display chore values
    const choreValuesHtml = chores.map(chore => {
        const freqClass = `freq-${chore.recurrence_type}`;
        const freqLabel = chore.recurrence_type.charAt(0).toUpperCase() + chore.recurrence_type.slice(1);
        
        return `
            <div class="chore-value-row">
                <div class="chore-info">
                    <div class="chore-title">${chore.title}</div>
                    <div class="chore-meta">
                        <span class="frequency-badge ${freqClass}">${freqLabel}</span>
                        Assigned to ${chore.assigned_count} kid${chore.assigned_count === 1 ? '' : 's'}
                    </div>
                </div>
                <div class="points-badge">${chore.default_points} pts</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('chore-values-list').innerHTML = choreValuesHtml || '<p style="color: #6B7280;">No chores created yet</p>';
    
    // Build chore-to-reward matrix
    if (chores.length === 0 || rewards.length === 0) {
        document.getElementById('chore-reward-matrix').innerHTML = '<p style="color: #6B7280;">Create chores and rewards to see the matrix</p>';
        return;
    }
    
    let matrixHtml = '<table class="matrix-table"><thead><tr>';
    matrixHtml += '<th class="chore-name-col">Chore</th>';
    
    rewards.forEach(reward => {
        matrixHtml += `<th>${reward.title}<br><span style="font-weight: normal; font-size: 12px;">${reward.cost_points} pts</span></th>`;
    });
    
    matrixHtml += '</tr></thead><tbody>';
    
    chores.forEach(chore => {
        matrixHtml += '<tr>';
        matrixHtml += `<td class="chore-name-col">${chore.title} <span style="color: #6B7280; font-weight: normal;">(${chore.default_points} pts)</span></td>`;
        
        rewards.forEach(reward => {
            const timesNeeded = Math.ceil(reward.cost_points / chore.default_points);
            
            let cellClass = '';
            if (timesNeeded === 1) cellClass = 'easy';
            else if (timesNeeded <= 5) cellClass = 'easy';
            else if (timesNeeded <= 15) cellClass = 'medium';
            else if (timesNeeded <= 50) cellClass = 'hard';
            else cellClass = 'impossible';
            
            matrixHtml += `<td><span class="matrix-cell ${cellClass}">${timesNeeded}×</span></td>`;
        });
        
        matrixHtml += '</tr>';
    });
    
    matrixHtml += '</tbody></table>';
    
    document.getElementById('chore-reward-matrix').innerHTML = matrixHtml;
}

// Initialize
(async function() {
    // Only check auth on page load, don't auto-login
    const result = await apiCall('admin_me');
    if (result.ok) {
        // Already logged in
        currentUser = result.data;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        document.getElementById('admin-email').textContent = currentUser.email;
        
        // Show version
        fetch('/api/version.php')
            .then(r => r.json())
            .then(data => {
                const versionEl = document.getElementById('app-version');
                if (versionEl) versionEl.textContent = `v${data.version}`;
            })
            .catch(() => {});
        
        await loadDashboard();
    }
    // If not logged in, login screen stays visible
})();