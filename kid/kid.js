// kid.js - Kid app functionality with extensive mobile debugging

const API_URL = '../api/api.php';
let currentKid = null;
let pollInterval = null;

// Add global error handler
window.onerror = function(msg, url, line) {
    alert('Error: ' + msg + ' at line ' + line);
    return false;
};

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
    alert('ERROR: ' + message);
}

function showSuccess(message) {
    alert('SUCCESS: ' + message);
}

function formatDate(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function isDue(dueDateString) {
    if (!dueDateString) return false;
    return new Date(dueDateString) <= new Date();
}

// Pairing
document.getElementById('pairing-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const code = document.getElementById('pairing-code').value.toUpperCase().trim();
    const deviceLabel = `${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'} Device`;
    
    const result = await apiCall('pair_device', { code, device_label: deviceLabel });
    
    if (result.ok) {
        // Just reload the page - simplest solution
        alert('Pairing successful! The page will now reload.');
        window.location.reload();
    } else {
        document.getElementById('pairing-error').textContent = result.error || 'Pairing failed';
    }
});

function showPairingScreen() {
    document.getElementById('pairing-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
}

function showAppScreen() {
    document.getElementById('pairing-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    
    // Wait for DOM to be ready
    setTimeout(() => {
        updateHeader();
        loadFeed();
        loadSettings();
        attachSettingsListeners();
    }, 50);
}

// Check if already paired
async function checkPairing() {
    const result = await apiCall('kid_me');
    if (result.ok) {
        currentKid = result.data;
        showAppScreen();
        startPolling();
    } else {
        showPairingScreen();
    }
}

// Update header
function updateHeader() {
    if (!currentKid) return;
    
    const nameEl = document.getElementById('kid-name');
    const pointsEl = document.getElementById('kid-points');
    const avatar = document.getElementById('kid-avatar');
    
    if (nameEl) {
        nameEl.textContent = currentKid.kid_name;
    }
    
    if (pointsEl) {
        pointsEl.textContent = `⭐ ${currentKid.total_points} points`;
    }
    
    if (avatar) {
        // Check if user has custom settings
        const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
        if (settings.avatarType) {
            applyAvatar(settings.avatarType, settings.avatarColor);
        } else {
            // Default: use logo
            avatar.innerHTML = `<img src="/assets/kid-icon-192.png" alt="${currentKid.kid_name}" style="width: 100%; height: 100%; object-fit: cover;">`;
        }
    }
}

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        switchView(view);
    });
});

function switchView(viewName) {
    console.log('Switching to view:', viewName);
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewName) btn.classList.add('active');
    });
    
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
        view.classList.add('hidden');
    });
    
    const targetView = document.getElementById(`view-${viewName}`);
    console.log('Target view element:', targetView);
    
    if (targetView) {
        targetView.classList.remove('hidden');
        targetView.classList.add('active');
    }
    
    loadViewData(viewName);
}

async function loadViewData(viewName) {
    switch(viewName) {
        case 'chores':
            await loadChores();
            break;
        case 'quests':
            await loadQuests();
            break;
        case 'rewards':
            await loadRewards();
            break;
        case 'history':
            await loadHistory();
            break;
        case 'settings':
            // Settings view doesn't need to load data
            // Just make sure preview is updated
            if (currentKid) {
                updatePreview();
            }
            break;
    }
}

// Load feed data
async function loadFeed() {
    console.log('Loading feed...');
    const result = await apiCall('kid_feed');
    if (result.ok) {
        currentKid.total_points = result.data.total_points;
        updateHeader();
        renderChores(result.data.chores, result.data.submissions || []);
        
        if (result.data.submissions) {
            result.data.submissions.forEach(sub => {
                if (sub.status === 'approved' && !localStorage.getItem(`confetti_${sub.id}`)) {
                    triggerConfetti();
                    localStorage.setItem(`confetti_${sub.id}`, 'shown');
                }
            });
        }
    }
}

