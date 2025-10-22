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
    setTimeout(async () => {
        // ✅ Load settings from server first
        await loadSettingsFromServer();
        
        updateHeader();
        loadFeed();
        loadSettings();
        attachSettingsListeners();
        
        // Apply theme after everything loads
        const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
        if (settings.themeName && themes[settings.themeName]) {
            console.log('🎨 Applying theme on app start:', settings.themeName);
            setTimeout(() => {
                applyThemeStyling(themes[settings.themeName]);
            }, 200);
        }        
        
        // Initialize avatar selector AFTER settings are loaded
        console.log('🎯 Calling initAvatarSelector from showAppScreen...');
        initAvatarSelector();
        
        // Initialize border style selector
        console.log('🎨 Calling initBorderStyleSelector from showAppScreen...');
        initBorderStyleSelector();
        
        // Initialize theme selector
        console.log('🎨 Calling initThemeSelector from showAppScreen...');
        initThemeSelector();
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
            applyAvatar(settings.avatarType, settings.avatarBorderColor);
        } else {
            // Default: use logo
            avatar.innerHTML = `<img src="/assets/kid-icon-192.png" alt="${currentKid.kid_name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            // Apply border even for default
            applyBorderToHeader();
        }
        
        // Apply saved name styles
        if (nameEl) {
            if (settings.nameSize) nameEl.style.fontSize = settings.nameSize + 'px';
            if (settings.nameColor) nameEl.style.color = settings.nameColor;
            if (settings.nameFont) nameEl.style.fontFamily = getFontFamily(settings.nameFont);
        }
    }
    
    // Apply saved theme styling to header
    const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
    if (settings.themeName && themes[settings.themeName]) {
        applyThemeStyling(themes[settings.themeName]);
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
    // Reapply theme when switching views
    setTimeout(() => {
        const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
        if (settings.themeName && themes[settings.themeName]) {
            console.log('🎨 Reapplying theme after view switch');
            applyThemeStyling(themes[settings.themeName]);
        }
    }, 150);
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
    
    // Load saved border style
    if (settings.borderStyle && settings.borderWidth) {
        selectedBorderStyle = settings.borderStyle;
        selectedBorderWidth = settings.borderWidth;
        applyBorderToHeader();
    }
    
    updatePreview();
    
    // ✨ NEW CODE: Apply theme styling after everything loads
    if (settings.themeName && themes[settings.themeName]) {
        console.log('🎨 Loading saved theme:', settings.themeName);
        applyThemeStyling(themes[settings.themeName]);
    } else if (settings.bgGradient || settings.bgColor) {
        console.log('🎨 Loading custom theme styling');
        applyThemeStyling(settings);
    }
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
    
    // Preserve existing settings we don't want to overwrite
    const existingSettings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
    
    if (existingSettings.avatarIcon) {
        settings.avatarIcon = existingSettings.avatarIcon;
    }
    
    // Preserve border style settings
    if (existingSettings.borderStyle) {
        settings.borderStyle = existingSettings.borderStyle;
        settings.borderWidth = existingSettings.borderWidth;
    }
    
    // ✅ Preserve theme settings
    if (existingSettings.themeName) {
        settings.themeName = existingSettings.themeName;
        settings.bgGradient = existingSettings.bgGradient;
        settings.bgColor = existingSettings.bgColor;
        settings.cardBg = existingSettings.cardBg;
        settings.accentColor = existingSettings.accentColor;
        settings.buttonColor = existingSettings.buttonColor;
        settings.textColor = existingSettings.textColor;
    }
    
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
    
    // NOW apply the border to header (reads from localStorage which has the new border)
    console.log('💾 Saving - now applying border to header...');
    applyBorderToHeader();
    
    updatePreview();
    
    // ✅ Reapply theme styling after saving
    if (settings.themeName && themes[settings.themeName]) {
        applyThemeStyling(themes[settings.themeName]);
    }
    
    // ✅ Save to server
    saveSettingsToServer(settings);
    
    alert('Settings saved! ✨');
}

// Make it globally accessible for onclick
window.saveSettings = saveSettings;

function applyAvatar(type, borderColor) {
    const avatar = document.getElementById('kid-avatar');
    if (!avatar || !currentKid) return;
    
    const color = borderColor || '#4F46E5';
    
    // Don't set border here - let applyBorderToHeader handle it
    avatar.style.background = 'white';
    
    if (type === 'logo') {
        // Check if we have a saved custom icon
        const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
        if (settings.avatarIcon) {
            avatar.innerHTML = `<img src="${settings.avatarIcon}" alt="${currentKid.kid_name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            avatar.innerHTML = `<img src="/assets/kid-icon-192.png" alt="${currentKid.kid_name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        }
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
//function initPhotoAvatar() {
//    const photoOption = document.getElementById('photo-avatar-option');
//    const photoInput = document.getElementById('avatar-photo-input');
//    
//    if (photoOption && photoInput) {
//        photoOption.addEventListener('click', () => {
//            photoInput.click();
//        });
//        
//        photoInput.addEventListener('change', handlePhotoUpload);
//    }
//}

// function handlePhotoUpload(event) {
//     const file = event.target.files[0];
//     if (!file) return;
//     
    // Check file type
    // if (!file.type.startsWith('image/')) {
       //  alert('Please select an image file!');
        // return;
    // }
    
    // NO SIZE LIMIT - we're cropping it down anyway!
    // console.log('📸 Photo selected:', file.name, 'Size:', Math.round(file.size / 1024) + 'KB');
    
    // Read and process the image
    // const reader = new FileReader();
    // reader.onload = function(e) {
        // const img = new Image();
        // img.onload = function() {
            // console.log('🖼️ Photo loaded, dimensions:', img.width, 'x', img.height);
            // Create a simple crop interface
            // showCropModal(img);
        // };
        // img.src = e.target.result;
    // };
    
    // reader.readAsDataURL(file);
// }

// function showCropModal(img) {
    // Create modal
    // const modal = document.createElement('div');
    // modal.className = 'modal-overlay';
    // modal.style.zIndex = '10000';
    
    // modal.innerHTML = `
        // <div class="modal-content-kid" style="max-width: 500px;">
            // <h3 style="margin-bottom: 20px;">Adjust Your Photo 📸</h3>
            
            // <div style="text-align: center; margin-bottom: 20px;">
                // <canvas id="crop-canvas" style="max-width: 100%; border: 3px solid #4F46E5; border-radius: 12px; cursor: move;"></canvas>
            // </div>
            
            // <div style="margin-bottom: 20px;">
                // <label style="display: block; margin-bottom: 8px; font-weight: 600;">Zoom:</label>
                // <input type="range" id="zoom-slider" min="50" max="200" value="100" style="width: 100%;">
            // </div>
            
            // <div style="display: flex; gap: 10px;">
                // <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="flex: 1;">Cancel</button>
                // <button class="btn btn-primary" id="save-photo-btn" style="flex: 1;">Save Photo ✨</button>
            // </div>
        // </div>
    // `;
    
    // document.body.appendChild(modal);
    
    // Setup canvas
    // const canvas = document.getElementById('crop-canvas');
    // const ctx = canvas.getContext('2d');
    // const size = 300; // Fixed square size
    // canvas.width = size;
    // canvas.height = size;
    
    // Calculate initial scale to fit image nicely
    // const initialScale = Math.max(size / img.width, size / img.height);
    // let zoom = initialScale;
    // let offsetX = 0;
    // let offsetY = 0;
    // let isDragging = false;
    // let startX = 0;
    // let startY = 0;
    
    // function drawImage() {
        // ctx.clearRect(0, 0, size, size);
        
        // Calculate scaled dimensions
        // const scaledWidth = img.width * zoom;
        // const scaledHeight = img.height * zoom;
        
        // Center the image
        // const x = (size - scaledWidth) / 2 + offsetX;
        // const y = (size - scaledHeight) / 2 + offsetY;
        
        // ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
    // }
    
    // Initial draw
    // drawImage();
    
    // Zoom slider - FIX: Convert slider value to proper zoom scale
    // const zoomSlider = document.getElementById('zoom-slider');
    // zoomSlider.value = 100; // Start at 100%
    
    // zoomSlider.addEventListener('input', (e) => {
        // const sliderValue = parseInt(e.target.value);
        // Convert slider value (50-200) to zoom scale relative to initial fit
        // zoom = initialScale * (sliderValue / 100);
        // drawImage();
    // });
    
    // Mouse drag to reposition
    // canvas.addEventListener('mousedown', (e) => {
        // isDragging = true;
        // const rect = canvas.getBoundingClientRect();
        // startX = e.clientX - rect.left - offsetX;
        // startY = e.clientY - rect.top - offsetY;
    // });
    
    // canvas.addEventListener('mousemove', (e) => {
        // if (isDragging) {
            // const rect = canvas.getBoundingClientRect();
            // offsetX = e.clientX - rect.left - startX;
            // offsetY = e.clientY - rect.top - startY;
            // drawImage();
        // }
    // });
    
    // canvas.addEventListener('mouseup', () => {
        // isDragging = false;
    // });
    
    // canvas.addEventListener('mouseleave', () => {
        // isDragging = false;
    // });
    
    // Touch drag for mobile
    // canvas.addEventListener('touchstart', (e) => {
        // e.preventDefault();
        // isDragging = true;
        // const touch = e.touches[0];
        // const rect = canvas.getBoundingClientRect();
        // startX = touch.clientX - rect.left - offsetX;
        // startY = touch.clientY - rect.top - offsetY;
    // });
    
    // canvas.addEventListener('touchmove', (e) => {
        // e.preventDefault();
        // if (isDragging) {
            // const touch = e.touches[0];
            // const rect = canvas.getBoundingClientRect();
            // offsetX = touch.clientX - rect.left - startX;
            // offsetY = touch.clientY - rect.top - startY;
            // drawImage();
        // }
    // });
    
    // canvas.addEventListener('touchend', () => {
        // isDragging = false;
    // });
    
    // Save button - FIX: Create finalCanvas properly
    // document.getElementById('save-photo-btn').addEventListener('click', async () => {
        // Create a final canvas for the cropped result
        // const finalCanvas = document.createElement('canvas');
        // finalCanvas.width = 200;
        // finalCanvas.height = 200;
        // const finalCtx = finalCanvas.getContext('2d');
        
        // Draw the current canvas state to the final canvas (scaled down to 200x200)
        // finalCtx.drawImage(canvas, 0, 0, size, size, 0, 0, 200, 200);
        
        // const photoData = finalCanvas.toDataURL('image/jpeg', 0.8);
        
        // Save to server
        // const result = await apiCall('upload_kid_avatar', { photo_data: photoData });
        
        // if (result.ok) {
            // Also save to localStorage as backup
            // localStorage.setItem('kid_avatar_photo', photoData);
            
            // Update displays
            // const photoOption = document.getElementById('photo-avatar-option');
            // if (photoOption) {
                // const photoCircle = photoOption.querySelector('div');
                // photoCircle.innerHTML = `<img src="${photoData}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            // }
            
            // document.querySelectorAll('.avatar-type-option').forEach(o => o.classList.remove('active'));
            // if (photoOption) photoOption.classList.add('active');
            
            // updatePreview();
            // modal.remove();
            // alert('Photo saved! Click "Save Changes" to keep it. 📸');
        // } else {
           //  alert('Error saving photo: ' + result.error);
        // }
    // });
// }

// async function loadPhotoAvatar() {
    // Try to load from server first
    // const result = await apiCall('get_kid_avatar');
    // let photoData = null;
    
    // if (result.ok && result.data.photo_data) {
        // photoData = result.data.photo_data;
        // Save to localStorage as cache
        // localStorage.setItem('kid_avatar_photo', photoData);
    // } else {
        // Fallback to localStorage
        // photoData = localStorage.getItem('kid_avatar_photo');
    // }
    
    // if (photoData) {
        // const photoOption = document.getElementById('photo-avatar-option');
        // if (photoOption) {
            // const photoCircle = photoOption.querySelector('div');
            // photoCircle.innerHTML = `<img src="${photoData}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        // }
    // }
// }

function updatePreview() {
    console.log('=== updatePreview START ===');
    
    const previewName = document.getElementById('preview-name');
    const previewAvatar = document.getElementById('preview-avatar');
    
    if (!previewName || !previewAvatar || !currentKid) {
        console.log('STOPPING - missing elements or no kid data');
        return;
    }
    
    // Update name text
    previewName.textContent = currentKid.kid_name;
    
    // Get current settings from inputs
    const nameColor = document.getElementById('name-color')?.value || '#1F2937';
    const nameSize = document.getElementById('name-size')?.value || '18';
    const nameFont = document.getElementById('name-font')?.value || 'default';
    const avatarBorderColor = document.getElementById('avatar-border-color')?.value || '#4F46E5';
    
    console.log('Settings:', { nameColor, nameSize, nameFont, avatarBorderColor });
    
    // Apply name styles DIRECTLY with !important
    previewName.style.setProperty('color', nameColor, 'important');
    previewName.style.setProperty('font-size', nameSize + 'px', 'important');
    previewName.style.setProperty('font-family', getFontFamily(nameFont), 'important');
    
    console.log('Applied to preview name:', {
        color: nameColor,
        size: nameSize + 'px',
        font: getFontFamily(nameFont)
    });
        
    // Apply avatar type
    const activeAvatarType = document.querySelector('.avatar-type-option.active');
    const avatarType = activeAvatarType ? activeAvatarType.dataset.avatar : 'logo';
    
    console.log('Avatar type:', avatarType);
    
    if (avatarType === 'logo') {
        // Check if we have a saved custom icon
        const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
        if (settings.avatarIcon) {
            previewAvatar.innerHTML = `<img src="${settings.avatarIcon}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            previewAvatar.innerHTML = `<img src="/assets/kid-icon-192.png" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        }
    } else if (avatarType === 'photo') {
        const photoData = localStorage.getItem('kid_avatar_photo');
        if (photoData) {
            previewAvatar.innerHTML = `<img src="${photoData}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            previewAvatar.style.color = avatarBorderColor;
            previewAvatar.style.fontSize = '20px';
            previewAvatar.style.fontWeight = 'bold';
            previewAvatar.textContent = currentKid.kid_name?.[0] || 'A';
        }
    } else {
        // Initial
        previewAvatar.style.color = avatarBorderColor;
        previewAvatar.style.fontSize = '20px';
        previewAvatar.style.fontWeight = 'bold';
        previewAvatar.textContent = currentKid.kid_name?.[0] || 'A';
    }
    
    // Apply saved border style to preview
    const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
    const borderStyle = settings.borderStyle || 'solid';
    const borderWidth = settings.borderWidth || 3;
    
    console.log('🎨 Applying border to preview:', borderStyle, borderWidth);
    
    // Clear previous border styles
    previewAvatar.style.border = '';
    previewAvatar.style.boxShadow = '';
    previewAvatar.style.padding = '';
    
    // Ensure base styles
    previewAvatar.style.borderRadius = '50%';
    previewAvatar.style.overflow = 'hidden';
    
    // Apply the border style
    switch(borderStyle) {
        case 'solid':
            previewAvatar.style.border = `${borderWidth}px solid ${avatarBorderColor}`;
            break;
        case 'dashed':
            previewAvatar.style.border = `${borderWidth}px dashed ${avatarBorderColor}`;
            break;
        case 'dotted':
            previewAvatar.style.border = `${borderWidth}px dotted ${avatarBorderColor}`;
            break;
        case 'double':
            previewAvatar.style.border = `${borderWidth}px double ${avatarBorderColor}`;
            break;
        case 'glow':
            previewAvatar.style.border = `${borderWidth}px solid ${avatarBorderColor}`;
            previewAvatar.style.boxShadow = `0 0 15px ${avatarBorderColor}99`;
            break;
        case 'gradient':
            previewAvatar.style.background = 'linear-gradient(45deg, #FF6B6B, #4ECDC4, #45B7D1, #FFA07A)';
            previewAvatar.style.padding = `${borderWidth}px`;
            const innerImg = previewAvatar.querySelector('img');
            if (innerImg) {
                innerImg.style.background = 'white';
                innerImg.style.borderRadius = '50%';
            }
            break;
        case 'neon':
            previewAvatar.style.border = `${borderWidth}px solid #00FF88`;
            previewAvatar.style.boxShadow = `0 0 20px rgba(0, 255, 136, 0.8), inset 0 0 10px rgba(0, 255, 136, 0.3)`;
            break;
    }
    
    console.log('=== updatePreview END ===');
}

// Avatar Selector System
let selectedAvatarUrl = null;
let currentFilter = 'all';
let avatarsData = { default: [], user: [], canUploadMore: true };

async function openAvatarSelector() {
    console.log('🚪 openAvatarSelector() called!');
    const modal = document.getElementById('icon-selector-modal');
    console.log('📍 Modal element:', modal);
    
    if (modal) {
        console.log('✅ Modal found, displaying...');
        modal.style.display = 'flex';
        console.log('📊 Modal display set to:', modal.style.display);
        
        // Load avatars from server
        console.log('📥 Loading avatars from server...');
        await loadAvatars();
        
        // Load saved avatar
        const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
        selectedAvatarUrl = settings.avatarIcon || null;
        console.log('💾 Loaded saved avatar:', selectedAvatarUrl);
    } else {
        console.error('❌ Modal element NOT FOUND!');
    }
}

async function loadAvatars() {
    try {
        const result = await apiCall('list_avatars');
        if (result.ok) {
            avatarsData = result.data;
            renderAvatarGrid();
            
            // Show/hide upload button
            const uploadSection = document.getElementById('upload-section');
            if (uploadSection) {
                uploadSection.style.display = avatarsData.canUploadMore ? 'block' : 'none';
            }
        }
    } catch (error) {
        console.error('Failed to load avatars:', error);
    }
}

function renderAvatarGrid() {
    const grid = document.getElementById('avatar-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    let avatarsToShow = [];
    
    if (currentFilter === 'all' || currentFilter === 'default') {
        avatarsToShow = avatarsToShow.concat(avatarsData.default);
    }
    
    if (currentFilter === 'all' || currentFilter === 'user') {
        avatarsToShow = avatarsToShow.concat(avatarsData.user);
    }
    
    avatarsToShow.forEach(avatar => {
        const div = document.createElement('div');
        div.className = 'avatar-choice';
        div.dataset.url = avatar.url;
        div.dataset.type = avatar.type;
        div.dataset.filename = avatar.filename;
        
        const isActive = selectedAvatarUrl === avatar.url;
        
        div.style.cssText = `
            padding: 8px;
            border: 2px solid ${isActive ? '#4F46E5' : '#E5E7EB'};
            border-radius: 10px;
            cursor: pointer;
            text-align: center;
            background: ${isActive ? '#EEF2FF' : 'white'};
            position: relative;
            transition: all 0.2s;
        `;
        
        div.innerHTML = `
            <div style="width: 60px; height: 60px; margin: 0 auto; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 50%;">
                <img src="${avatar.url}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            ${avatar.type === 'user' ? `<button class="delete-avatar-btn" data-filename="${avatar.filename}" style="position: absolute; top: 2px; right: 2px; background: #EF4444; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center;">×</button>` : ''}
        `;
        
        div.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-avatar-btn')) {
                document.querySelectorAll('.avatar-choice').forEach(c => {
                    c.style.border = '2px solid #E5E7EB';
                    c.style.background = 'white';
                });
                div.style.border = '2px solid #4F46E5';
                div.style.background = '#EEF2FF';
                selectedAvatarUrl = avatar.url;
            }
        });
        
        grid.appendChild(div);
    });
    
    // Add delete button listeners
    document.querySelectorAll('.delete-avatar-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('Delete this photo?')) {
                await deleteUserAvatar(btn.dataset.filename);
            }
        });
    });
}

