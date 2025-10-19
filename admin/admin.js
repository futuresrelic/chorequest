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
            await loadSubmissions(currentSubmissionsStatus);
            break;
        case 'redemptions':
            await loadRedemptions(currentRedemptionsStatus);
            break;
        case 'admins':
            await loadAdmins();
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
                    <h4>${kid.kid_name}</h4>
                    <p>${kid.total_points} points • ${kid.chore_count} chores • ${kid.device_count} device(s)</p>
                </div>
                <div class="list-item-actions">
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