// Chores
async function loadChores() {
    console.log('Loading chores...');
    const result = await apiCall('kid_feed');
    if (result.ok) {
        renderChores(result.data.chores, result.data.submissions || []);
    }
}

function renderChores(chores, submissions = []) {
    if (!chores || chores.length === 0) {
        document.getElementById('chores-list').innerHTML = `
            <div class="empty-state">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <h3>No Chores Yet</h3>
                <p>Check back later for new chores!</p>
            </div>
        `;
        return;
    }
    
    const container = document.getElementById('chores-list');
    container.innerHTML = '';
    
    chores.forEach(chore => {
        const isDueNow = parseInt(chore.is_due) === 1;
        
        // Find the most recent submission for this chore
        const recentSubmission = submissions
            .filter(s => s.chore_id === chore.chore_id)
            .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0];
        
        const isPending = recentSubmission && recentSubmission.status === 'pending';
        const isApproved = recentSubmission && recentSubmission.status === 'approved' && !isDueNow;
        
        let buttonText, buttonClass, buttonDisabled, statusBadge;
        
        if (isPending) {
            buttonText = '⏳ In Review';
            buttonClass = 'btn-disabled';
            buttonDisabled = true;
            statusBadge = '<span class="badge badge-warning">⏳ Pending Review</span>';
        } else if (isApproved) {
            buttonText = '✅ Completed';
            buttonClass = 'btn-disabled';
            buttonDisabled = true;
            statusBadge = '<span class="badge badge-success">✅ Approved</span>';
        } else if (isDueNow) {
            buttonText = chore.requires_approval ? 'Submit for Review' : 'Mark Complete';
            buttonClass = 'btn-success';
            buttonDisabled = false;
            statusBadge = '<span class="due-badge">Due Now!</span>';
        } else {
            buttonText = '⏰ Not Due Yet';
            buttonClass = 'btn-disabled';
            buttonDisabled = true;
            statusBadge = '';
        }
        
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="card-title">${chore.title}</div>
                    ${chore.description ? `<div class="card-description">${chore.description}</div>` : ''}
                </div>
            </div>
            
            <div class="card-meta">
                <span class="badge badge-primary">⭐ ${chore.default_points} points</span>
                ${chore.streak_count > 0 ? `<span class="streak-badge">🔥 ${chore.streak_count} day streak</span>` : ''}
                ${statusBadge}
            </div>
            
            <div class="chore-status">
                <span>Due: ${formatDate(chore.next_due_at)}</span>
            </div>
            
            <div class="card-actions">
                <button class="btn ${buttonClass} chore-submit-btn" 
                        ${buttonDisabled ? 'disabled' : ''}>
                    ${buttonText}
                </button>
            </div>
        `;
        
        container.appendChild(card);
        
        // Only attach handlers if button is enabled
        if (!buttonDisabled) {
            const button = card.querySelector('.chore-submit-btn');
            const handleSubmit = function(e) {
                e.preventDefault();
                e.stopPropagation();
                button.disabled = true;
                button.textContent = 'Submitting...';
                submitChore(chore.chore_id, chore.title);
            };
            
            button.addEventListener('click', handleSubmit);
            button.addEventListener('touchend', handleSubmit);
            button.onclick = handleSubmit;
        }
    });
}

async function submitChore(choreId, choreTitle) {
    const note = prompt(`Submit "${choreTitle}".\n\nAdd a note (optional):`);
    if (note === null) return; // User clicked cancel
    
    const result = await apiCall('submit_chore_completion', {
        chore_id: choreId,
        note: note.trim()
    });
    
    if (result.ok) {
        if (result.data.status === 'approved') {
            alert(`Great job! You earned ${result.data.points_awarded} points!`);
            triggerConfetti();
        } else {
            alert('Submitted for review!');
        }
        await loadFeed();
        await loadChores();
    } else {
        alert('Error: ' + result.error);
    }
}

// Quests
async function loadQuests() {
    const result = await apiCall('kid_quest_progress');
    if (result.ok) {
        renderQuests(result.data);
    }
}

function renderQuests(quests) {
    if (!quests || quests.length === 0) {
        document.getElementById('quests-list').innerHTML = `
            <div class="empty-state">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                <h3>No Active Quests</h3>
                <p>New quests will appear here!</p>
            </div>
        `;
        return;
    }
    
    const container = document.getElementById('quests-list');
    container.innerHTML = '';
    
    quests.forEach(quest => {
        const progress = quest.total_points > 0 ? (quest.earned_points / quest.total_points * 100) : 0;
        const isComplete = quest.completed_tasks === quest.total_tasks;
        
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="card-title">${quest.title}</div>
                    ${quest.description ? `<div class="card-description">${quest.description}</div>` : ''}
                </div>
            </div>
            
            <div class="progress-container">
                <div class="progress-label">
                    <span>${quest.completed_tasks} / ${quest.total_tasks} tasks</span>
                    <span>${quest.earned_points} / ${quest.total_points} points</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
            </div>
            
            ${quest.target_reward ? `
                <div class="card-meta">
                    <span class="badge badge-warning">🎁 ${quest.target_reward}</span>
                </div>
            ` : ''}
            
            ${isComplete ? `
                <div class="badge badge-success" style="margin-top: 15px; display: inline-block;">
                    ✅ Quest Complete!
                </div>
            ` : `
                <button class="btn btn-primary quest-tasks-btn" style="margin-top: 15px;">
                    View Tasks
                </button>
            `}
        `;
        
        container.appendChild(card);
        
        if (!isComplete) {
            const button = card.querySelector('.quest-tasks-btn');
            if (button) {
                const handleClick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    viewQuestTasks(quest.id, quest.title);
                };
                
                button.addEventListener('click', handleClick);
                button.addEventListener('touchend', handleClick);
                button.onclick = handleClick;
            }
        }
    });
}