async function deleteUserAvatar(filename) {
    try {
        const result = await apiCall('delete_user_avatar', { filename });
        if (result.ok) {
            await loadAvatars();
        } else {
            alert('Failed to delete: ' + result.error);
        }
    } catch (error) {
        console.error('Delete failed:', error);
    }
}

function initAvatarSelector() {
    console.log('🚀 initAvatarSelector() called');
    
    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => {
                t.style.background = '#F3F4F6';
                t.style.color = '#6B7280';
            });
            tab.style.background = '#EEF2FF';
            tab.style.color = '#4F46E5';
            
            currentFilter = tab.id.replace('filter-', '');
            renderAvatarGrid();
        });
    });
    
    // Upload button
    const uploadBtn = document.getElementById('upload-avatar-btn');
    const uploadInput = document.getElementById('avatar-upload-input');
    
    if (uploadBtn && uploadInput) {
        uploadBtn.addEventListener('click', () => {
            uploadInput.click();
        });
        
        uploadInput.addEventListener('change', handleAvatarUpload);
    }
    
    // Select button
    const selectBtn = document.getElementById('select-avatar-btn');
    if (selectBtn) {
        selectBtn.addEventListener('click', () => {
            if (selectedAvatarUrl) {
                const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
                settings.avatarIcon = selectedAvatarUrl;
                settings.avatarType = 'logo';
                localStorage.setItem('kid_settings', JSON.stringify(settings));
                
                document.getElementById('icon-selector-modal').style.display = 'none';
                
                updatePreview();
                updateHeader();
            }
        });
    }
    
    // Cancel button
    const cancelBtn = document.getElementById('cancel-avatar-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            document.getElementById('icon-selector-modal').style.display = 'none';
        });
    }
    
    // **DEBUG**: Find and attach logo option click handler
    console.log('🔍 Looking for logo option...');
    const logoOption = document.querySelector('.avatar-type-option[data-avatar="logo"]');
    console.log('📍 Logo option found?', logoOption);
    
    if (logoOption) {
        console.log('✅ Logo option EXISTS, attaching click listener...');
        
        // REMOVE any existing listeners by cloning
        const newLogoOption = logoOption.cloneNode(true);
        logoOption.parentNode.replaceChild(newLogoOption, logoOption);
        
        newLogoOption.addEventListener('click', (e) => {
            console.log('🎯 LOGO CLICKED!!! Event:', e);
            console.log('🛑 Preventing default and propagation...');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            console.log('✨ Setting logo as active...');
            document.querySelectorAll('.avatar-type-option').forEach(o => o.classList.remove('active'));
            newLogoOption.classList.add('active');
            
            console.log('🚪 Opening avatar selector modal...');
            openAvatarSelector();
        }, true); // Use capture phase
        
        console.log('✅ Logo click listener attached!');
    } else {
        console.error('❌ Logo option NOT FOUND in DOM!');
    }
}

// Border Style System
let selectedBorderStyle = 'solid';
let selectedBorderWidth = 3;

function initBorderStyleSelector() {
    console.log('🎨 initBorderStyleSelector() called');
    
    // Border style option click handler
    const borderOption = document.querySelector('.avatar-type-option[data-avatar="border"]');
    if (borderOption) {
        console.log('✅ Border option found, attaching listener...');
        
        // Clone to remove any existing listeners
        const newBorderOption = borderOption.cloneNode(true);
        borderOption.parentNode.replaceChild(newBorderOption, borderOption);
        
        newBorderOption.addEventListener('click', (e) => {
            console.log('🎨 BORDER OPTION CLICKED!');
            e.preventDefault();
            e.stopPropagation();
            openBorderStyleModal();
        });
    }
    
    // Border style choices
    document.querySelectorAll('.border-style-choice').forEach(choice => {
        choice.addEventListener('click', () => {
            const style = choice.dataset.style;
            const width = choice.dataset.width;
            
            console.log('🎨 Border style selected:', style, 'width:', width);
            
            // Save the selection
            selectedBorderStyle = style;
            selectedBorderWidth = width;
            
            // Save to localStorage immediately
            const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
            settings.borderStyle = style;
            settings.borderWidth = width;
            localStorage.setItem('kid_settings', JSON.stringify(settings));
            
            // Close modal
            document.getElementById('border-style-modal').style.display = 'none';
            
            // Update preview to show the new border
            console.log('🔄 Calling updatePreview...');
            updatePreview();
        });
    });
    
    // Cancel button
    const cancelBtn = document.getElementById('cancel-border-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            document.getElementById('border-style-modal').style.display = 'none';
        });
    }
}