async function viewQuestTasks(questId, questTitle) {
    const result = await apiCall('list_quest_tasks', { quest_id: questId });
    if (!result.ok) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'quest-modal';
    
    let tasksHtml = '';
    result.data.forEach((task, index) => {
        tasksHtml += `
            <div class="quest-task">
                <div class="quest-task-info">
                    <div class="quest-task-title">${index + 1}. ${task.title}</div>
                    <div class="quest-task-points">${task.points} points</div>
                </div>
                <button class="btn btn-success quest-submit-btn" data-task-id="${task.id}" data-task-title="${task.title}" style="flex: 0 0 auto; padding: 8px 16px;">
                    Submit
                </button>
            </div>
        `;
    });
    
    modal.innerHTML = `
        <div class="modal-content-kid">
            <h3 style="margin-bottom: 20px;">${questTitle} - Tasks</h3>
            ${tasksHtml}
            <button class="btn btn-primary modal-close-btn" style="width: 100%; margin-top: 20px;">Close</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Attach listeners to submit buttons
    modal.querySelectorAll('.quest-submit-btn').forEach(btn => {
        const taskId = btn.getAttribute('data-task-id');
        const taskTitle = btn.getAttribute('data-task-title');
        
        const handleSubmit = function(e) {
            e.preventDefault();
            e.stopPropagation();
            submitQuestTask(taskId, taskTitle);
        };
        
        btn.addEventListener('click', handleSubmit);
        btn.addEventListener('touchend', handleSubmit);
        btn.onclick = handleSubmit;
    });
    
    // Close button
    const closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) {
        const handleClose = function(e) {
            e.preventDefault();
            modal.remove();
        };
        
        closeBtn.addEventListener('click', handleClose);
        closeBtn.addEventListener('touchend', handleClose);
        closeBtn.onclick = handleClose;
    }
    
    // Close on backdrop
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.remove();
        }
    });
}

async function submitQuestTask(taskId, taskTitle) {
    const note = prompt(`Submit task: "${taskTitle}"\n\nAdd a note about your completion:`);
    if (note === null) return;
    
    const result = await apiCall('kid_submit_task', {
        task_id: taskId,
        note: note.trim()
    });
    
    if (result.ok) {
        showSuccess('Task submitted for review! ⏳');
        const modal = document.getElementById('quest-modal');
        if (modal) modal.remove();
        loadQuests();
    } else {
        showError(result.error);
    }
}

// Rewards
async function loadRewards() {
    const result = await apiCall('list_rewards');
    if (result.ok) {
        // Also get kid's pending redemptions from feed
        const feedResult = await apiCall('kid_feed');
        const pendingRedemptions = feedResult.ok ? 
            (feedResult.data.redemptions || []).filter(r => r.status === 'pending') : 
            [];
        
        renderRewards(result.data, pendingRedemptions);
    }
}

function renderRewards(rewards, pendingRedemptions = []) {
    if (!rewards || rewards.length === 0) {
        document.getElementById('rewards-list').innerHTML = `
            <div class="empty-state">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="8" r="7"></circle>
                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                </svg>
                <h3>No Rewards Available</h3>
                <p>Keep earning points!</p>
            </div>
        `;
        return;
    }
    
    const container = document.getElementById('rewards-list');
    container.innerHTML = '';
    
    rewards.forEach(reward => {
        const canAfford = currentKid.total_points >= reward.cost_points;
        const hasPendingRedemption = pendingRedemptions.some(r => r.reward_id === reward.id);
        
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="card-title">${reward.title}</div>
                    ${reward.description ? `<div class="card-description">${reward.description}</div>` : ''}
                </div>
                <div class="reward-cost ${!canAfford ? 'cannot-afford' : ''}">
                    ⭐ ${reward.cost_points}
                </div>
            </div>
            
            ${hasPendingRedemption ? `
                <div class="card-meta" style="margin-top: 10px;">
                    <span class="badge badge-warning">⏳ Pending Approval</span>
                </div>
            ` : ''}
            
            <div class="card-actions" style="margin-top: 15px;">
                ${hasPendingRedemption ? `
                    <button class="btn btn-disabled" disabled>
                        ⏳ Awaiting Approval
                    </button>
                ` : canAfford ? `
                    <button class="btn btn-primary reward-redeem-btn">
                        Redeem
                    </button>
                ` : `
                    <button class="btn btn-disabled" disabled>
                        Need ${reward.cost_points - currentKid.total_points} more points
                    </button>
                `}
            </div>
        `;
        
        container.appendChild(card);
        
        if (canAfford && !hasPendingRedemption) {
            const button = card.querySelector('.reward-redeem-btn');
            if (button) {
                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    button.disabled = true;
                    button.textContent = 'Requesting...';
                    redeemReward(reward.id, reward.title, reward.cost_points);
                }, { once: true });
            }
        }
    });
}