function openBorderStyleModal() {
    console.log('🎨 Opening border style modal...');
    const modal = document.getElementById('border-style-modal');
    if (modal) {
        modal.style.display = 'flex';
        console.log('✅ Border modal displayed');
    } else {
        console.error('❌ Border modal not found!');
    }
}

// Theme System
const themes = {
    ocean: {
        nameColor: '#0891B2',
        nameFont: 'bubbly',
        nameSize: 28,
        borderStyle: 'glow',
        borderWidth: 3,
        avatarBorderColor: '#06B6D4',
        // App styling
        bgGradient: 'linear-gradient(135deg, #667eea 0%, #06b6d4 100%)',
        bgColor: '#E0F2FE',
        cardBg: '#FFFFFF',
        accentColor: '#0891B2',
        buttonColor: '#0891B2'
    },
    sunset: {
        nameColor: '#F97316',
        nameFont: 'playful',
        nameSize: 26,
        borderStyle: 'gradient',
        borderWidth: 4,
        avatarBorderColor: '#F97316',
        // App styling
        bgGradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        bgColor: '#FFF7ED',
        cardBg: '#FFFFFF',
        accentColor: '#F97316',
        buttonColor: '#EA580C'
    },
    forest: {
        nameColor: '#16A34A',
        nameFont: 'bold',
        nameSize: 28,
        borderStyle: 'solid',
        borderWidth: 4,
        avatarBorderColor: '#22C55E',
        // App styling
        bgGradient: 'linear-gradient(135deg, #a8edea 0%, #16a34a 100%)',
        bgColor: '#F0FDF4',
        cardBg: '#FFFFFF',
        accentColor: '#16A34A',
        buttonColor: '#16A34A'
    },
    space: {
        nameColor: '#8B5CF6',
        nameFont: 'techno',
        nameSize: 25,
        borderStyle: 'neon',
        borderWidth: 3,
        avatarBorderColor: '#8B5CF6',
        // App styling
        bgGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        bgColor: '#F5F3FF',
        cardBg: '#FFFFFF',
        accentColor: '#8B5CF6',
        buttonColor: '#7C3AED'
    },
    candy: {
        nameColor: '#EC4899',
        nameFont: 'bubbly',
        nameSize: 27,
        borderStyle: 'solid',
        borderWidth: 3,
        avatarBorderColor: '#F9A8D4',
        // App styling
        bgGradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
        bgColor: '#FDF2F8',
        cardBg: '#FFFFFF',
        accentColor: '#EC4899',
        buttonColor: '#DB2777'
    },
    lava: {
        nameColor: '#DC2626',
        nameFont: 'chunky',
        nameSize: 29,
        borderStyle: 'glow',
        borderWidth: 4,
        avatarBorderColor: '#EF4444',
        // App styling
        bgGradient: 'linear-gradient(135deg, #ff6b6b 0%, #c92a2a 100%)',
        bgColor: '#FEF2F2',
        cardBg: '#FFFFFF',
        accentColor: '#DC2626',
        buttonColor: '#B91C1C'
    },
    mint: {
        nameColor: '#10B981',
        nameFont: 'elegant',
        nameSize: 24,
        borderStyle: 'dotted',
        borderWidth: 3,
        avatarBorderColor: '#6EE7B7',
        // App styling
        bgGradient: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
        bgColor: '#ECFDF5',
        cardBg: '#FFFFFF',
        accentColor: '#10B981',
        buttonColor: '#059669'
    },
    midnight: {
        nameColor: '#FBBF24',
        nameFont: 'fancy',
        nameSize: 26,
        borderStyle: 'glow',
        borderWidth: 3,
        avatarBorderColor: '#FBBF24',
        // App styling
        bgGradient: 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%)',
        bgColor: '#1E293B',
        cardBg: '#334155',
        accentColor: '#FBBF24',
        buttonColor: '#F59E0B',
        textColor: '#F1F5F9' // Light text for dark theme
    },
    rainbow: {
        nameColor: '#EC4899',
        nameFont: 'comic',
        nameSize: 28,
        borderStyle: 'gradient',
        borderWidth: 4,
        avatarBorderColor: '#EC4899',
        // App styling
        bgGradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 50%, #30cfd0 100%)',
        bgColor: '#FFFBEB',
        cardBg: '#FFFFFF',
        accentColor: '#EC4899',
        buttonColor: '#DB2777'
    },
    retro: {
        nameColor: '#F472B6',
        nameFont: 'retro',
        nameSize: 23,
        borderStyle: 'solid',
        borderWidth: 5,
        avatarBorderColor: '#F472B6',
        // App styling
        bgGradient: 'linear-gradient(135deg, #f857a6 0%, #ff5858 100%)',
        bgColor: '#FEF2F2',
        cardBg: '#FFFFFF',
        accentColor: '#F472B6',
        buttonColor: '#EC4899'
    },
    desert: {
        nameColor: '#D97706',
        nameFont: 'bold',
        nameSize: 27,
        borderStyle: 'double',
        borderWidth: 5,
        avatarBorderColor: '#F59E0B',
        // App styling
        bgGradient: 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)',
        bgColor: '#FFFBEB',
        cardBg: '#FFFFFF',
        accentColor: '#D97706',
        buttonColor: '#B45309'
    },
    arctic: {
        nameColor: '#0EA5E9',
        nameFont: 'default',
        nameSize: 26,
        borderStyle: 'glow',
        borderWidth: 3,
        avatarBorderColor: '#7DD3FC',
        // App styling
        bgGradient: 'linear-gradient(135deg, #e0f7fa 0%, #b3e5fc 100%)',
        bgColor: '#F0F9FF',
        cardBg: '#FFFFFF',
        accentColor: '#0EA5E9',
        buttonColor: '#0284C7'
    }
};

function initThemeSelector() {
    console.log('🎨 initThemeSelector() called');
    
    // Open theme modal button
    const openBtn = document.getElementById('open-theme-modal-btn');
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            console.log('🎨 Opening theme modal...');
            document.getElementById('theme-modal').style.display = 'flex';
        });
    }
    
    // Close theme modal button
    const closeBtn = document.getElementById('close-theme-modal-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('theme-modal').style.display = 'none';
        });
    }
    
    // Theme choices
    document.querySelectorAll('.theme-choice').forEach(choice => {
        choice.addEventListener('click', () => {
            const themeName = choice.dataset.theme;
            console.log('🎨 Theme selected:', themeName);
            
            applyTheme(themeName);
            
            // Visual feedback
            document.querySelectorAll('.theme-choice').forEach(c => {
                c.style.border = '2px solid #E5E7EB';
                c.style.background = 'white';
            });
            choice.style.border = '2px solid #4F46E5';
            choice.style.background = '#EEF2FF';
            
            // Close modal after selection
            setTimeout(() => {
                document.getElementById('theme-modal').style.display = 'none';
            }, 500);
        });
    });
}

function applyTheme(themeName) {
    const theme = themes[themeName];
    if (!theme) {
        console.error('Theme not found:', themeName);
        return;
    }
    
    console.log('✨ Applying theme:', themeName, theme);
    
    // Update form inputs
    const nameColorInput = document.getElementById('name-color');
    const nameFontInput = document.getElementById('name-font');
    const nameSizeInput = document.getElementById('name-size');
    const nameSizeValue = document.getElementById('name-size-value');
    const borderColorInput = document.getElementById('avatar-border-color');
    
    if (nameColorInput) nameColorInput.value = theme.nameColor;
    if (nameFontInput) nameFontInput.value = theme.nameFont;
    if (nameSizeInput) {
        nameSizeInput.value = theme.nameSize;
        if (nameSizeValue) nameSizeValue.textContent = theme.nameSize + 'px';
    }
    if (borderColorInput) borderColorInput.value = theme.avatarBorderColor;
    
    // Update active font option visually
    document.querySelectorAll('.font-option').forEach(o => o.classList.remove('active'));
    const fontOption = document.querySelector(`.font-option[data-font="${theme.nameFont}"]`);
    if (fontOption) fontOption.classList.add('active');
    
    // Save border style settings
    selectedBorderStyle = theme.borderStyle;
    selectedBorderWidth = theme.borderWidth;
    
    // Save all theme settings
    const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
    settings.nameColor = theme.nameColor;
    settings.nameFont = theme.nameFont;
    settings.nameSize = theme.nameSize;
    settings.avatarBorderColor = theme.avatarBorderColor;
    settings.borderStyle = theme.borderStyle;
    settings.borderWidth = theme.borderWidth;
    settings.themeName = themeName; // CRITICAL LINE
    settings.bgGradient = theme.bgGradient;
    settings.bgColor = theme.bgColor;
    settings.cardBg = theme.cardBg;
    settings.accentColor = theme.accentColor;
    settings.buttonColor = theme.buttonColor;
    settings.textColor = theme.textColor || '#1F2937';
    localStorage.setItem('kid_settings', JSON.stringify(settings));
    
    console.log('💾 Settings saved to localStorage:', settings);
    
    // Apply theme styling to app
    applyThemeStyling(theme);
    
    // Update preview immediately
    updatePreview();
    
    // ✅ Save to server
    console.log('📤 Now saving to server...');
    saveSettingsToServer(settings);
    
    console.log(`✅ ${themeName.charAt(0).toUpperCase() + themeName.slice(1)} theme applied!`);
}