async function redeemReward(rewardId, rewardTitle, cost) {
    const result = await apiCall('kid_redeem_reward', { reward_id: rewardId });
    
    if (result.ok) {
        alert('Redemption requested! Waiting for approval. 🎁');
        await loadFeed();
        await loadRewards();
    } else {
        alert('Error: ' + result.error);
    }
}

// History
async function loadHistory() {
    const result = await apiCall('kid_feed');
    if (result.ok) {
        renderHistory(result.data.submissions || []);
    }
}

function renderHistory(submissions) {
    if (!submissions || submissions.length === 0) {
        document.getElementById('history-list').innerHTML = `
            <div class="empty-state">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <h3>No History Yet</h3>
                <p>Complete chores to see your history!</p>
            </div>
        `;
        return;
    }
    
    const html = submissions.map(sub => `
        <div class="card">
            <div class="history-date">${formatDate(sub.submitted_at)}</div>
            <div class="card-title">${sub.chore_title}</div>
            ${sub.note ? `<div class="card-description">"${sub.note}"</div>` : ''}
            <div class="card-meta" style="margin-top: 10px;">
                <span class="badge badge-${sub.status}">${sub.status.toUpperCase()}</span>
                ${sub.status === 'approved' ? `<span class="badge badge-primary">+${sub.points_awarded} points</span>` : ''}
            </div>
        </div>
    `).join('');
    
    document.getElementById('history-list').innerHTML = html;
}