function applyThemeStyling(theme) {
    console.log('🎨 Applying theme styling to app...', theme);
    
    const textColor = theme.textColor || '#1F2937';
    const isDark = theme.textColor ? true : false;
    
    // Apply to app container with smooth gradient
    const appScreen = document.getElementById('app-screen');
    if (appScreen) {
        appScreen.style.background = theme.bgGradient || theme.bgColor;
        appScreen.style.transition = 'all 0.3s ease';
        if (isDark) {
            appScreen.style.color = textColor;
        }
    }
    
    // Apply to header with glass effect
    const header = document.querySelector('header');
    if (header) {
        header.style.background = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.85)';
        header.style.color = textColor;
        header.style.backdropFilter = 'blur(20px)';
        header.style.borderRadius = '0 0 24px 24px';
        header.style.boxShadow = isDark 
            ? '0 4px 20px rgba(0,0,0,0.5)' 
            : '0 4px 20px rgba(0,0,0,0.1)';
        header.style.padding = '16px 20px';
    }
    
    // Apply to all cards with smooth rounded corners
    document.querySelectorAll('.card, .chore-item, .quest-item, .reward-item, .history-item').forEach(card => {
        card.style.background = isDark 
            ? 'rgba(255,255,255,0.1)' 
            : theme.cardBg;
        card.style.color = textColor;
        card.style.borderRadius = '20px';
        card.style.border = `2px solid ${theme.accentColor}22`;
        card.style.boxShadow = isDark
            ? '0 8px 32px rgba(0,0,0,0.3)'
            : '0 8px 32px rgba(0,0,0,0.08)';
        card.style.transition = 'all 0.3s ease';
        card.style.backdropFilter = isDark ? 'blur(10px)' : 'none';
    });
    
    // Style the main content areas
    document.querySelectorAll('.view').forEach(view => {
        view.style.borderRadius = '24px 24px 0 0';
        view.style.padding = '20px';
    });
    
    // Apply to all buttons with smooth styling
    document.querySelectorAll('.btn-primary, .complete-btn').forEach(btn => {
        btn.style.background = `linear-gradient(135deg, ${theme.buttonColor} 0%, ${theme.accentColor} 100%)`;
        btn.style.border = 'none';
        btn.style.borderRadius = '16px';
        btn.style.boxShadow = `0 4px 16px ${theme.buttonColor}44`;
        btn.style.transition = 'all 0.3s ease';
        btn.style.fontWeight = '600';
    });
    
    // Apply to all secondary buttons
    document.querySelectorAll('.btn:not(.btn-primary)').forEach(btn => {
        btn.style.borderRadius = '16px';
        btn.style.transition = 'all 0.3s ease';
    });
    
    // Apply to navigation with smooth styling
    const nav = document.querySelector('.app-nav');
    if (nav) {
        nav.style.background = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.95)';
        nav.style.borderRadius = '24px 24px 0 0';
        nav.style.backdropFilter = 'blur(20px)';
        nav.style.boxShadow = isDark
            ? '0 -4px 20px rgba(0,0,0,0.3)'
            : '0 -4px 20px rgba(0,0,0,0.1)';
    }
    
    document.querySelectorAll('.nav-item').forEach(navItem => {
        const isActive = navItem.classList.contains('active');
        navItem.style.borderRadius = '16px';
        navItem.style.transition = 'all 0.3s ease';
        
        if (isActive) {
            navItem.style.color = theme.accentColor;
            navItem.style.background = isDark 
                ? `${theme.accentColor}22` 
                : `${theme.accentColor}11`;
            navItem.style.transform = 'translateY(-2px)';
        } else {
            navItem.style.color = isDark ? '#94A3B8' : '#6B7280';
            navItem.style.background = 'transparent';
        }
    });
    
    // Style the settings view
    const settingsView = document.getElementById('view-settings');
    if (settingsView) {
        settingsView.style.background = isDark 
            ? 'rgba(0,0,0,0.2)' 
            : theme.bgColor;
        settingsView.style.color = textColor;
        settingsView.style.borderRadius = '24px 24px 0 0';
    }
    
    // Style all form inputs
    document.querySelectorAll('input[type="text"], input[type="number"], input[type="color"], select, textarea').forEach(input => {
        input.style.borderRadius = '12px';
        input.style.border = `2px solid ${theme.accentColor}33`;
        input.style.transition = 'all 0.3s ease';
        input.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'white';
        input.style.color = textColor;
    });
    
    // Style color inputs specially
    document.querySelectorAll('input[type="color"]').forEach(input => {
        input.style.borderRadius = '12px';
        input.style.height = '50px';
        input.style.cursor = 'pointer';
        input.style.border = `3px solid ${theme.accentColor}44`;
    });
    
    // Style range sliders
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        slider.style.accentColor = theme.accentColor;
    });
    
    // Style modal overlays with glass effect
    document.querySelectorAll('.modal-content-kid').forEach(modal => {
        modal.style.background = isDark 
            ? 'rgba(30, 41, 59, 0.95)' 
            : 'rgba(255, 255, 255, 0.95)';
        modal.style.color = textColor;
        modal.style.borderRadius = '24px';
        modal.style.backdropFilter = 'blur(20px)';
        modal.style.border = `2px solid ${theme.accentColor}33`;
        modal.style.boxShadow = isDark
            ? '0 20px 60px rgba(0,0,0,0.5)'
            : '0 20px 60px rgba(0,0,0,0.15)';
    });
    
    // Style avatar options
    document.querySelectorAll('.avatar-type-option').forEach(option => {
        option.style.borderRadius = '16px';
        option.style.transition = 'all 0.3s ease';
        option.style.cursor = 'pointer';
        
        if (option.classList.contains('active')) {
            option.style.borderColor = theme.accentColor;
            option.style.background = `${theme.accentColor}11`;
            option.style.transform = 'scale(1.05)';
        }
    });
    
    // Style font options
    document.querySelectorAll('.font-option').forEach(option => {
        option.style.borderRadius = '12px';
        option.style.transition = 'all 0.3s ease';
        option.style.cursor = 'pointer';
        
        if (option.classList.contains('active')) {
            option.style.borderColor = theme.accentColor;
            option.style.background = `${theme.accentColor}11`;
        }
    });
    
    // Style the preview box
    const previewBox = document.querySelector('#preview-box, .preview-box');
    if (previewBox) {
        previewBox.style.borderRadius = '20px';
        previewBox.style.background = isDark 
            ? 'rgba(255,255,255,0.1)' 
            : 'white';
        previewBox.style.border = `2px solid ${theme.accentColor}33`;
        previewBox.style.boxShadow = isDark
            ? '0 8px 32px rgba(0,0,0,0.3)'
            : '0 8px 32px rgba(0,0,0,0.08)';
        previewBox.style.backdropFilter = isDark ? 'blur(10px)' : 'none';
    }
    
    // Style theme button
    const themeBtn = document.getElementById('open-theme-modal-btn');
    if (themeBtn) {
        themeBtn.style.borderRadius = '16px';
        themeBtn.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.4)';
        themeBtn.style.transition = 'all 0.3s ease';
    }
    
    // Add hover effects to interactive elements
    const style = document.createElement('style');
    style.textContent = `
        .card:hover, .chore-item:hover, .quest-item:hover, .reward-item:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 40px rgba(0,0,0,0.12) !important;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px ${theme.buttonColor}66 !important;
        }
        
        .nav-item:hover:not(.active) {
            background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'} !important;
        }
        
        .avatar-type-option:hover, .font-option:hover, .theme-choice:hover, .border-style-choice:hover {
            transform: scale(1.05);
            border-color: ${theme.accentColor} !important;
        }
        
        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: ${theme.accentColor} !important;
            box-shadow: 0 0 0 3px ${theme.accentColor}22 !important;
        }
    `;
    
    // Remove old style tag if exists
    const oldStyle = document.getElementById('theme-hover-styles');
    if (oldStyle) oldStyle.remove();
    
    style.id = 'theme-hover-styles';
    document.head.appendChild(style);
    
    console.log('✅ Enhanced theme styling applied!');
}