// Confetti effect
function triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const confetti = [];
    const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#7C3AED'];
    
    for (let i = 0; i < 100; i++) {
        confetti.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 8 + 4,
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 2 - 1,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 10 - 5
        });
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        confetti.forEach((piece, index) => {
            ctx.save();
            ctx.translate(piece.x, piece.y);
            ctx.rotate((piece.rotation * Math.PI) / 180);
            ctx.fillStyle = piece.color;
            ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
            ctx.restore();
            
            piece.y += piece.speedY;
            piece.x += piece.speedX;
            piece.rotation += piece.rotationSpeed;
            
            if (piece.y > canvas.height) {
                confetti.splice(index, 1);
            }
        });
        
        if (confetti.length > 0) {
            requestAnimationFrame(animate);
        }
    }
    
    animate();
}

// Polling
function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
        loadFeed();
    }, 25000);
}

// Refresh button
document.getElementById('refresh-btn').addEventListener('click', async function(e) {
    e.preventDefault();
    console.log('Refresh clicked');
    const button = document.getElementById('refresh-btn');
    
    // Visual feedback
    button.style.transform = 'rotate(360deg)';
    button.style.transition = 'transform 0.5s';
    
    setTimeout(() => {
        button.style.transform = 'rotate(0deg)';
    }, 500);
    
    // Reload everything
    await loadFeed();
    const currentView = document.querySelector('.nav-btn.active')?.dataset.view;
    if (currentView) {
        await loadViewData(currentView);
    }
});

// Settings Management
function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
    
    // Apply saved settings to CSS variables
    if (settings.nameColor) {
        document.documentElement.style.setProperty('--name-color', settings.nameColor);
        const colorInput = document.getElementById('name-color');
        if (colorInput) colorInput.value = settings.nameColor;
    }
    
    if (settings.nameFont) {
        document.documentElement.style.setProperty('--name-font', getFontFamily(settings.nameFont));
        const fontInput = document.getElementById('name-font');
        if (fontInput) fontInput.value = settings.nameFont;
        
        // Select active font option
        const fontOption = document.querySelector(`.font-option[data-font="${settings.nameFont}"]`);
        if (fontOption) {
            document.querySelectorAll('.font-option').forEach(o => o.classList.remove('active'));
            fontOption.classList.add('active');
        }
    }
    
    if (settings.nameSize) {
        document.documentElement.style.setProperty('--name-size', settings.nameSize + 'px');
        const sizeInput = document.getElementById('name-size');
        const sizeValue = document.getElementById('name-size-value');
        if (sizeInput) sizeInput.value = settings.nameSize;
        if (sizeValue) sizeValue.textContent = settings.nameSize + 'px';
    }
    
    // ALSO apply directly to header name
    const nameEl = document.getElementById('kid-name');
    if (nameEl && currentKid) {
        if (settings.nameSize) nameEl.style.fontSize = settings.nameSize + 'px';
        if (settings.nameColor) nameEl.style.color = settings.nameColor;
        if (settings.nameFont) nameEl.style.fontFamily = getFontFamily(settings.nameFont);
    }
    
    if (settings.avatarType) {
        applyAvatar(settings.avatarType, settings.avatarColor);
    }
    
    updatePreview();
}

function getFontFamily(fontType) {
    const fonts = {
        'default': '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        'comic': '"Comic Neue", "Comic Sans MS", "Chalkboard SE", cursive, sans-serif',
        'playful': '"Baloo 2", "Quicksand", "Trebuchet MS", sans-serif',
        'bold': '"Fredoka", "Arial Black", sans-serif',
        'elegant': '"Playfair Display", "Georgia", serif',
        'bubbly': '"Chewy", "Snell Roundhand", "Bradley Hand", cursive, sans-serif',
        'techno': '"Orbitron", "Courier New", monospace',
        'fancy': '"Dancing Script", "Brush Script MT", cursive',
        'chunky': '"Luckiest Guy", "Impact", sans-serif',
        'retro': '"Press Start 2P", "American Typewriter", monospace',
        'marker': '"Permanent Marker", "Marker Felt", cursive'
    };
    return fonts[fontType] || fonts.default;
}


function saveSettings() {
    const settings = {
        nameColor: document.getElementById('name-color').value,
        nameFont: document.getElementById('name-font').value,
        nameSize: parseInt(document.getElementById('name-size').value),
        avatarType: document.querySelector('.avatar-type-option.active')?.dataset.avatar,
        avatarBorderColor: document.getElementById('avatar-border-color').value
    };
    
    localStorage.setItem('kid_settings', JSON.stringify(settings));
    
    // Apply settings via CSS variables
    document.documentElement.style.setProperty('--name-color', settings.nameColor);
    document.documentElement.style.setProperty('--name-font', getFontFamily(settings.nameFont));
    document.documentElement.style.setProperty('--name-size', settings.nameSize + 'px');
    
    // Also apply directly to name element
    const nameEl = document.getElementById('kid-name');
    if (nameEl) {
        nameEl.style.fontSize = settings.nameSize + 'px';
        nameEl.style.color = settings.nameColor;
        nameEl.style.fontFamily = getFontFamily(settings.nameFont);
    }
    
    applyAvatar(settings.avatarType, settings.avatarBorderColor);
    updateHeader();
    updatePreview();
    
    alert('Settings saved! ✨');
}

// Make it globally accessible for onclick
window.saveSettings = saveSettings;

function applyAvatar(type, borderColor) {
    const avatar = document.getElementById('kid-avatar');
    if (!avatar || !currentKid) return;
    
    const color = borderColor || '#4F46E5';
    avatar.style.border = `3px solid ${color}`;
    avatar.style.background = 'white';
    
    if (type === 'logo') {
        avatar.innerHTML = `<img src="/assets/kid-icon-192.png" alt="${currentKid.kid_name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else if (type === 'photo') {
        const photoData = localStorage.getItem('kid_avatar_photo');
        if (photoData) {
            avatar.innerHTML = `<img src="${photoData}" alt="${currentKid.kid_name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            // No photo available - fallback to initial
            const initial = currentKid.kid_name?.[0] || 'K';
            avatar.style.color = color;
            avatar.style.fontSize = '20px';
            avatar.style.fontWeight = 'bold';
            avatar.textContent = initial;
        }
    } else {
        // Initial (default)
        const initial = currentKid.kid_name?.[0] || 'K';
        avatar.style.color = color;
        avatar.style.fontSize = '20px';
        avatar.style.fontWeight = 'bold';
        avatar.textContent = initial;
    }
}

// Photo Avatar Handling
function initPhotoAvatar() {
    const photoOption = document.getElementById('photo-avatar-option');
    const photoInput = document.getElementById('avatar-photo-input');
    
    if (photoOption && photoInput) {
        photoOption.addEventListener('click', () => {
            photoInput.click();
        });
        
        photoInput.addEventListener('change', handlePhotoUpload);
    }
}

function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file!');
        return;
    }
    
    // Read and process the image
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Create a simple crop interface
            showCropModal(img);
        };
        img.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
}