// Save settings to server
async function saveSettingsToServer(settings) {
    console.log('💾 Saving settings to server...', settings);
    
    try {
        const result = await apiCall('save_kid_settings', { settings: settings });
        
        if (result.ok) {
            console.log('✅ Settings saved to server!');
        } else {
            console.error('❌ Failed to save settings to server:', result.error);
        }
    } catch (error) {
        console.error('❌ Error saving settings:', error);
    }
}

// Load settings from server
async function loadSettingsFromServer() {
    console.log('📥 Loading settings from server...');
    
    const result = await apiCall('load_kid_settings');
    
    if (result.ok && result.settings && Object.keys(result.settings).length > 0) {
        console.log('✅ Settings loaded from server:', result.settings);
        
        // Merge with localStorage (server is authoritative)
        localStorage.setItem('kid_settings', JSON.stringify(result.settings));
        
        return result.settings;
    } else {
        console.log('📭 No settings on server, using local settings');
        return null;
    }
}

function openBorderStyleModal() {
    console.log('🎨 Opening border style modal...');
    const modal = document.getElementById('border-style-modal');
    if (modal) {
        modal.style.display = 'flex';
        console.log('✅ Border modal displayed');
    } else {
        console.error('❌ Border modal not found!');
    }
}

function applyBorderStyle(style, width) {
    selectedBorderStyle = style;
    selectedBorderWidth = width;
    
    const previewAvatar = document.getElementById('preview-avatar');
    const borderColor = document.getElementById('avatar-border-color')?.value || '#4F46E5';
    
    // Only apply to preview, NOT the header avatar yet
    if (!previewAvatar) return;
    
    // CRITICAL: Completely reset ALL border/shadow/background styles
    previewAvatar.style.cssText = previewAvatar.style.cssText.replace(/border[^;]*;?/gi, '');
    previewAvatar.style.cssText = previewAvatar.style.cssText.replace(/box-shadow[^;]*;?/gi, '');
    previewAvatar.style.cssText = previewAvatar.style.cssText.replace(/padding[^;]*;?/gi, '');
    previewAvatar.style.cssText = previewAvatar.style.cssText.replace(/background[^;]*;?/gi, '');
    
    // Ensure base styles are set
    previewAvatar.style.borderRadius = '50%';
    previewAvatar.style.display = 'flex';
    previewAvatar.style.alignItems = 'center';
    previewAvatar.style.justifyContent = 'center';
    previewAvatar.style.overflow = 'hidden';
    
    // Apply the selected border style
    switch(style) {
        case 'solid':
            previewAvatar.style.border = `${width}px solid ${borderColor}`;
            previewAvatar.style.background = 'white';
            break;
        case 'dashed':
            previewAvatar.style.border = `${width}px dashed ${borderColor}`;
            previewAvatar.style.background = 'white';
            break;
        case 'dotted':
            previewAvatar.style.border = `${width}px dotted ${borderColor}`;
            previewAvatar.style.background = 'white';
            break;
        case 'double':
            previewAvatar.style.border = `${width}px double ${borderColor}`;
            previewAvatar.style.background = 'white';
            break;
        case 'glow':
            previewAvatar.style.border = `${width}px solid ${borderColor}`;
            previewAvatar.style.background = 'white';
            previewAvatar.style.boxShadow = `0 0 15px ${borderColor}99`;
            break;
        case 'gradient':
            previewAvatar.style.background = 'linear-gradient(45deg, #FF6B6B, #4ECDC4, #45B7D1, #FFA07A)';
            previewAvatar.style.padding = `${width}px`;
            // Ensure inner image has white background
            const innerImg = previewAvatar.querySelector('img');
            if (innerImg) {
                innerImg.style.background = 'white';
                innerImg.style.borderRadius = '50%';
            }
            break;
        case 'neon':
            previewAvatar.style.border = `${width}px solid #00FF88`;
            previewAvatar.style.background = 'white';
            previewAvatar.style.boxShadow = `0 0 20px rgba(0, 255, 136, 0.8), inset 0 0 10px rgba(0, 255, 136, 0.3)`;
            break;
    }
    
    // Save to localStorage (but don't apply to header yet)
    const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
    settings.borderStyle = style;
    settings.borderWidth = width;
    localStorage.setItem('kid_settings', JSON.stringify(settings));
    
    console.log('✅ Border style applied to PREVIEW:', style, width);
}

function applyBorderToHeader() {
    console.trace('🔍 applyBorderToHeader called from:');  // ADD THIS LINE
    
    const avatar = document.getElementById('kid-avatar');
    if (!avatar) {
        console.log('❌ No avatar element found');
        return;
    }    
    const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
    const style = settings.borderStyle || 'solid';
    const width = settings.borderWidth || 3;
    const borderColor = settings.avatarBorderColor || '#4F46E5';
    
    console.log('🎨 applyBorderToHeader called with:', {style, width, borderColor});
    
    // NUCLEAR OPTION: Clear ALL inline styles related to borders
    avatar.style.border = 'none';
    avatar.style.boxShadow = 'none';
    avatar.style.padding = '0';
    avatar.style.outline = 'none';
    
    // Re-apply essential base styles
    avatar.style.borderRadius = '50%';
    avatar.style.display = 'flex';
    avatar.style.alignItems = 'center';
    avatar.style.justifyContent = 'center';
    avatar.style.overflow = 'hidden';
    avatar.style.width = '50px';
    avatar.style.height = '50px';
    
    console.log('🎨 Now applying border style:', style);
    
    switch(style) {
        case 'solid':
            avatar.style.border = `${width}px solid ${borderColor}`;
            console.log('✅ Applied solid border:', avatar.style.border);
            break;
        case 'dashed':
            avatar.style.border = `${width}px dashed ${borderColor}`;
            console.log('✅ Applied dashed border');
            break;
        case 'dotted':
            avatar.style.border = `${width}px dotted ${borderColor}`;
            console.log('✅ Applied dotted border');
            break;
        case 'double':
            avatar.style.border = `${width}px double ${borderColor}`;
            console.log('✅ Applied double border');
            break;
        case 'glow':
            avatar.style.border = `${width}px solid ${borderColor}`;
            avatar.style.boxShadow = `0 0 15px ${borderColor}99`;
            console.log('✅ Applied glow border');
            break;
        case 'gradient':
            avatar.style.background = `linear-gradient(45deg, #FF6B6B, #4ECDC4, #45B7D1, #FFA07A)`;
            avatar.style.padding = `${width}px`;
            const innerImg = avatar.querySelector('img');
            if (innerImg) {
                innerImg.style.background = 'white';
                innerImg.style.borderRadius = '50%';
            }
            console.log('✅ Applied gradient border');
            break;
        case 'neon':
            avatar.style.border = `${width}px solid #00FF88`;
            avatar.style.boxShadow = `0 0 20px rgba(0, 255, 136, 0.8), inset 0 0 10px rgba(0, 255, 136, 0.3)`;
            console.log('✅ Applied neon border');
            break;
        default:
            avatar.style.border = `${width}px solid ${borderColor}`;
            console.log('✅ Applied default solid border');
    }
    
    console.log('✅ Header avatar border updated!');
}