function showCropModal(img) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '10000';
    
    modal.innerHTML = `
        <div class="modal-content-kid" style="max-width: 500px;">
            <h3 style="margin-bottom: 20px;">Adjust Your Photo 📸</h3>
            
            <div style="text-align: center; margin-bottom: 20px;">
                <canvas id="crop-canvas" style="max-width: 100%; border: 3px solid #4F46E5; border-radius: 12px; cursor: move;"></canvas>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Zoom:</label>
                <input type="range" id="zoom-slider" min="100" max="300" value="100" style="width: 100%;">
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="flex: 1;">Cancel</button>
                <button class="btn btn-primary" id="save-photo-btn" style="flex: 1;">Save Photo ✨</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup canvas
    const canvas = document.getElementById('crop-canvas');
    const ctx = canvas.getContext('2d');
    const size = 300; // Fixed square size
    canvas.width = size;
    canvas.height = size;
    
    let zoom = 1;
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    
    function drawImage() {
        ctx.clearRect(0, 0, size, size);
        
        // Calculate scaled dimensions
        const scaledWidth = img.width * zoom;
        const scaledHeight = img.height * zoom;
        
        // Center the image initially
        const x = (size - scaledWidth) / 2 + offsetX;
        const y = (size - scaledHeight) / 2 + offsetY;
        
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        
        // Draw circle overlay to show crop area
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }
    
    // Initial draw - auto-fit to circle
    const scale = Math.max(size / img.width, size / img.height);
    zoom = scale;
    drawImage();
    
    // Zoom slider
    document.getElementById('zoom-slider').addEventListener('input', (e) => {
        zoom = e.target.value / 100;
        drawImage();
    });
    
    // Drag to reposition
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.offsetX - offsetX;
        startY = e.offsetY - offsetY;
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            offsetX = e.offsetX - startX;
            offsetY = e.offsetY - startY;
            drawImage();
        }
    });
    
    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
    });
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isDragging = true;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        startX = touch.clientX - rect.left - offsetX;
        startY = touch.clientY - rect.top - offsetY;
    });
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (isDragging) {
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            offsetX = touch.clientX - rect.left - startX;
            offsetY = touch.clientY - rect.top - startY;
            drawImage();
        }
    });
    
    canvas.addEventListener('touchend', () => {
        isDragging = false;
    });
    
    // Save button
document.getElementById('save-photo-btn').addEventListener('click', async () => {
    // ... existing canvas code ...
    
    const photoData = finalCanvas.toDataURL('image/jpeg', 0.8);
    
    // Save to server
    const result = await apiCall('upload_kid_avatar', { photo_data: photoData });
    
    if (result.ok) {
        // Also save to localStorage as backup
        localStorage.setItem('kid_avatar_photo', photoData);
        
        // Update displays
        const photoOption = document.getElementById('photo-avatar-option');
        if (photoOption) {
            const photoCircle = photoOption.querySelector('div');
            photoCircle.innerHTML = `<img src="${photoData}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        }
        
        document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('active'));
        if (photoOption) photoOption.classList.add('active');
        
        updatePreview();
        modal.remove();
        alert('Photo saved! Click "Save Changes" to keep it. 📸');
    } else {
        alert('Error saving photo: ' + result.error);
    }
});
}

async function loadPhotoAvatar() {
    // Try to load from server first
    const result = await apiCall('get_kid_avatar');
    let photoData = null;
    
    if (result.ok && result.data.photo_data) {
        photoData = result.data.photo_data;
        // Save to localStorage as cache
        localStorage.setItem('kid_avatar_photo', photoData);
    } else {
        // Fallback to localStorage
        photoData = localStorage.getItem('kid_avatar_photo');
    }
    
    if (photoData) {
        const photoOption = document.getElementById('photo-avatar-option');
        if (photoOption) {
            const photoCircle = photoOption.querySelector('div');
            photoCircle.innerHTML = `<img src="${photoData}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        }
    }
}

function updatePreview() {
    console.log('=== updatePreview START ===');
    
    const previewName = document.getElementById('preview-name');
    const previewAvatar = document.getElementById('preview-avatar');
    
    if (!previewName || !previewAvatar || !currentKid) {
        console.log('STOPPING - missing elements or no kid data');
        return;
    }
    
    previewName.textContent = currentKid.kid_name;
    
    // Get current settings
    const nameColor = document.getElementById('name-color');
    const nameSize = document.getElementById('name-size');
    const nameFont = document.getElementById('name-font');
    const avatarBorderColor = document.getElementById('avatar-border-color');
    
    // Apply name styles
    if (nameColor) {
        previewName.style.color = nameColor.value;
    }
    if (nameSize) {
        previewName.style.fontSize = nameSize.value + 'px';
    }
    if (nameFont) {
        previewName.style.fontFamily = getFontFamily(nameFont.value);
    }
    
    // Apply avatar border
    const borderColor = avatarBorderColor ? avatarBorderColor.value : '#4F46E5';
    previewAvatar.style.border = `3px solid ${borderColor}`;
    previewAvatar.style.background = 'white';
    
    // Apply avatar type
    const activeAvatarType = document.querySelector('.avatar-type-option.active');
    const avatarType = activeAvatarType ? activeAvatarType.dataset.avatar : 'logo';
    
    if (avatarType === 'logo') {
        previewAvatar.innerHTML = `<img src="/assets/kid-icon-192.png" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else if (avatarType === 'photo') {
        const photoData = localStorage.getItem('kid_avatar_photo');
        if (photoData) {
            previewAvatar.innerHTML = `<img src="${photoData}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            previewAvatar.style.color = borderColor;
            previewAvatar.style.fontSize = '24px';
            previewAvatar.style.fontWeight = 'bold';
            previewAvatar.textContent = currentKid.kid_name?.[0] || 'A';
        }
    } else {
        // Initial
        previewAvatar.style.color = borderColor;
        previewAvatar.style.fontSize = '24px';
        previewAvatar.style.fontWeight = 'bold';
        previewAvatar.textContent = currentKid.kid_name?.[0] || 'A';
    }
    
    console.log('=== updatePreview END ===');
}

function attachSettingsListeners() {
    const nameSize = document.getElementById('name-size');
    const nameColor = document.getElementById('name-color');
    const nameFont = document.getElementById('name-font');
    
    // Custom font picker with debug
    const fontOptions = document.querySelectorAll('.font-option');
    console.log('Found font options:', fontOptions.length);
    
    fontOptions.forEach((option, index) => {
        console.log(`Attaching listener to font option ${index}:`, option.dataset.font);
        
        option.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Font option clicked:', option.dataset.font);
            
            document.querySelectorAll('.font-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            
            if (nameFont) {
                nameFont.value = option.dataset.font;
                console.log('Hidden input updated to:', nameFont.value);
            }
            
            console.log('Calling updatePreview...');
            updatePreview();
        });
    });
    
    if (nameSize) {
        nameSize.addEventListener('input', (e) => {
            const sizeValue = document.getElementById('name-size-value');
            if (sizeValue) {
                sizeValue.textContent = e.target.value + 'px';
            }
            updatePreview();
        });
    }
    
    if (nameColor) {
        nameColor.addEventListener('input', updatePreview);
    }
    
    // Avatar options
    document.querySelectorAll('.avatar-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            updatePreview();
        });
    });
    document.querySelectorAll('.avatar-type-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.avatar-type-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            updatePreview();
        });
    });
    
    // Avatar border color
    const avatarBorderColor = document.getElementById('avatar-border-color');
    if (avatarBorderColor) {
        avatarBorderColor.addEventListener('input', updatePreview);
    }
    // Initialize photo avatar
    initPhotoAvatar();
    loadPhotoAvatar();
}

// Initialize
checkPairing();