async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    
    // NO SIZE LIMIT - we're cropping it down anyway!
    console.log('📸 Image selected:', file.name, 'Size:', Math.round(file.size / 1024) + 'KB');
    
    // Read the file and show crop modal
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = async function() {
            console.log('🖼️ Image loaded, dimensions:', img.width, 'x', img.height);
            // Show crop modal for this image
            showCropModalForIcon(img);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function showCropModalForIcon(img) {
    // Create modal (same as showCropModal but saves to icon system)
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '10001'; // Higher than avatar selector modal
    
    modal.innerHTML = `
        <div class="modal-content-kid" style="max-width: 500px;">
            <h3 style="margin-bottom: 20px;">Adjust Your Icon 🎨</h3>
            
            <div style="text-align: center; margin-bottom: 20px;">
                <canvas id="crop-canvas-icon" style="max-width: 100%; border: 3px solid #4F46E5; border-radius: 12px; cursor: move;"></canvas>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Zoom:</label>
                <input type="range" id="zoom-slider-icon" min="50" max="200" value="100" style="width: 100%;">
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="flex: 1;">Cancel</button>
                <button class="btn btn-primary" id="save-icon-btn" style="flex: 1;">Save Icon ✨</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup canvas
    const canvas = document.getElementById('crop-canvas-icon');
    const ctx = canvas.getContext('2d');
    const size = 300;
    canvas.width = size;
    canvas.height = size;
    
    const initialScale = Math.max(size / img.width, size / img.height);
    let zoom = initialScale;
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    
    function drawImage() {
        ctx.clearRect(0, 0, size, size);
        const scaledWidth = img.width * zoom;
        const scaledHeight = img.height * zoom;
        const x = (size - scaledWidth) / 2 + offsetX;
        const y = (size - scaledHeight) / 2 + offsetY;
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
    }
    
    drawImage();
    
    // Zoom slider
    const zoomSlider = document.getElementById('zoom-slider-icon');
    zoomSlider.value = 100;
    zoomSlider.addEventListener('input', (e) => {
        const sliderValue = parseInt(e.target.value);
        zoom = initialScale * (sliderValue / 100);
        drawImage();
    });
    
    // Mouse drag
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left - offsetX;
        startY = e.clientY - rect.top - offsetY;
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const rect = canvas.getBoundingClientRect();
            offsetX = e.clientX - rect.left - startX;
            offsetY = e.clientY - rect.top - startY;
            drawImage();
        }
    });
    
    canvas.addEventListener('mouseup', () => isDragging = false);
    canvas.addEventListener('mouseleave', () => isDragging = false);
    
    // Touch drag
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
    
    canvas.addEventListener('touchend', () => isDragging = false);
    
        // Save button - uploads to server as user avatar
    document.getElementById('save-icon-btn').addEventListener('click', async () => {
        console.log('💾 Saving icon...');
        
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = 200;
        finalCanvas.height = 200;
        const finalCtx = finalCanvas.getContext('2d');
        finalCtx.drawImage(canvas, 0, 0, size, size, 0, 0, 200, 200);
        
        const photoData = finalCanvas.toDataURL('image/png', 0.9);
        console.log('📦 Image data created, size:', Math.round(photoData.length / 1024) + 'KB');
        
        // Upload to server via upload_avatar_photo endpoint
        console.log('📤 Uploading to server...');
        const result = await apiCall('upload_avatar_photo', { photo_data: photoData });
        
        console.log('📥 Server response:', result);
        
        if (result.ok) {
            console.log('✅ Upload successful! URL:', result.data.url);
            
            // Reload avatars in the selector
            await loadAvatars();
            selectedAvatarUrl = result.data.url;
            renderAvatarGrid();
            
            // Switch to "My Photos" filter to show the new upload
            currentFilter = 'user';
            document.querySelectorAll('.filter-tab').forEach(t => {
                t.style.background = '#F3F4F6';
                t.style.color = '#6B7280';
            });
            const userTab = document.getElementById('filter-user');
            if (userTab) {
                userTab.style.background = '#EEF2FF';
                userTab.style.color = '#4F46E5';
            }
            renderAvatarGrid();
            
            modal.remove();
            alert('Icon uploaded and added to "My Photos"! Select it from the grid. ✨');
        } else {
            console.error('❌ Upload failed:', result.error);
            alert('Upload failed: ' + result.error);
        }
    });
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
    // **DEBUG**: Avatar type options - SKIP logo and border (they have special handling)
    console.log('🎨 Attaching avatar type option listeners...');
    const avatarTypeOptions = document.querySelectorAll('.avatar-type-option');
    console.log('📍 Found avatar type options:', avatarTypeOptions.length);
    
    avatarTypeOptions.forEach((option, index) => {
        console.log(`  - Option ${index}: data-avatar="${option.dataset.avatar}"`);
        
        // Don't attach the general handler to logo or border - they have special behavior
        if (option.dataset.avatar !== 'logo' && option.dataset.avatar !== 'border') {
            console.log(`    ✅ Attaching general handler to ${option.dataset.avatar}`);
            option.addEventListener('click', (e) => {
                console.log(`🖱️ ${option.dataset.avatar} clicked (general handler)`);
                document.querySelectorAll('.avatar-type-option').forEach(o => o.classList.remove('active'));
                option.classList.add('active');
                updatePreview();
            });
        } else {
            console.log(`    ⏭️ SKIPPING ${option.dataset.avatar} - it has special handling`);
        }
    });
    
    // Avatar border color
    const avatarBorderColor = document.getElementById('avatar-border-color');
    if (avatarBorderColor) {
        avatarBorderColor.addEventListener('input', updatePreview);
    }    
}

// Initialize
checkPairing();