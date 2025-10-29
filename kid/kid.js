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
    // Load themes first
    await loadThemesFromAPI();
    
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
    reapplyCurrentTheme();
}

// Chores
async function loadChores() {
    console.log('Loading chores...');
    const result = await apiCall('kid_feed');
    if (result.ok) {
        renderChores(result.data.chores, result.data.submissions || []);
    }
    reapplyCurrentTheme();
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

async function submitChore(choreId) {
    if (window.submitting) return;
    window.submitting = true;
    
    try {
        const note = prompt(`Submit chore.\n\nAdd a note (optional):`);
        if (note === null) {
            window.submitting = false;
            return;
        }
        
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
    } finally {
        window.submitting = false;
    }
}

// Quests
async function loadQuests() {
    const result = await apiCall('kid_quest_progress');
    if (result.ok) {
        renderQuests(result.data);
    }
    reapplyCurrentTheme();
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
    reapplyCurrentTheme();
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
        // Show nice modal instead of alert
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 20px; padding: 30px; max-width: 400px; width: 90%; text-align: center;">
                <div style="font-size: 80px; margin-bottom: 15px;">🎉</div>
                <h2 style="margin: 0 0 10px 0; font-size: 24px; color: #10B981;">Redemption Requested!</h2>
                <p style="color: #6B7280; margin-bottom: 25px;">Your reward redemption has been submitted for approval.</p>
                
                <div style="background: #FEF3C7; border: 2px solid #F59E0B; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                    <div style="font-weight: 700; margin-bottom: 5px;">⏳ Pending Approval</div>
                    <div style="font-size: 14px; color: #92400E;">Check the Rewards tab in History for updates!</div>
                </div>
                
                <button onclick="this.closest('.modal-overlay').remove(); switchView('history'); document.querySelector('.history-tab[data-tab=\\'redemptions\\']').click();" 
                        style="width: 100%; padding: 15px; background: #4F46E5; color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; margin-bottom: 10px;">
                    View My Redemptions
                </button>
                <button onclick="this.closest('.modal-overlay').remove();" 
                        style="width: 100%; padding: 15px; background: #E5E7EB; color: #4B5563; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        await loadFeed();
        await loadRewards();
    } else {
        alert('Error: ' + result.error);
    }
}

// History with Tabs
async function loadHistory() {
    const result = await apiCall('kid_feed');
    if (result.ok) {
        renderEnhancedHistory(result.data.submissions || [], result.data.redemptions || []);
    }
    reapplyCurrentTheme();
}

function renderEnhancedHistory(submissions, redemptions) {
    const container = document.getElementById('history-list');
    
    // Create tabbed interface
    const tabsHtml = `
        <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid rgba(0,0,0,0.1); padding-bottom: 10px;">
            <button class="history-tab active" data-tab="chores" style="flex: 1; padding: 12px; background: var(--accent-color, #4F46E5); color: white; border: none; border-radius: 12px; font-weight: 600; cursor: pointer;">
                📋 Chores
            </button>
            <button class="history-tab" data-tab="redemptions" style="flex: 1; padding: 12px; background: rgba(0,0,0,0.05); color: #6B7280; border: none; border-radius: 12px; font-weight: 600; cursor: pointer;">
                🎁 Rewards
            </button>
        </div>
        
        <div id="chores-history" class="history-section">
            <!-- Chores will go here -->
        </div>
        
        <div id="redemptions-history" class="history-section" style="display: none;">
            <!-- Redemptions will go here -->
        </div>
    `;
    
    container.innerHTML = tabsHtml;
    
    // Render both sections
    renderChoresHistory(submissions);
    renderRedemptionsHistory(redemptions);
    
    // Tab click handlers
    document.querySelectorAll('.history-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab styling
            document.querySelectorAll('.history-tab').forEach(t => {
                t.classList.remove('active');
                t.style.background = 'rgba(0,0,0,0.05)';
                t.style.color = '#6B7280';
            });
            tab.classList.add('active');
            tab.style.background = 'var(--accent-color, #4F46E5)';
            tab.style.color = 'white';
            
            // Show correct section
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.history-section').forEach(section => {
                section.style.display = 'none';
            });
            document.getElementById(`${tabName}-history`).style.display = 'block';
        });
    });
}

function renderChoresHistory(submissions) {
    const container = document.getElementById('chores-history');
    
    if (!submissions || submissions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <h3>No Chore History Yet</h3>
                <p>Complete chores to see your history!</p>
            </div>
        `;
        return;
    }
    
    const html = submissions.map(sub => `
        <div class="card" style="margin-bottom: 15px;">
            <div class="history-date">${formatDate(sub.submitted_at)}</div>
            <div class="card-title">${sub.chore_title}</div>
            ${sub.note ? `<div class="card-description">"${sub.note}"</div>` : ''}
            <div class="card-meta" style="margin-top: 10px;">
                <span class="badge badge-${sub.status}">
                    ${sub.status === 'approved' ? '✅ APPROVED' : sub.status === 'pending' ? '⏳ PENDING' : '❌ REJECTED'}
                </span>
                ${sub.status === 'approved' ? `<span class="badge badge-primary">+${sub.points_awarded} points</span>` : ''}
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function renderRedemptionsHistory(redemptions) {
    const container = document.getElementById('redemptions-history');
    
    if (!redemptions || redemptions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="8" r="7"></circle>
                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                </svg>
                <h3>No Rewards Yet</h3>
                <p>Redeem rewards to see them here!</p>
            </div>
        `;
        return;
    }
    
    const html = redemptions.map(red => {
        const statusColors = {
            pending: '#F59E0B',
            approved: '#10B981',
            rejected: '#EF4444'
        };
        const statusIcons = {
            pending: '⏳',
            approved: '✅',
            rejected: '❌'
        };
        
        return `
            <div class="card" style="margin-bottom: 15px; border-left: 4px solid ${statusColors[red.status]};">
                <div class="history-date">${formatDate(red.requested_at)}</div>
                <div class="card-title">${red.reward_title}</div>
                <div class="card-meta" style="margin-top: 10px; display: flex; gap: 10px;">
                    <span class="badge badge-${red.status}">
                        ${statusIcons[red.status]} ${red.status.toUpperCase()}
                    </span>
                    <span class="badge" style="background: #EF4444; color: white;">
                        -${red.cost_points} points
                    </span>
                </div>
                ${red.status === 'approved' ? `
                    <button onclick="showRedemptionReceipt(${red.id}, '${red.reward_title.replace(/'/g, "\\'")}', ${red.cost_points}, '${red.requested_at}')" 
                            style="margin-top: 15px; width: 100%; padding: 12px; background: #10B981; color: white; border: none; border-radius: 12px; font-weight: 600; cursor: pointer;">
                        📄 View Receipt
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// Show redemption receipt modal
function showRedemptionReceipt(redemptionId, rewardTitle, points, redeemedAt) {
    const date = new Date(redeemedAt);
    const formattedDate = date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 30px; max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <!-- Receipt Header -->
            <div style="text-align: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 3px dashed #E5E7EB;">
                <div style="font-size: 60px; margin-bottom: 10px;">🎉</div>
                <h2 style="margin: 0; font-size: 24px; color: #10B981;">REWARD REDEEMED</h2>
                <div style="font-size: 14px; color: #6B7280; margin-top: 5px;">Official Receipt</div>
            </div>
            
            <!-- Receipt Details -->
            <div style="margin-bottom: 25px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: #6B7280; font-weight: 600;">Reward:</span>
                    <span style="font-weight: 700; text-align: right;">${rewardTitle}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: #6B7280; font-weight: 600;">Cost:</span>
                    <span style="font-weight: 700; color: #EF4444;">${points} points</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: #6B7280; font-weight: 600;">Status:</span>
                    <span style="font-weight: 700; color: #10B981;">✅ APPROVED</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #6B7280; font-weight: 600;">Date:</span>
                    <span style="font-weight: 600; font-size: 12px; text-align: right;">${formattedDate}</span>
                </div>
            </div>
            
            <!-- Success Message -->
            <div style="background: #D1FAE5; border: 2px solid #10B981; border-radius: 12px; padding: 15px; text-align: center; margin-bottom: 20px;">
                <div style="font-size: 18px; font-weight: 700; color: #065F46; margin-bottom: 5px;">
                    🎉 Reward Approved!
                </div>
                <div style="font-size: 14px; color: #047857;">
                    Show this receipt to claim your reward
                </div>
            </div>
            
            <!-- Kid Name -->
            <div style="text-align: center; margin-bottom: 20px; padding: 12px; background: #F3F4F6; border-radius: 10px;">
                <div style="font-size: 12px; color: #6B7280; margin-bottom: 3px;">Redeemed by:</div>
                <div style="font-size: 18px; font-weight: 700;">${currentKid.kid_name}</div>
            </div>
            
            <!-- Barcode (decorative) -->
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="display: inline-block; background: repeating-linear-gradient(90deg, #000 0px, #000 2px, transparent 2px, transparent 4px); height: 40px; width: 200px;"></div>
                <div style="font-size: 11px; color: #6B7280; margin-top: 5px; font-family: monospace;">REF: ${Date.now().toString(36).toUpperCase()}</div>
            </div>
            
            <!-- Close Button -->
            <button onclick="this.closest('.modal-overlay').remove()" 
                    style="width: 100%; padding: 15px; background: #4F46E5; color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer;">
                Close Receipt
            </button>
        </div>
    `;
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    document.body.appendChild(modal);
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
    pollInterval = setInterval(async () => {
        await loadFeed();
        
        // 🔧 Reapply theme after refresh
        const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
        if (settings.themeName && themes[settings.themeName]) {
            console.log('🔄 Reapplying theme after auto-refresh');
            applyThemeStyling(themes[settings.themeName]);
        }
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
    
    // 🔧 Reapply theme after refresh
    const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
    if (settings.themeName && themes[settings.themeName]) {
        console.log('🔄 Reapplying theme after manual refresh');
        applyThemeStyling(themes[settings.themeName]);
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
        console.log('🎨 Loading custom theme styling');
        const selectedTheme = themes[settings.themeName];
        applyThemeStyling(selectedTheme);
        
        // Re-trigger animation after save
        if (selectedTheme.hasAnimation && selectedTheme.animationType) {
            console.log('🎬 Restarting animation after save:', selectedTheme.animationType);
            
            setTimeout(() => {
                // Make sure container exists
                let container = document.getElementById('theme-animation-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'theme-animation-container';
                    container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0;';
                    document.body.insertBefore(container, document.body.firstChild);
                }
                
                // Call the animation function directly based on type
            switch(theme.animationType) {
                case 'stars':
                    if (typeof createStarryBackground === 'function') {
                        createStarryBackground();
                    }
                    break;
                case 'bubbles':
                    if (typeof createBubbles === 'function') {
                        createBubbles();
                    }
                    break;
                case 'snowflakes':
                    if (typeof createSnowflakes === 'function') {
                        createSnowflakes();
                    }
                    break;
                case 'embers':
                    if (typeof createEmbers === 'function') {
                        createEmbers();
                    }
                    break;
                case 'sparkles':
                    if (typeof createSparkles === 'function') {
                        createSparkles();
                    }
                    break;
                case 'sand':
                    if (typeof createSandBlowing === 'function') {
                        createSandBlowing();
                    }
                    break;
                case 'aurora':
                    if (typeof createAurora === 'function') {
                        createAurora();
                    }
                    break;
                case 'leaves':
                    if (typeof createLeaves === 'function') {
                        createLeaves();
                    }
                    break;
                case 'candy':
                    if (typeof createCandySprinkles === 'function') {
                        createCandySprinkles();
                    }
                    break;
                case 'retro':
                    if (typeof createRetroSprites === 'function') {
                        createRetroSprites();
                    }
                    break;
                case 'birds':
                    if (typeof createBirds === 'function') {
                        createBirds();
                    }
                    break;
                default:
                    console.warn('Unknown animation type:', theme.animationType);
            }
            }, 150);
        }
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

// Themes will be loaded from API
let themes = {};

// Helper function to reapply theme after data loads
function reapplyCurrentTheme() {
    const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
    if (settings.themeName && themes[settings.themeName]) {
        console.log('🔄 Reapplying current theme:', settings.themeName);
        applyThemeStyling(themes[settings.themeName]);
    }
}

// Load themes from database
async function loadThemesFromAPI() {
    const result = await apiCall('list_themes');
    if (result.ok && result.data) {
        themes = {};
        result.data.forEach(theme => {
            // Store with LOWERCASE keys for consistency
            const themeName = theme.name.toLowerCase();
            themes[themeName] = {
                // Visual styling
                bgGradient: theme.bg_gradient,
                bgColor: theme.bg_color,
                textColor: theme.text_color,
                accentColor: theme.accent_color,
                
                // Border & Typography
                borderStyle: theme.border_style,
                borderWidth: theme.border_width,
                borderRadius: theme.border_radius,
                fontFamily: theme.font_family,
                
                // Card styling (NEW!)
                cardBgColor: theme.card_bg_color || '#FFFFFF',
                cardOpacity: theme.card_opacity || 0.95,
                cardBlur: theme.card_blur || 10,
                cardShadow: theme.card_shadow || '0 8px 32px rgba(0,0,0,0.1)',
                
                // Header styling (NEW!)
                headerBgColor: theme.header_bg_color || '#FFFFFF',
                headerOpacity: theme.header_opacity || 0.85,
                headerBlur: theme.header_blur || 20,
                
                // Nav styling (NEW!)
                navBgColor: theme.nav_bg_color || '#FFFFFF',
                navOpacity: theme.nav_opacity || 0.95,
                navBlur: theme.nav_blur || 20,
                
                // Button styling (NEW!)
                buttonGradient: theme.button_gradient || null,
                buttonColor: theme.accent_color, // fallback
                
                // Animation
                hasAnimation: theme.has_animation || false,
                animationType: theme.animation_type || null,
                
                // Legacy/compatibility
                displayName: theme.name,
                cardBg: theme.card_bg_color || '#FFFFFF', // legacy field
                nameColor: theme.accent_color, // default for kid name
                nameFont: 'default',
                nameSize: 24,
                avatarBorderColor: theme.accent_color
            };
        });
        console.log('✅ Themes loaded from database:', Object.keys(themes));
        
        // 🔍 DEBUG: Check Arctic theme specifically
        if (themes['arctic']) {
            console.log('🔍 ARCTIC THEME LOADED:', {
                cardBgColor: themes['arctic'].cardBgColor,
                cardOpacity: themes['arctic'].cardOpacity,
                cardBlur: themes['arctic'].cardBlur
            });
        }
    }
}

// Call this when the app initializes
(async function initializeThemes() {
    await loadThemesFromAPI();
})();

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
    settings.themeName = themeName;
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
    
    // Clear any existing animations first
    console.log('🧹 Clearing old animations...');
    const animContainer = document.getElementById('theme-animation-container');
    if (animContainer) {
        animContainer.innerHTML = '';
    }
    
    // Trigger animation if theme has one
    if (theme.hasAnimation && theme.animationType) {
        console.log('🎬 Starting animation:', theme.animationType);
        
        // Force animation restart with direct function call
        setTimeout(() => {
            // Make sure container exists
            let container = document.getElementById('theme-animation-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'theme-animation-container';
                container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0;';
                document.body.insertBefore(container, document.body.firstChild);
            }
            
            // Call the animation function directly based on type
            switch(theme.animationType) {
                case 'stars':
                    if (typeof createStarryBackground === 'function') {
                        createStarryBackground();
                    }
                    break;
                case 'bubbles':
                    if (typeof createBubbles === 'function') {
                        createBubbles();
                    }
                    break;
                case 'snowflakes':
                    if (typeof createSnowflakes === 'function') {
                        createSnowflakes();
                    }
                    break;
                case 'embers':
                    if (typeof createEmbers === 'function') {
                        createEmbers();
                    }
                    break;
                case 'sparkles':
                    if (typeof createSparkles === 'function') {
                        createSparkles();
                    }
                    break;
                case 'sand':
                    if (typeof createSandBlowing === 'function') {
                        createSandBlowing();
                    }
                    break;
                case 'aurora':
                    if (typeof createAurora === 'function') {
                        createAurora();
                    }
                    break;
                case 'leaves':
                    if (typeof createLeaves === 'function') {
                        createLeaves();
                    }
                    break;
                case 'candy':
                    if (typeof createCandySprinkles === 'function') {
                        createCandySprinkles();
                    }
                    break;
                case 'retro':
                    if (typeof createRetroSprites === 'function') {
                        createRetroSprites();
                    }
                    break;
                case 'birds':
                    if (typeof createBirds === 'function') {
                        createBirds();
                    }
                    break;
                default:
                    console.warn('Unknown animation type:', theme.animationType);
            }
        }, 150);
    } else {
        console.log('🎬 No animation for this theme');
    }
    
    // Save to server
    console.log('📤 Now saving to server...');
    saveSettingsToServer(settings);
    
    console.log(`✅ ${themeName.charAt(0).toUpperCase() + themeName.slice(1)} theme applied!`);
}

function applyThemeStyling(theme) {
    console.log('🎨 Applying theme styling to app...', theme);
    
    // 🔍 DEBUG: Check what opacity we received
    console.log('🔍 THEME OBJECT RECEIVED:', {
        name: theme.displayName,
        cardBgColor: theme.cardBgColor,
        cardOpacity: theme.cardOpacity,
        cardBlur: theme.cardBlur,
        fullTheme: theme
    });
    
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
        const headerBg = theme.headerBgColor || '#FFFFFF';
        const headerOpacity = theme.headerOpacity || 0.85;
        const headerBlur = theme.headerBlur || 20;
        
        let rgb;
        try {
            rgb = headerBg.match(/\w\w/g).map(x => parseInt(x, 16)).join(', ');
        } catch(e) {
            rgb = '255, 255, 255';
        }
        
        header.style.background = `rgba(${rgb}, ${headerOpacity})`;
        header.style.color = textColor;
        header.style.backdropFilter = `blur(${headerBlur}px)`;
        header.style.borderRadius = '0 0 24px 24px';
        header.style.boxShadow = isDark 
            ? '0 4px 20px rgba(0,0,0,0.5)' 
            : '0 4px 20px rgba(0,0,0,0.1)';
        header.style.padding = '16px 20px';
    }
    
    // Apply to all cards using theme settings
    console.log('🔍 BEFORE APPLYING TO CARDS:', {
        cardBgColor: theme.cardBgColor,
        cardOpacity: theme.cardOpacity,
        cardBlur: theme.cardBlur
    });
    
    document.querySelectorAll('.card, .chore-item, .quest-item, .reward-item, .history-item').forEach(card => {
        const cardBg = theme.cardBgColor || '#FFFFFF';
        const cardOpacity = theme.cardOpacity || 0.95;
        const cardBlur = theme.cardBlur || 10;
        const cardShadow = theme.cardShadow || '0 8px 32px rgba(0,0,0,0.1)';
        
        console.log('🔍 APPLYING TO CARD:', {
            cardBg,
            cardOpacity,
            cardBlur,
            willApply: `rgba(..., ${cardOpacity})`
        });
        
        // Convert hex to rgba
        let rgb;
        try {
            rgb = cardBg.match(/\w\w/g).map(x => parseInt(x, 16)).join(', ');
        } catch(e) {
            rgb = '255, 255, 255';
        }
        
        const finalBackground = `rgba(${rgb}, ${cardOpacity})`;
        console.log('🔍 FINAL BACKGROUND VALUE:', finalBackground);
        
        card.style.background = finalBackground;
        card.style.color = '#1F2937';
        card.style.borderRadius = '20px';
        card.style.border = `3px solid ${theme.accentColor}`;
        card.style.boxShadow = cardShadow;
        card.style.transition = 'all 0.3s ease';
        card.style.backdropFilter = `blur(${cardBlur}px)`;
        
        console.log('🔍 CARD STYLE APPLIED:', card.style.background);
    });
    
    console.log('🔍 CARDS STYLING COMPLETE');
    
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
    
    // Apply to navigation using theme settings
    const nav = document.querySelector('.app-nav');
    if (nav) {
        const navBg = theme.navBgColor || '#FFFFFF';
        const navOpacity = theme.navOpacity || 0.95;
        const navBlur = theme.navBlur || 20;
        
        let rgb;
        try {
            rgb = navBg.match(/\w\w/g).map(x => parseInt(x, 16)).join(', ');
        } catch(e) {
            rgb = '255, 255, 255';
        }
        
        nav.style.background = `rgba(${rgb}, ${navOpacity})`;
        nav.style.borderRadius = '24px 24px 0 0';
        nav.style.backdropFilter = `blur(${navBlur}px)`;
        nav.style.boxShadow = isDark
            ? '0 -4px 20px rgba(0,0,0,0.3)'
            : '0 -4px 20px rgba(0,0,0,0.1)';
    }

    // Apply to all secondary buttons
    document.querySelectorAll('.btn:not(.btn-primary)').forEach(btn => {
        btn.style.borderRadius = '16px';
        btn.style.transition = 'all 0.3s ease';
    });
       
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
    
    // Apply text color to header and non-card areas only
    if (theme.textColor) {
    // Target specific elements that need light text
        document.querySelectorAll('.settings-section label, #view-settings h3, .view > h2, .nav-item').forEach(el => {
            el.style.color = theme.textColor;
        });
    
    // Set default text color for body (but cards will override)
        document.body.style.color = theme.textColor;
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
    // Trigger animation if theme has one
    if (theme.hasAnimation && theme.animationType) {
        console.log('🎬 Starting animation:', theme.animationType);
        if (typeof startThemeAnimation === 'function') {
            startThemeAnimation(theme.animationType);
        }
    } else {
        console.log('🎬 No animation for this theme');
        if (typeof stopThemeAnimation === 'function') {
            stopThemeAnimation();
        }
    }
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

// ============================================
// 🎨 CHOREQUEST ENHANCEMENTS v1.0
// ============================================
// Paste this entire file at the END of kid.js
// (after the last line, before the closing tags)

// ============================================
// 🎵 SOUND SYSTEM
// ============================================

// ============================================
// 🎵 SOUND SYSTEM - BROWSER BEEPS (No External Files!)
// ============================================
// COPY THIS ENTIRE SECTION and REPLACE your existing SOUNDS section

// Generate simple beep sounds using Web Audio API - no external files needed!
function playSound(soundName) {
    const soundsEnabled = localStorage.getItem('sounds_enabled') !== 'false';
    if (!soundsEnabled) return;
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Different frequencies for different sounds
        const soundConfig = {
            complete: { freq: 880, duration: 0.15 },   // A5 - high happy note
            points: { freq: 660, duration: 0.12 },     // E5 - quick ding
            levelUp: { freq: 1046, duration: 0.3 },    // C6 - celebration
            reward: { freq: 523, duration: 0.25 },     // C5 - reward chime
            swoosh: { freq: 200, duration: 0.08 },     // Low whoosh
            click: { freq: 800, duration: 0.05 }       // Quick click
        };
        
        const config = soundConfig[soundName] || { freq: 440, duration: 0.1 };
        
        oscillator.frequency.value = config.freq;
        oscillator.type = soundName === 'swoosh' ? 'triangle' : 'sine';
        
        // Volume envelope for natural sound
        gainNode.gain.value = 0.15;
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + config.duration);
        
        console.log(`🔊 Playing sound: ${soundName}`);
    } catch (e) {
        console.log(`🔇 Audio not supported: ${e.message}`);
    }
}

// Keep these for compatibility with the rest of the code
const SOUNDS = {};
const audioCache = {};

// Add sound toggle to settings
function addSoundToggle() {
    const settingsView = document.getElementById('settings-view');
    if (!settingsView || document.getElementById('sound-toggle-section')) return;
    
    const soundsEnabled = localStorage.getItem('sounds_enabled') !== 'false';
    
    const soundSection = document.createElement('div');
    soundSection.id = 'sound-toggle-section';
    soundSection.className = 'settings-section';
    soundSection.style.cssText = 'margin: 20px 0; padding: 20px; background: var(--card-bg, rgba(255,255,255,0.1)); border-radius: 16px;';
    soundSection.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h3 style="margin: 0 0 5px 0; font-size: 18px;">🎵 Sound Effects</h3>
                <p style="margin: 0; opacity: 0.7; font-size: 14px;">Play beep sounds when completing chores</p>
            </div>
            <label class="switch" style="position: relative; display: inline-block; width: 60px; height: 34px;">
                <input type="checkbox" id="sounds-toggle" ${soundsEnabled ? 'checked' : ''} 
                       style="opacity: 0; width: 0; height: 0;">
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; 
                             background-color: #ccc; transition: 0.4s; border-radius: 34px;
                             ${soundsEnabled ? 'background-color: #4CAF50;' : ''}"></span>
                <span style="position: absolute; content: ''; height: 26px; width: 26px; left: 4px; 
                             bottom: 4px; background-color: white; transition: 0.4s; border-radius: 50%;
                             ${soundsEnabled ? 'transform: translateX(26px);' : ''}"></span>
            </label>
        </div>
    `;
    
    const themeSection = settingsView.querySelector('.settings-section');
    if (themeSection) {
        themeSection.parentNode.insertBefore(soundSection, themeSection.nextSibling);
    } else {
        settingsView.appendChild(soundSection);
    }
    
    const toggle = document.getElementById('sounds-toggle');
    const slider = soundSection.querySelector('span');
    const sliderButton = soundSection.querySelectorAll('span')[1];
    
    toggle.addEventListener('change', function() {
        const enabled = this.checked;
        localStorage.setItem('sounds_enabled', enabled);
        slider.style.backgroundColor = enabled ? '#4CAF50' : '#ccc';
        sliderButton.style.transform = enabled ? 'translateX(26px)' : 'translateX(0)';
        if (enabled) playSound('click');
    });
}

// Call when settings view is shown
const originalShowSettings = window.showSettings || function() {};
window.showSettings = function() {
    originalShowSettings();
    setTimeout(addSoundToggle, 100);
};

console.log('🔊 Beep sound system loaded! No external files needed.');

// ============================================
// 🎊 ENHANCED CONFETTI
// ============================================

function triggerEnhancedConfetti() {
    const duration = 3000;
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    
    for (let i = 0; i < 100; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: ${Math.random() * 10 + 5}px;
                height: ${Math.random() * 10 + 5}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                top: -20px;
                left: ${Math.random() * 100}%;
                opacity: 1;
                pointer-events: none;
                z-index: 9999;
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                transform: rotate(${Math.random() * 360}deg);
            `;
            
            document.body.appendChild(confetti);
            
            const fallDuration = Math.random() * 2000 + 2000;
            const startLeft = parseFloat(confetti.style.left);
            const drift = (Math.random() - 0.5) * 100;
            
            confetti.animate([
                { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
                { transform: `translateY(${window.innerHeight + 20}px) translateX(${drift}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
            ], {
                duration: fallDuration,
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }).onfinish = () => confetti.remove();
            
        }, Math.random() * 500);
    }
    
    playSound('levelUp');
}

// Replace existing triggerConfetti
if (typeof window.triggerConfetti !== 'undefined') {
    window.triggerConfetti = triggerEnhancedConfetti;
}

// ============================================
// ✨ PARTICLE BURST (Theme Changes)
// ============================================

function createParticleBurst(color) {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        const size = Math.random() * 8 + 4;
        particle.style.cssText = `
            position: fixed;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border-radius: 50%;
            left: ${centerX}px;
            top: ${centerY}px;
            pointer-events: none;
            z-index: 9999;
        `;
        
        document.body.appendChild(particle);
        
        const angle = (Math.PI * 2 * i) / 30;
        const velocity = Math.random() * 200 + 100;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;
        
        particle.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
        ], {
            duration: 800,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }).onfinish = () => particle.remove();
    }
    
    playSound('swoosh');
}

// ============================================
// 🔥 BUTTON PRESS EFFECTS
// ============================================

function addButtonEffects() {
    const style = document.createElement('style');
    style.textContent = `
        .btn:active, button:active {
            transform: scale(0.95) !important;
            transition: transform 0.1s ease !important;
        }
        .btn, button {
            transition: all 0.2s ease !important;
        }
        .btn:hover, button:hover {
            transform: scale(1.05);
            filter: brightness(1.1);
        }
    `;
    if (!document.getElementById('button-effects-style')) {
        style.id = 'button-effects-style';
        document.head.appendChild(style);
    }
    
    // Add click sound to all buttons
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON' || e.target.classList.contains('btn')) {
            playSound('click');
        }
    });
}

// ============================================
// 💫 ANIMATED POINTS COUNTER
// ============================================

function animatePoints(element, start, end, duration = 1000) {
    const startTime = performance.now();
    const difference = end - start;
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        const current = Math.floor(start + (difference * easeProgress));
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = end;
        }
    }
    
    requestAnimationFrame(update);
}

// ============================================================================
// ANIMATION FUNCTIONS
// ============================================================================

// Global animation container
let currentAnimation = null;

// Clear any existing animation
function clearThemeAnimation() {
    if (currentAnimation) {
        currentAnimation.remove();
        currentAnimation = null;
    }
}

// 1. STARRY BACKGROUND (Space theme)
function createStarryBackground() {
    clearThemeAnimation();
    
    const container = document.createElement('div');
    container.className = 'theme-animation-layer';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
        overflow: hidden;
    `;
    
    // Create 50 stars
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.style.cssText = `
            position: absolute;
            width: ${Math.random() * 3 + 1}px;
            height: ${Math.random() * 3 + 1}px;
            background: white;
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            opacity: ${Math.random()};
            animation: twinkle ${Math.random() * 3 + 2}s ease-in-out infinite;
            box-shadow: 0 0 ${Math.random() * 10 + 5}px rgba(255, 255, 255, 0.8);
        `;
        container.appendChild(star);
    }
    
    // Add CSS animation for twinkling
    const style = document.createElement('style');
    style.textContent = `
        @keyframes twinkle {
            0%, 100% { opacity: 0.2; }
            50% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.getElementById('app-screen').appendChild(container);
    currentAnimation = container;
    console.log('⭐ Stars created!');
}

// 2. FLOATING BUBBLES (Ocean theme)
function createBubbles() {
    clearThemeAnimation();
    
    const container = document.createElement('div');
    container.className = 'theme-animation-layer';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
        overflow: hidden;
    `;
    
    // Create 30 bubbles
    for (let i = 0; i < 30; i++) {
        const bubble = document.createElement('div');
        const size = Math.random() * 40 + 20;
        const startLeft = Math.random() * 100;
        const drift = (Math.random() - 0.5) * 30; // Horizontal drift
        const duration = Math.random() * 5 + 8; // 8-13 seconds
        const delay = Math.random() * 5;
        
        bubble.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8), rgba(6, 182, 212, 0.3));
            border-radius: 50%;
            left: ${startLeft}%;
            bottom: -50px;
            opacity: 0.6;
            animation: floatUp ${duration}s ease-in ${delay}s infinite;
            box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.5);
        `;
        
        // Set CSS variable for drift
        bubble.style.setProperty('--drift', `${drift}%`);
        
        container.appendChild(bubble);
    }
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes floatUp {
            0% {
                transform: translateY(0) translateX(0);
                opacity: 0;
            }
            10% {
                opacity: 0.6;
            }
            90% {
                opacity: 0.6;
            }
            100% {
                transform: translateY(-100vh) translateX(var(--drift));
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.getElementById('app-screen').appendChild(container);
    currentAnimation = container;
    console.log('🫧 Bubbles created!');
}

// 3. FALLING SNOWFLAKES (Arctic theme)
function createSnowflakes() {
    clearThemeAnimation();
    
    const container = document.createElement('div');
    container.className = 'theme-animation-layer';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
        overflow: hidden;
    `;
    
    // Create 40 snowflakes
    for (let i = 0; i < 40; i++) {
        const snowflake = document.createElement('div');
        const size = Math.random() * 8 + 4;
        const startLeft = Math.random() * 100;
        const drift = (Math.random() - 0.5) * 40;
        const duration = Math.random() * 5 + 10; // 10-15 seconds
        const delay = Math.random() * 5;
        const rotation = Math.random() * 360;
        
        snowflake.innerHTML = '❄️';
        snowflake.style.cssText = `
            position: absolute;
            font-size: ${size}px;
            left: ${startLeft}%;
            top: -20px;
            opacity: ${Math.random() * 0.6 + 0.4};
            animation: snowfall ${duration}s linear ${delay}s infinite;
            transform: rotate(${rotation}deg);
            color: rgba(224, 242, 254, 0.9);
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.8);
        `;
        
        snowflake.style.setProperty('--drift', `${drift}%`);
        snowflake.style.setProperty('--rotation', `${Math.random() * 720 - 360}deg`);
        
        container.appendChild(snowflake);
    }
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes snowfall {
            0% {
                transform: translateY(0) translateX(0) rotate(0deg);
                opacity: 0;
            }
            10% {
                opacity: 0.8;
            }
            90% {
                opacity: 0.8;
            }
            100% {
                transform: translateY(100vh) translateX(var(--drift)) rotate(var(--rotation));
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.getElementById('app-screen').appendChild(container);
    currentAnimation = container;
    console.log('❄️ Snowflakes created!');
}

// 4. RISING EMBERS (Lava theme)
function createEmbers() {
    clearThemeAnimation();
    
    const container = document.createElement('div');
    container.className = 'theme-animation-layer';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
        overflow: hidden;
    `;
    
    // Create 35 embers
    for (let i = 0; i < 35; i++) {
        const ember = document.createElement('div');
        const size = Math.random() * 6 + 2;
        const startLeft = Math.random() * 100;
        const drift = (Math.random() - 0.5) * 20;
        const duration = Math.random() * 4 + 6; // 6-10 seconds
        const delay = Math.random() * 5;
        
        ember.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: radial-gradient(circle, #ff6b6b, #c92a2a);
            border-radius: 50%;
            left: ${startLeft}%;
            bottom: -20px;
            opacity: ${Math.random() * 0.6 + 0.4};
            animation: riseUp ${duration}s ease-out ${delay}s infinite;
            box-shadow: 0 0 ${size * 2}px rgba(255, 107, 107, 0.8);
            filter: blur(${Math.random() * 1}px);
        `;
        
        ember.style.setProperty('--drift', `${drift}%`);
        
        container.appendChild(ember);
    }
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes riseUp {
            0% {
                transform: translateY(0) translateX(0) scale(1);
                opacity: 0;
            }
            10% {
                opacity: 0.8;
            }
            50% {
                opacity: 0.6;
            }
            100% {
                transform: translateY(-100vh) translateX(var(--drift)) scale(0.3);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.getElementById('app-screen').appendChild(container);
    currentAnimation = container;
    console.log('🔥 Embers created!');
}

// 5. SPARKLES (Rainbow theme)
function createSparkles() {
    clearThemeAnimation();
    
    const container = document.createElement('div');
    container.className = 'theme-animation-layer';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
        overflow: hidden;
    `;
    
    const colors = ['#fa709a', '#fee140', '#30cfd0', '#a8edea', '#fed6e3'];
    
    // Create 50 sparkles
    for (let i = 0; i < 50; i++) {
        const sparkle = document.createElement('div');
        const size = Math.random() * 4 + 2;
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const duration = Math.random() * 2 + 1;
        const delay = Math.random() * 3;
        
        sparkle.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border-radius: 50%;
            left: ${left}%;
            top: ${top}%;
            opacity: 0;
            animation: sparkle ${duration}s ease-in-out ${delay}s infinite;
            box-shadow: 0 0 ${size * 3}px ${color};
        `;
        
        container.appendChild(sparkle);
    }
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes sparkle {
            0%, 100% { 
                opacity: 0;
                transform: scale(0);
            }
            50% { 
                opacity: 1;
                transform: scale(1.5);
            }
        }
    `;
    document.head.appendChild(style);
    
    document.getElementById('app-screen').appendChild(container);
    currentAnimation = container;
    console.log('✨ Sparkles created!');
}

// ============================================
// 🏜️ SAND ANIMATION (for Desert theme)
// ============================================
function createSandBlowing() {
    const container = document.getElementById('theme-animation-container') || createAnimationContainer();
    
    for (let i = 0; i < 30; i++) {
        const sand = document.createElement('div');
        const size = Math.random() * 3 + 1;
        const startX = Math.random() * 100;
        const duration = Math.random() * 4 + 3;
        const delay = Math.random() * 3;
        const opacity = Math.random() * 0.4 + 0.2;
        
        sand.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: rgba(194, 120, 46, ${opacity});
            border-radius: 50%;
            left: ${startX}%;
            bottom: -10px;
            animation: sandBlow ${duration}s ${delay}s infinite ease-in-out;
            pointer-events: none;
        `;
        
        container.appendChild(sand);
    }
    
    // Add keyframe animation if not exists
    if (!document.getElementById('sandBlowAnimation')) {
        const style = document.createElement('style');
        style.id = 'sandBlowAnimation';
        style.textContent = `
            @keyframes sandBlow {
                0% {
                    transform: translate(0, 0) rotate(0deg);
                    opacity: 0;
                }
                10% {
                    opacity: 1;
                }
                90% {
                    opacity: 1;
                }
                100% {
                    transform: translate(${Math.random() * 200 - 100}vw, -100vh) rotate(720deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    console.log('🏜️ Sand blowing animation created!');
}

// ============================================
// 🌌 AURORA BOREALIS (for Midnight theme)
// ============================================
function createAurora() {
    const container = document.getElementById('theme-animation-container') || createAnimationContainer();
    
    for (let i = 0; i < 3; i++) {
        const aurora = document.createElement('div');
        const hue = Math.random() * 60 + 200; // Blue to purple range
        const duration = Math.random() * 8 + 12;
        const delay = i * 2;
        
        aurora.style.cssText = `
            position: absolute;
            width: 100%;
            height: 40%;
            top: ${i * 20}%;
            left: 0;
            background: linear-gradient(90deg, 
                transparent 0%, 
                hsla(${hue}, 70%, 60%, 0.3) 25%,
                hsla(${hue + 40}, 70%, 60%, 0.4) 50%,
                hsla(${hue}, 70%, 60%, 0.3) 75%,
                transparent 100%);
            filter: blur(30px);
            animation: auroraWave ${duration}s ${delay}s infinite ease-in-out;
            pointer-events: none;
        `;
        
        container.appendChild(aurora);
    }
    
    if (!document.getElementById('auroraAnimation')) {
        const style = document.createElement('style');
        style.id = 'auroraAnimation';
        style.textContent = `
            @keyframes auroraWave {
                0%, 100% {
                    transform: translateX(-10%) scaleY(1);
                    opacity: 0.5;
                }
                50% {
                    transform: translateX(10%) scaleY(1.2);
                    opacity: 0.8;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    console.log('🌌 Aurora Borealis created!');
}

// ============================================
// 🍃 LEAVES (for Forest theme)
// ============================================
function createLeaves() {
    const container = document.getElementById('theme-animation-container') || createAnimationContainer();
    
    const leafShapes = ['🍃', '🍂', '🌿'];
    
    for (let i = 0; i < 20; i++) {
        const leaf = document.createElement('div');
        const shape = leafShapes[Math.floor(Math.random() * leafShapes.length)];
        const size = Math.random() * 20 + 15;
        const startX = Math.random() * 100;
        const duration = Math.random() * 8 + 8;
        const delay = Math.random() * 5;
        
        leaf.textContent = shape;
        leaf.style.cssText = `
            position: absolute;
            font-size: ${size}px;
            left: ${startX}%;
            top: -50px;
            animation: leafFall ${duration}s ${delay}s infinite ease-in-out;
            pointer-events: none;
            opacity: 0.7;
        `;
        
        container.appendChild(leaf);
    }
    
    if (!document.getElementById('leafAnimation')) {
        const style = document.createElement('style');
        style.id = 'leafAnimation';
        style.textContent = `
            @keyframes leafFall {
                0% {
                    transform: translateY(0) rotate(0deg) translateX(0);
                }
                25% {
                    transform: translateY(25vh) rotate(90deg) translateX(50px);
                }
                50% {
                    transform: translateY(50vh) rotate(180deg) translateX(-50px);
                }
                75% {
                    transform: translateY(75vh) rotate(270deg) translateX(30px);
                }
                100% {
                    transform: translateY(110vh) rotate(360deg) translateX(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    console.log('🍃 Leaves falling!');
}

// ============================================
// 🍬 CANDY SPRINKLES (for Candy theme)
// ============================================
function createCandySprinkles() {
    const container = document.getElementById('theme-animation-container') || createAnimationContainer();
    
    const candies = ['🍬', '🍭', '🍫', '🧁', '🍩', '🍪', '🎂'];
    
    for (let i = 0; i < 25; i++) {
        const candy = document.createElement('div');
        const shape = candies[Math.floor(Math.random() * candies.length)];
        const size = Math.random() * 25 + 20;
        const startX = Math.random() * 100;
        const duration = Math.random() * 4 + 3;
        const delay = Math.random() * 3;
        
        candy.textContent = shape;
        candy.style.cssText = `
            position: absolute;
            font-size: ${size}px;
            left: ${startX}%;
            top: -50px;
            animation: candyFall ${duration}s ${delay}s infinite linear;
            pointer-events: none;
        `;
        
        container.appendChild(candy);
    }
    
    if (!document.getElementById('candyAnimation')) {
        const style = document.createElement('style');
        style.id = 'candyAnimation';
        style.textContent = `
            @keyframes candyFall {
                0% {
                    transform: translateY(0) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translateY(110vh) rotate(720deg);
                    opacity: 0.8;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    console.log('🍬 Candy sprinkles raining!');
}

// ============================================
// 👾 8-BIT SPRITES (for Retro theme)
// ============================================
function createRetroSprites() {
    const container = document.getElementById('theme-animation-container') || createAnimationContainer();
    
    const sprites = ['👾', '🎮', '🕹️', '⭐', '🍄', '🧱', '👽', '🚀'];
    
    for (let i = 0; i < 15; i++) {
        const sprite = document.createElement('div');
        const shape = sprites[Math.floor(Math.random() * sprites.length)];
        const size = Math.random() * 30 + 25;
        const startY = Math.random() * 80;
        const duration = Math.random() * 15 + 10;
        const direction = Math.random() > 0.5 ? 1 : -1;
        
        sprite.textContent = shape;
        sprite.style.cssText = `
            position: absolute;
            font-size: ${size}px;
            left: ${direction > 0 ? '-50px' : '110%'};
            top: ${startY}%;
            animation: sprite8bit ${duration}s infinite linear;
            pointer-events: none;
            filter: contrast(1.2) saturate(1.5);
            image-rendering: pixelated;
        `;
        
        sprite.style.animationDirection = direction > 0 ? 'normal' : 'reverse';
        
        container.appendChild(sprite);
    }
    
    if (!document.getElementById('retroAnimation')) {
        const style = document.createElement('style');
        style.id = 'retroAnimation';
        style.textContent = `
            @keyframes sprite8bit {
                0% {
                    transform: translateX(0) translateY(0);
                }
                25% {
                    transform: translateX(30vw) translateY(-20px);
                }
                50% {
                    transform: translateX(60vw) translateY(20px);
                }
                75% {
                    transform: translateX(90vw) translateY(-10px);
                }
                100% {
                    transform: translateX(120vw) translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    console.log('👾 8-bit sprites activated!');
}

// ============================================
// 🦅 BIRDS FLYING (for Sunset theme)
// ============================================
function createBirds() {
    const container = document.getElementById('theme-animation-container') || createAnimationContainer();
    
    for (let i = 0; i < 8; i++) {
        const bird = document.createElement('div');
        const size = Math.random() * 30 + 20;
        const startY = Math.random() * 40 + 10;
        const duration = Math.random() * 20 + 15;
        const delay = Math.random() * 5;
        
        bird.textContent = '🦅';
        bird.style.cssText = `
            position: absolute;
            font-size: ${size}px;
            left: -50px;
            top: ${startY}%;
            animation: birdFly ${duration}s ${delay}s infinite linear;
            pointer-events: none;
        `;
        
        container.appendChild(bird);
    }
    
    if (!document.getElementById('birdAnimation')) {
        const style = document.createElement('style');
        style.id = 'birdAnimation';
        style.textContent = `
            @keyframes birdFly {
                0% {
                    transform: translateX(0) translateY(0) scale(1);
                }
                10% {
                    transform: translateX(10vw) translateY(-10px) scale(1.1);
                }
                20% {
                    transform: translateX(20vw) translateY(5px) scale(0.95);
                }
                30% {
                    transform: translateX(30vw) translateY(-8px) scale(1.05);
                }
                40% {
                    transform: translateX(40vw) translateY(3px) scale(0.9);
                }
                50% {
                    transform: translateX(50vw) translateY(-5px) scale(1);
                }
                60% {
                    transform: translateX(60vw) translateY(8px) scale(1.1);
                }
                70% {
                    transform: translateX(70vw) translateY(-12px) scale(0.95);
                }
                80% {
                    transform: translateX(80vw) translateY(4px) scale(1.05);
                }
                90% {
                    transform: translateX(90vw) translateY(-6px) scale(0.9);
                }
                100% {
                    transform: translateX(110vw) translateY(0) scale(0.8);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    console.log('🦅 Birds flying across sunset!');
}

// ============================================================================
// ENHANCED THEMES WITH ANIMATION FLAGS
// ============================================================================

const ENHANCED_THEMES = {
    space: {
        nameColor: '#818CF8',
        nameFont: 'techno',
        nameSize: 26,
        borderStyle: 'glow',
        borderWidth: 4,
        avatarBorderColor: '#6366F1',
        bgGradient: 'linear-gradient(135deg, #0c0a1d 0%, #1a0d2e 50%, #16003b 100%)',
        bgColor: '#0c0a1d',
        cardBg: '#FFFFFF',
        accentColor: '#818CF8',
        buttonColor: '#6366F1',
        stars: true  // ⭐ Animation flag
    },
    
    ocean: {
        nameColor: '#0891B2',
        nameFont: 'bubbly',
        nameSize: 28,
        borderStyle: 'glow',
        borderWidth: 3,
        avatarBorderColor: '#06B6D4',
        bgGradient: 'linear-gradient(135deg, #0c4a6e 0%, #0e7490 50%, #06b6d4 100%)',
        bgColor: '#0c4a6e',
        cardBg: '#FFFFFF',
        accentColor: '#0891B2',
        buttonColor: '#0891B2',
        bubbles: true  // 🫧 Animation flag
    },
    
    arctic: {
        nameColor: '#0EA5E9',
        nameFont: 'default',
        nameSize: 26,
        borderStyle: 'glow',
        borderWidth: 3,
        avatarBorderColor: '#38BDF8',
        bgGradient: 'linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0284c7 100%)',
        bgColor: '#0c4a6e',
        cardBg: '#FFFFFF',
        accentColor: '#0EA5E9',
        buttonColor: '#0284C7',
        snowflakes: true  // ❄️ Animation flag
    },
    
    lava: {
        nameColor: '#DC2626',
        nameFont: 'chunky',
        nameSize: 29,
        borderStyle: 'glow',
        borderWidth: 4,
        avatarBorderColor: '#EF4444',
        bgGradient: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #dc2626 100%)',
        bgColor: '#7f1d1d',
        cardBg: '#FFFFFF',
        accentColor: '#DC2626',
        buttonColor: '#B91C1C',
        embers: true  // 🔥 Animation flag
    },
    
    rainbow: {
        nameColor: '#EC4899',
        nameFont: 'comic',
        nameSize: 28,
        borderStyle: 'gradient',
        borderWidth: 4,
        avatarBorderColor: '#EC4899',
        bgGradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 25%, #30cfd0 50%, #a8edea 75%, #fed6e3 100%)',
        bgColor: '#fef3c7',
        cardBg: '#FFFFFF',
        accentColor: '#EC4899',
        buttonColor: '#DB2777',
        sparkles: true  // ✨ Animation flag
    },
    
    forest: {
        nameColor: '#10B981',
        nameFont: 'bold',
        nameSize: 28,
        borderStyle: 'solid',
        borderWidth: 3,
        avatarBorderColor: '#059669',
        bgGradient: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%)',
        bgColor: '#064e3b',
        cardBg: '#FFFFFF',
        accentColor: '#10B981',
        buttonColor: '#059669'
    },
    
    candy: {
        nameColor: '#EC4899',
        nameFont: 'bubbly',
        nameSize: 28,
        borderStyle: 'gradient',
        borderWidth: 4,
        avatarBorderColor: '#F472B6',
        bgGradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 50%, #ffecd2 100%)',
        bgColor: '#fdf2f8',
        cardBg: '#FFFFFF',
        accentColor: '#EC4899',
        buttonColor: '#F472B6'
    },
    
    midnight: {
        nameColor: '#C084FC',
        nameFont: 'fancy',
        nameSize: 26,
        borderStyle: 'glow',
        borderWidth: 3,
        avatarBorderColor: '#C084FC',
        bgGradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
        bgColor: '#1e1b4b',
        cardBg: '#FFFFFF',
        accentColor: '#C084FC',
        buttonColor: '#A855F7',
        textColor: '#E9D5FF'  // Light text for dark theme
    }
};

// Merge enhanced themes into existing themes
if (typeof window !== 'undefined' && window.themes) {
    Object.assign(window.themes, ENHANCED_THEMES);
    console.log('🎨 Enhanced themes with animations merged!');
} else if (typeof themes !== 'undefined') {
    Object.assign(themes, ENHANCED_THEMES);
    console.log('🎨 Enhanced themes with animations merged!');
}

// ============================================
// 🎯 INTEGRATION WITH EXISTING FUNCTIONS
// ============================================

// Wrap applyTheme to add effects
const originalApplyTheme = window.applyTheme || function() {};
window.applyTheme = function(themeName) {
    const themeObj = window.themes || themes || {};
    const theme = themeObj[themeName];
    if (theme) {
        createParticleBurst(theme.accentColor);
        
        // Clear any existing animation first
        clearThemeAnimation();
        
        // Check for theme animations
        if (theme.stars) {
            console.log('⭐ Creating starry background...');
            createStarryBackground();
        } else if (theme.bubbles) {
            console.log('🫧 Creating bubbles...');
            createBubbles();
        } else if (theme.snowflakes) {
            console.log('❄️ Creating snowflakes...');
            createSnowflakes();
        } else if (theme.embers) {
            console.log('🔥 Creating embers...');
            createEmbers();
        } else if (theme.sparkles) {
            console.log('✨ Creating sparkles...');
            createSparkles();
        }
    }
    
    return originalApplyTheme(themeName);
};

// Wrap submitChore to add sound
const originalSubmitChore = window.submitChore || function() {};
window.submitChore = async function(choreId, choreTitle) {
    const result = await originalSubmitChore(choreId, choreTitle);
    
    if (result && result.ok) {
        playSound('complete');
        if (result.data.status === 'approved' && result.data.points_awarded > 0) {
            playSound('points');
            
            // Animate points counter
            const pointsElements = document.querySelectorAll('[class*="points"]');
            pointsElements.forEach(el => {
                const currentPoints = parseInt(el.textContent);
                if (!isNaN(currentPoints)) {
                    animatePoints(el, currentPoints, currentPoints + result.data.points_awarded);
                }
            });
        }
    }
    
    return result;
};

// ============================================
// 🚀 INITIALIZATION
// ============================================

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎨 ChoreQuest Enhancements Loaded!');
    
    // Add button effects
    addButtonEffects();
    
    // Add sound toggle to settings
    setTimeout(addSoundToggle, 1000);
    
    // Check if any animated theme is active
    const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
    if (settings.themeName) {
        const themeObj = window.themes || themes || {};
        const currentTheme = themeObj[settings.themeName];
        if (currentTheme) {
            if (currentTheme.stars) createStarryBackground();
            else if (currentTheme.bubbles) createBubbles();
            else if (currentTheme.snowflakes) createSnowflakes();
            else if (currentTheme.embers) createEmbers();
            else if (currentTheme.sparkles) createSparkles();
        }
    }
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    addButtonEffects();
    
    const settings = JSON.parse(localStorage.getItem('kid_settings') || '{}');
    if (settings.themeName) {
        const themeObj = window.themes || themes || {};
        const currentTheme = themeObj[settings.themeName];
        if (currentTheme) {
            if (currentTheme.stars) createStarryBackground();
            else if (currentTheme.bubbles) createBubbles();
            else if (currentTheme.snowflakes) createSnowflakes();
            else if (currentTheme.embers) createEmbers();
            else if (currentTheme.sparkles) createSparkles();
        }
    }
}

console.log('🎉 Theme animations package loaded!');
console.log('📋 Available animations: stars, bubbles, snowflakes, embers, sparkles');

// ============================================
// 🎮 SHARED GAME VARIABLES - DECLARE ONCE!
// ============================================

let currentGame = 'stars';
let currentGameType = 'stars';

// Star Catcher variables
let gameActive = false;
let gameScore = 0;
let gameCombo = 0;
let gameDifficulty = 'easy';
let gameTimer = null;
let gameStartTime = null;
let starSpawnInterval = null;
let comboTimer = null;
let missedStars = 0;

// Math Quest variables
let mathGameActive = false;
let mathScore = 0;
let mathStreak = 0;
let mathDifficulty = 'easy';
let mathTimer = null;
let mathStartTime = null;
let mathCurrentProblem = null;
let mathCorrectAnswer = null;

// Beat Master variables
let musicGameActive = false;
let musicScore = 0;
let musicLevel = 1;
let musicDifficulty = 'easy';
let musicSequence = [];
let musicPlayerSequence = [];
let musicIsShowingSequence = false;
let musicCanPlay = false;

// Leaderboard variables
let currentPeriod = 'today';
let currentLeaderboardDifficulty = 'all';

// High scores (all games)
let gameHighScores = {
    stars: JSON.parse(localStorage.getItem('starCatcherHighScores') || '{"easy": 0, "medium": 0, "hard": 0}'),
    math: JSON.parse(localStorage.getItem('mathQuestHighScores') || '{"easy": 0, "medium": 0, "hard": 0}'),
    music: JSON.parse(localStorage.getItem('beatMasterHighScores') || '{"easy": 0, "medium": 0, "hard": 0}')
};

// Game constants
const GAME_DURATION = 30000;
const MATH_GAME_DURATION = 60000;

// ============================================
// 🎮 STAR CATCHER GAME
// ============================================

const DIFFICULTY_SETTINGS = {
    easy: {
        spawnInterval: 1000,
        fallSpeed: { min: 4, max: 6 },
        starSize: { min: 50, max: 70 },
        pointsPerStar: 10,
        comboMultiplier: 1.5
    },
    medium: {
        spawnInterval: 700,
        fallSpeed: { min: 3, max: 5 },
        starSize: { min: 40, max: 60 },
        pointsPerStar: 15,
        comboMultiplier: 2
    },
    hard: {
        spawnInterval: 500,
        fallSpeed: { min: 2, max: 4 },
        starSize: { min: 30, max: 50 },
        pointsPerStar: 25,
        comboMultiplier: 2.5
    }
};

// Load high score for current difficulty
updateHighScoreDisplay();

// Difficulty selector
document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        if (gameActive) return; // Can't change during game
        
        gameDifficulty = this.dataset.difficulty;
        
        // Update active state
        document.querySelectorAll('.difficulty-btn').forEach(b => {
            b.classList.remove('active');
            b.style.border = '2px solid #E5E7EB';
            b.style.background = 'white';
            b.style.color = '#6B7280';
        });
        
        this.classList.add('active');
        const colors = {
            easy: { border: '#10B981', bg: '#D1FAE5', text: '#065F46' },
            medium: { border: '#F59E0B', bg: '#FEF3C7', text: '#92400E' },
            hard: { border: '#EF4444', bg: '#FEE2E2', text: '#991B1B' }
        };
        
        this.style.border = `2px solid ${colors[gameDifficulty].border}`;
        this.style.background = colors[gameDifficulty].bg;
        this.style.color = colors[gameDifficulty].text;
        
        updateHighScoreDisplay();
        
        if (typeof playSound === 'function') {
            playSound('click');
        }
    });
});

// Start game button
document.getElementById('stars-start-btn').addEventListener('click', startGame);

function updateHighScoreDisplay() {
    document.getElementById('stars-high-score').textContent = gameHighScores.stars[gameDifficulty];
}

function startGame() {
    if (gameActive) return;
    
    gameActive = true;
    gameScore = 0;
    gameCombo = 0;
    missedStars = 0;
    gameStartTime = Date.now();
    
    document.getElementById('stars-score').textContent = '0';
    document.getElementById('stars-combo').textContent = '0x';
    document.getElementById('stars-game-over').style.display = 'none';
    document.getElementById('stars-start-btn').textContent = '⏱️ Game Running...';
    document.getElementById('stars-start-btn').disabled = true;
    document.getElementById('stars-difficulty-selector').style.opacity = '0.5';
    document.getElementById('stars-difficulty-selector').style.pointerEvents = 'none';    
    // Clear any existing stars
    const container = document.getElementById('stars-container');
    Array.from(container.children).forEach(child => {
        if (child.id !== 'stars-timer-bar') child.remove();
    });
    
    // Play sound
    if (typeof playSound === 'function') {
        playSound('click');
    }
    
    // Update timer bar
    updateTimerBar();
    
    // Spawn stars based on difficulty
    const settings = DIFFICULTY_SETTINGS[gameDifficulty];
    starSpawnInterval = setInterval(() => spawnStar(settings), settings.spawnInterval);
    
    // Game timer
    gameTimer = setTimeout(() => {
        endGame();
    }, GAME_DURATION);
}

function updateTimerBar() {
    if (!gameActive) return;
    
    const elapsed = Date.now() - gameStartTime;
    const remaining = Math.max(0, GAME_DURATION - elapsed);
    const percentage = (remaining / GAME_DURATION) * 100;
    
    const timerBar = document.getElementById('stars-timer-bar');
    timerBar.style.width = percentage + '%';
    
    // Change color as time runs out
    if (percentage < 25) {
        timerBar.style.background = '#EF4444';
    } else if (percentage < 50) {
        timerBar.style.background = '#F59E0B';
    } else {
        timerBar.style.background = '#10B981';
    }
    
    if (gameActive) {
        requestAnimationFrame(updateTimerBar);
    }
}

function spawnStar(settings) {
    if (!gameActive) return;
    
    const container = document.getElementById('stars-container');
    const star = document.createElement('div');
    
    // Random star types with different values
    const starTypes = [
        { emoji: '⭐', multiplier: 1 },
        { emoji: '🌟', multiplier: 1.5 },
        { emoji: '💫', multiplier: 2 }
    ];
    
    const randomType = starTypes[Math.floor(Math.random() * starTypes.length)];
    const size = Math.random() * (settings.starSize.max - settings.starSize.min) + settings.starSize.min;
    const left = Math.random() * (container.offsetWidth - size);
    const fallDuration = Math.random() * (settings.fallSpeed.max - settings.fallSpeed.min) + settings.fallSpeed.min;
    
    star.textContent = randomType.emoji;
    star.dataset.multiplier = randomType.multiplier;
    star.style.cssText = `
        position: absolute;
        font-size: ${size}px;
        left: ${left}px;
        top: -${size}px;
        cursor: pointer;
        user-select: none;
        transition: top ${fallDuration}s linear;
        filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.8));
        animation: starTwinkle 0.5s infinite alternate;
        z-index: 10;
    `;
    
    // Star twinkle animation
    if (!document.getElementById('starTwinkleAnimation')) {
        const style = document.createElement('style');
        style.id = 'starTwinkleAnimation';
        style.textContent = `
            @keyframes starTwinkle {
                0% { transform: scale(1) rotate(0deg); }
                100% { transform: scale(1.2) rotate(15deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Click handler
    star.addEventListener('click', function() {
        catchStar(this, settings);
    });
    
    container.appendChild(star);
    
    // Start falling
    setTimeout(() => {
        star.style.top = `${container.offsetHeight + 50}px`;
    }, 10);
    
    // Remove star after it falls (count as miss)
    setTimeout(() => {
        if (star.parentNode && gameActive) {
            missedStars++;
            gameCombo = 0; // Break combo
            document.getElementById('stars-combo').textContent = '0x';
            star.remove();
        }
    }, fallDuration * 1000 + 100);
}

function catchStar(starElement, settings) {
    if (!gameActive) return;
    
    const multiplier = parseFloat(starElement.dataset.multiplier);
    
    // Increase combo
    gameCombo++;
    const comboMultiplier = gameCombo >= 3 ? settings.comboMultiplier : 1;
    
    // Calculate points
    const basePoints = settings.pointsPerStar * multiplier;
    const totalPoints = Math.floor(basePoints * comboMultiplier);
    
    gameScore += totalPoints;
    document.getElementById('stars-score').textContent = gameScore;
    document.getElementById('stars-combo').textContent = gameCombo + 'x';
    
    // Reset combo timer
    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(() => {
        gameCombo = 0;
        document.getElementById('stars-combo').textContent = '0x';
    }, 1500);
    
    // Visual feedback
    starElement.style.transition = 'all 0.3s ease-out';
    starElement.style.transform = 'scale(2) rotate(360deg)';
    starElement.style.opacity = '0';
    
    // Show points
    showFloatingPoints(starElement.offsetLeft + starElement.offsetWidth / 2, 
                      starElement.offsetTop + starElement.offsetHeight / 2, 
                      `+${totalPoints}`);
    
    // Play sound
    if (typeof playSound === 'function') {
        playSound('click');
    }
    
    // Create sparkle effect
    createSparkleEffect(starElement.offsetLeft + starElement.offsetWidth / 2, 
                        starElement.offsetTop + starElement.offsetHeight / 2);
    
    // Remove star
    setTimeout(() => {
        if (starElement.parentNode) {
            starElement.remove();
        }
    }, 300);
}

function showFloatingPoints(x, y, text) {
    const container = document.getElementById('stars-container');
    const points = document.createElement('div');
    
    points.textContent = text;
    points.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        font-size: 24px;
        font-weight: bold;
        color: #FCD34D;
        pointer-events: none;
        animation: floatUp 1s ease-out forwards;
        z-index: 100;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
    `;
    
    container.appendChild(points);
    
    if (!document.getElementById('floatUpAnimation')) {
        const style = document.createElement('style');
        style.id = 'floatUpAnimation';
        style.textContent = `
            @keyframes floatUp {
                0% {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }
                100% {
                    transform: translateY(-100px) scale(1.5);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(() => points.remove(), 1000);
}

function createSparkleEffect(x, y) {
    const container = document.getElementById('stars-container');
    
    for (let i = 0; i < 8; i++) {
        const sparkle = document.createElement('div');
        const angle = (Math.PI * 2 * i) / 8;
        const distance = 50;
        
        sparkle.textContent = '✨';
        sparkle.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            font-size: 20px;
            pointer-events: none;
            animation: sparkleOut 0.6s ease-out forwards;
            z-index: 50;
        `;
        
        sparkle.style.setProperty('--angle-x', Math.cos(angle) * distance + 'px');
        sparkle.style.setProperty('--angle-y', Math.sin(angle) * distance + 'px');
        
        container.appendChild(sparkle);
        
        setTimeout(() => sparkle.remove(), 600);
    }
    
    if (!document.getElementById('sparkleOutAnimation')) {
        const style = document.createElement('style');
        style.id = 'sparkleOutAnimation';
        style.textContent = `
            @keyframes sparkleOut {
                0% {
                    transform: translate(0, 0) scale(1);
                    opacity: 1;
                }
                100% {
                    transform: translate(var(--angle-x), var(--angle-y)) scale(0);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

function endGame() {
    gameActive = false;
    clearInterval(starSpawnInterval);
    clearTimeout(gameTimer);
    clearTimeout(comboTimer);
    
    // Show final score
    document.getElementById('stars-final-score').textContent = gameScore;
    document.getElementById('stars-game-over').style.display = 'block';
    
    // Check high score
    const highScoreMsg = document.getElementById('stars-high-score-msg');
    const oldHighScore = gameHighScores.stars[gameDifficulty]; // ✅ FIX: Access stars property
    
    if (gameScore > oldHighScore) {
        gameHighScores.stars[gameDifficulty] = gameScore; // ✅ FIX: Update stars property
        localStorage.setItem('starCatcherHighScores', JSON.stringify(gameHighScores.stars)); // ✅ FIX: Save stars object
        updateHighScoreDisplay();
        
        // Celebration!
        highScoreMsg.innerHTML = '🎉 NEW RECORD! 🎉<br>Previous best: ' + oldHighScore; // Show OLD score
        
        if (typeof playSound === 'function') {
            playSound('points');
        }
    } else {
        highScoreMsg.innerHTML = 'Best score: ' + gameHighScores.stars[gameDifficulty]; // ✅ FIX: Access stars property
    }
    
    // Save score to server with game type
    saveScoreToServer(gameScore, gameDifficulty, 'stars'); // ✅ FIX: Add 'stars' parameter
    
    // Reset button
    document.getElementById('stars-start-btn').textContent = '🎮 Play Again';
    document.getElementById('stars-start-btn').disabled = false;
    document.getElementById('stars-difficulty-selector').style.opacity = '1';
    document.getElementById('stars-difficulty-selector').style.pointerEvents = 'auto';
    
    // Clear remaining stars
    setTimeout(() => {
        const container = document.getElementById('stars-container');
        Array.from(container.children).forEach(child => {
            if (child.id !== 'stars-timer-bar') child.remove();
        });
    }, 1000);
}
console.log('🎮 Star Catcher Game Enhanced loaded!');

async function saveScoreToServer(score, difficulty) {
    console.log('💾 Attempting to save score:', { score, difficulty });
    
    try {
        const result = await apiCall('submit_game_score', {
            score: score,
            difficulty: difficulty
        });
        
        console.log('📡 Server response:', result);
        
        if (result.ok) {
            console.log('✅ Score saved to server!');
        } else {
            console.error('❌ Failed to save score:', result.error);
            // Show error to user
            alert('Score not saved: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('❌ Error saving score:', error);
        alert('Error saving score: ' + error.message);
    }
}



// Period filter buttons
document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        currentPeriod = this.dataset.period;
        
        // Update button styles
        document.querySelectorAll('.period-btn').forEach(b => {
            b.classList.remove('active');
            b.style.border = '2px solid #E5E7EB';
            b.style.background = 'white';
            b.style.color = '#6B7280';
        });
        
        this.classList.add('active');
        this.style.border = '2px solid #4F46E5';
        this.style.background = '#EEF2FF';
        this.style.color = '#4F46E5';
        
        loadLeaderboard();
        
        if (typeof playSound === 'function') {
            playSound('click');
        }
    });
});

// Leaderboard difficulty filter
document.querySelectorAll('.leaderboard-difficulty-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        currentLeaderboardDifficulty = this.dataset.difficulty;
        
        // Update button styles
        document.querySelectorAll('.leaderboard-difficulty-btn').forEach(b => {
            b.classList.remove('active');
            b.style.border = '2px solid #E5E7EB';
            b.style.background = 'white';
            b.style.color = '#6B7280';
        });
        
        this.classList.add('active');
        this.style.border = '2px solid #10B981';
        this.style.background = '#D1FAE5';
        this.style.color = '#065F46';
        
        loadLeaderboard();
        
        if (typeof playSound === 'function') {
            playSound('click');
        }
    });
});

async function loadLeaderboard() {
    console.log('🏆 Loading leaderboard:', { period: currentPeriod, difficulty: currentLeaderboardDifficulty });
    
    const result = await apiCall('get_leaderboard', {
        period: currentPeriod,
        difficulty: currentLeaderboardDifficulty
    });
    
    console.log('📡 Leaderboard response:', result);
    
    const container = document.getElementById('leaderboard-list');
    
    if (result.ok && result.data && result.data.length > 0) {
        console.log('✅ Found', result.data.length, 'leaderboard entries');
        const medals = ['🥇', '🥈', '🥉'];
        
        const html = result.data.map((entry, index) => {
            const medal = index < 3 ? medals[index] : `<span style="color: #9CA3AF; font-weight: bold;">#${index + 1}</span>`;
            const difficultyBadge = currentLeaderboardDifficulty === 'all' 
                ? `<span style="padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; background: ${
                    entry.difficulty === 'easy' ? '#D1FAE5' : entry.difficulty === 'medium' ? '#FEF3C7' : '#FEE2E2'
                  }; color: ${
                    entry.difficulty === 'easy' ? '#065F46' : entry.difficulty === 'medium' ? '#92400E' : '#991B1B'
                  };">${entry.difficulty}</span>`
                : '';
            
            return `
                <div style="display: flex; align-items: center; padding: 15px; margin-bottom: 10px; background: rgba(255,255,255,0.8); border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <div style="font-size: 24px; margin-right: 15px; min-width: 40px; text-align: center;">
                        ${medal}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 16px; color: #1F2937;">${entry.kid_name}</div>
                        <div style="font-size: 12px; color: #6B7280;">${difficultyBadge}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; font-size: 20px; color: #4F46E5;">${entry.best_score}</div>
                        <div style="font-size: 11px; color: #9CA3AF;">points</div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    } else {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6B7280;">
                <div style="font-size: 48px; margin-bottom: 10px;">🎮</div>
                <p>No scores yet for this period!</p>
                <p style="font-size: 14px; margin-top: 10px;">Be the first to play!</p>
            </div>
        `;
    }
    
    // Reapply theme
    reapplyCurrentTheme();
}

console.log('🏆 Leaderboard loaded!');

// Add this temporarily at the end of kid.js
async function testApiSession() {
    console.log('🔍 Testing API session...');
    
    // Test kid_me endpoint
    const meResult = await apiCall('kid_me');
    console.log('kid_me result:', meResult);
    
    // Test submit_game_score
    const scoreResult = await apiCall('submit_game_score', {
        score: 100,
        difficulty: 'easy'
    });
    console.log('submit_game_score result:', scoreResult);
}

// Call it on page load
setTimeout(() => {
    testApiSession();
}, 2000);

// ============================================
// 🎮 MULTI-GAME SYSTEM
// ============================================

// Game selector buttons
document.querySelectorAll('.game-selector-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const game = this.dataset.game;
        
        // Update button styles
        document.querySelectorAll('.game-selector-btn').forEach(b => {
            b.style.border = '2px solid #E5E7EB';
            b.style.background = 'white';
            b.style.color = '#6B7280';
            b.classList.remove('active');
        });
        
        this.style.border = '2px solid #4F46E5';
        this.style.background = '#EEF2FF';
        this.style.color = '#4F46E5';
        this.classList.add('active');
        
        // Show appropriate game
        document.querySelectorAll('.game-content').forEach(content => {
            content.style.display = 'none';
        });
        
        if (game === 'leaderboard') {
            document.getElementById('game-leaderboard').style.display = 'block';
            loadLeaderboard();
        } else {
            document.getElementById(`game-${game}`).style.display = 'block';
            currentGame = game;
        }
        
        if (typeof playSound === 'function') {
            playSound('click');
        }
    });
});

// Update difficulty buttons to work with all games
document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        if (gameActive || mathGameActive || musicGameActive) return;
        
        const game = this.dataset.game;
        const difficulty = this.dataset.difficulty;
        
        // Update only buttons for this game
        document.querySelectorAll(`.difficulty-btn[data-game="${game}"]`).forEach(b => {
            b.classList.remove('active');
            b.style.border = '2px solid #E5E7EB';
            b.style.background = 'white';
            b.style.color = '#6B7280';
        });
        
        const colors = {
            easy: { border: '#10B981', bg: '#D1FAE5', text: '#065F46' },
            medium: { border: '#F59E0B', bg: '#FEF3C7', text: '#92400E' },
            hard: { border: '#EF4444', bg: '#FEE2E2', text: '#991B1B' }
        };
        
        this.classList.add('active');
        this.style.border = `2px solid ${colors[difficulty].border}`;
        this.style.background = colors[difficulty].bg;
        this.style.color = colors[difficulty].text;
        
        // Update difficulty for appropriate game
        if (game === 'stars') {
            gameDifficulty = difficulty;
            document.getElementById('stars-high-score').textContent = gameHighScores.stars[difficulty];
        } else if (game === 'math') {
            mathDifficulty = difficulty;
            document.getElementById('math-high-score').textContent = gameHighScores.math[difficulty];
        } else if (game === 'music') {
            musicDifficulty = difficulty;
            document.getElementById('music-high-score').textContent = gameHighScores.music[difficulty];
        }
        
        if (typeof playSound === 'function') {
            playSound('click');
        }
    });
});

// Update saveScoreToServer to include game type
async function saveScoreToServer(score, difficulty, gameType = 'stars') {
    console.log('💾 Attempting to save score:', { score, difficulty, gameType });
    
    try {
        const result = await apiCall('submit_game_score', {
            score: score,
            difficulty: difficulty,
            game_type: gameType
        });
        
        console.log('📡 Server response:', result);
        
        if (result.ok) {
            console.log('✅ Score saved to server!');
        } else {
            console.error('❌ Failed to save score:', result.error);
        }
    } catch (error) {
        console.error('❌ Error saving score:', error);
    }
}

// Update original endGame to pass game type
const originalEndGame = endGame;
endGame = function() {
    originalEndGame();
    saveScoreToServer(gameScore, gameDifficulty, 'stars');
};

console.log('🎮 Multi-game system loaded!');

// ============================================
// 🧮 MATH QUEST GAME
// ============================================

const MATH_SETTINGS = {
    easy: {
        operations: ['+', '-'],
        range: { min: 1, max: 10 },
        pointsPerCorrect: 10
    },
    medium: {
        operations: ['+', '-', '×'],
        range: { min: 1, max: 20 },
        pointsPerCorrect: 15
    },
    hard: {
        operations: ['+', '-', '×', '÷'],
        range: { min: 1, max: 50 },
        pointsPerCorrect: 25
    }
};

// Start button
const mathStartBtn = document.getElementById('math-start-btn');
if (mathStartBtn) {
    mathStartBtn.addEventListener('click', startMathGame);
}

function startMathGame() {
    if (mathGameActive) return;
    
    mathGameActive = true;
    mathScore = 0;
    mathStreak = 0;
    mathStartTime = Date.now();
    
    document.getElementById('math-score').textContent = '0';
    document.getElementById('math-streak').textContent = '0🔥';
    document.getElementById('math-game-over').style.display = 'none';
    document.getElementById('math-start-btn').textContent = '⏱️ Game Running...';
    document.getElementById('math-start-btn').disabled = true;
    document.getElementById('math-difficulty-selector').style.opacity = '0.5';
    document.getElementById('math-difficulty-selector').style.pointerEvents = 'none';
    
    if (typeof playSound === 'function') {
        playSound('click');
    }
    
    // Update timer
    updateMathTimerBar();
    
    // Show first problem
    generateMathProblem();
    
    // Game timer
    mathTimer = setTimeout(() => {
        endMathGame();
    }, MATH_GAME_DURATION);
}

function updateMathTimerBar() {
    if (!mathGameActive) return;
    
    const elapsed = Date.now() - mathStartTime;
    const remaining = Math.max(0, MATH_GAME_DURATION - elapsed);
    const percentage = (remaining / MATH_GAME_DURATION) * 100;
    
    const timerBar = document.getElementById('math-timer-bar');
    if (timerBar) {
        timerBar.style.width = percentage + '%';
        
        if (percentage < 25) {
            timerBar.style.background = '#EF4444';
        } else if (percentage < 50) {
            timerBar.style.background = '#F59E0B';
        } else {
            timerBar.style.background = '#10B981';
        }
    }
    
    if (mathGameActive) {
        requestAnimationFrame(updateMathTimerBar);
    }
}

function generateMathProblem() {
    const settings = MATH_SETTINGS[mathDifficulty];
    const operation = settings.operations[Math.floor(Math.random() * settings.operations.length)];
    
    let num1, num2, answer;
    
    switch (operation) {
        case '+':
            num1 = Math.floor(Math.random() * (settings.range.max - settings.range.min + 1)) + settings.range.min;
            num2 = Math.floor(Math.random() * (settings.range.max - settings.range.min + 1)) + settings.range.min;
            answer = num1 + num2;
            break;
        case '-':
            num1 = Math.floor(Math.random() * (settings.range.max - settings.range.min + 1)) + settings.range.min;
            num2 = Math.floor(Math.random() * num1) + 1; // Ensure positive result
            answer = num1 - num2;
            break;
        case '×':
            num1 = Math.floor(Math.random() * 12) + 1;
            num2 = Math.floor(Math.random() * 12) + 1;
            answer = num1 * num2;
            break;
        case '÷':
            // Generate division that results in whole number
            num2 = Math.floor(Math.random() * 10) + 2;
            answer = Math.floor(Math.random() * 10) + 1;
            num1 = num2 * answer;
            break;
    }
    
    mathCorrectAnswer = answer;
    mathCurrentProblem = { num1, num2, operation };
    
    // Display problem
    document.getElementById('math-problem').textContent = `${num1} ${operation} ${num2} = ?`;
    
    // Generate answer options
    generateMathAnswers(answer);
}

function generateMathAnswers(correctAnswer) {
    const answers = [correctAnswer];
    
    // Generate 3 wrong answers
    while (answers.length < 4) {
        let wrongAnswer;
        if (mathDifficulty === 'easy') {
            wrongAnswer = correctAnswer + Math.floor(Math.random() * 10) - 5;
        } else if (mathDifficulty === 'medium') {
            wrongAnswer = correctAnswer + Math.floor(Math.random() * 20) - 10;
        } else {
            wrongAnswer = correctAnswer + Math.floor(Math.random() * 30) - 15;
        }
        
        if (wrongAnswer > 0 && !answers.includes(wrongAnswer)) {
            answers.push(wrongAnswer);
        }
    }
    
    // Shuffle answers
    for (let i = answers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [answers[i], answers[j]] = [answers[j], answers[i]];
    }
    
    // Create answer buttons
    const container = document.getElementById('math-answers');
    container.innerHTML = '';
    
    answers.forEach(answer => {
        const btn = document.createElement('button');
        btn.textContent = answer;
        btn.style.cssText = `
            padding: 20px;
            font-size: 32px;
            font-weight: bold;
            background: white;
            border: 3px solid #10B981;
            border-radius: 16px;
            cursor: pointer;
            transition: all 0.2s;
            color: #065F46;
        `;
        
        btn.addEventListener('click', () => checkMathAnswer(answer, btn));
        
        container.appendChild(btn);
    });
}

function checkMathAnswer(selectedAnswer, button) {
    if (!mathGameActive) return;
    
    const settings = MATH_SETTINGS[mathDifficulty];
    
    if (selectedAnswer === mathCorrectAnswer) {
        // Correct!
        mathStreak++;
        const streakBonus = mathStreak >= 3 ? Math.floor(mathStreak / 3) * 5 : 0;
        const points = settings.pointsPerCorrect + streakBonus;
        mathScore += points;
        
        document.getElementById('math-score').textContent = mathScore;
        document.getElementById('math-streak').textContent = mathStreak + '🔥';
        
        // Visual feedback
        button.style.background = '#10B981';
        button.style.color = 'white';
        button.style.transform = 'scale(1.1)';
        
        if (typeof playSound === 'function') {
            playSound('points');
        }
        
        // Show points gained
        showMathFeedback('+' + points, true);
        
        // Next problem after short delay
        setTimeout(() => {
            generateMathProblem();
        }, 500);
        
    } else {
        // Wrong!
        mathStreak = 0;
        document.getElementById('math-streak').textContent = '0🔥';
        
        // Visual feedback
        button.style.background = '#EF4444';
        button.style.color = 'white';
        button.style.transform = 'scale(0.9)';
        
        if (typeof playSound === 'function') {
            playSound('click');
        }
        
        showMathFeedback('Wrong! Try again', false);
        
        // Show correct answer briefly
        Array.from(document.getElementById('math-answers').children).forEach(btn => {
            if (parseInt(btn.textContent) === mathCorrectAnswer) {
                btn.style.background = '#10B981';
                btn.style.color = 'white';
            }
        });
        
        // Next problem after delay
        setTimeout(() => {
            generateMathProblem();
        }, 1500);
    }
}

function showMathFeedback(text, isCorrect) {
    const feedback = document.createElement('div');
    feedback.textContent = text;
    feedback.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 36px;
        font-weight: bold;
        color: ${isCorrect ? '#10B981' : '#EF4444'};
        background: white;
        padding: 20px 40px;
        border-radius: 20px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        z-index: 1000;
        animation: mathFeedbackPop 0.5s ease-out;
    `;
    
    document.body.appendChild(feedback);
    
    if (!document.getElementById('mathFeedbackAnimation')) {
        const style = document.createElement('style');
        style.id = 'mathFeedbackAnimation';
        style.textContent = `
            @keyframes mathFeedbackPop {
                0% {
                    transform: translate(-50%, -50%) scale(0);
                    opacity: 0;
                }
                50% {
                    transform: translate(-50%, -50%) scale(1.2);
                }
                100% {
                    transform: translate(-50%, -50%) scale(1);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(() => feedback.remove(), 800);
}

function endMathGame() {
    mathGameActive = false;
    clearTimeout(mathTimer);
    
    // Show final score
    document.getElementById('math-final-score').textContent = mathScore;
    document.getElementById('math-game-over').style.display = 'block';
    
    // Check high score
    const highScoreMsg = document.getElementById('math-high-score-msg');
    const oldHighScore = gameHighScores.math[mathDifficulty];
    
    if (mathScore > oldHighScore) {
        gameHighScores.math[mathDifficulty] = mathScore;
        localStorage.setItem('mathQuestHighScores', JSON.stringify(gameHighScores.math));
        document.getElementById('math-high-score').textContent = mathScore;
        
        highScoreMsg.innerHTML = '🎉 NEW RECORD! 🎉<br>Previous best: ' + oldHighScore;
        
        if (typeof playSound === 'function') {
            playSound('points');
        }
    } else {
        highScoreMsg.innerHTML = 'Best score: ' + oldHighScore;
    }
    
    // Save to server
    saveScoreToServer(mathScore, mathDifficulty, 'math');
    
    // Reset button
    document.getElementById('math-start-btn').textContent = '🧮 Play Again';
    document.getElementById('math-start-btn').disabled = false;
    document.getElementById('math-difficulty-selector').style.opacity = '1';
    document.getElementById('math-difficulty-selector').style.pointerEvents = 'auto';
    
    // Clear problem
    document.getElementById('math-problem').textContent = 'Great job!';
    document.getElementById('math-answers').innerHTML = '';
}

console.log('🧮 Math Quest loaded!');

// ============================================
// 🎵 BEAT MASTER GAME (Musical Memory)
// ============================================

const MUSIC_SETTINGS = {
    easy: {
        speedMs: 800,
        pointsPerLevel: 10,
        colors: 4
    },
    medium: {
        speedMs: 600,
        pointsPerLevel: 15,
        colors: 4
    },
    hard: {
        speedMs: 400,
        pointsPerLevel: 25,
        colors: 4
    }
};

// Musical notes for each color (C major scale)
const MUSIC_NOTES = {
    red: { frequency: 261.63, note: 'C' },    // C4
    blue: { frequency: 329.63, note: 'E' },   // E4
    green: { frequency: 392.00, note: 'G' },  // G4
    yellow: { frequency: 440.00, note: 'A' }  // A4
};

// Start button
const musicStartBtn = document.getElementById('music-start-btn');
if (musicStartBtn) {
    musicStartBtn.addEventListener('click', startMusicGame);
}

// Music pad buttons
// Music pad buttons
const musicPads = document.querySelectorAll('.music-pad');
if (musicPads.length > 0) {
    musicPads.forEach(pad => {
        pad.addEventListener('click', function() {
            if (musicCanPlay) {
            const color = this.dataset.color;
            playMusicPad(color, true);
            musicPlayerSequence.push(color);
            checkMusicSequence();
        }
    });
});
}

function startMusicGame() {
    if (musicGameActive) return;
    
    musicGameActive = true;
    musicScore = 0;
    musicLevel = 1;
    musicSequence = [];
    musicPlayerSequence = [];
    
    document.getElementById('music-score').textContent = '0';
    document.getElementById('music-level').textContent = '1';
    document.getElementById('music-game-over').style.display = 'none';
    document.getElementById('music-start-btn').textContent = '⏱️ Playing...';
    document.getElementById('music-start-btn').disabled = true;
    document.getElementById('music-difficulty-selector').style.opacity = '0.5';
    document.getElementById('music-difficulty-selector').style.pointerEvents = 'none';
    
    if (typeof playSound === 'function') {
        playSound('click');
    }
    
    // Start first round
    setTimeout(() => {
        nextMusicRound();
    }, 1000);
}

function nextMusicRound() {
    musicPlayerSequence = [];
    
    // Add new color to sequence
    const colors = ['red', 'blue', 'green', 'yellow'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    musicSequence.push(randomColor);
    
    // Update level display
    document.getElementById('music-level').textContent = musicLevel;
    
    // Show sequence
    showMusicSequence();
}

async function showMusicSequence() {
    musicIsShowingSequence = true;
    musicCanPlay = false;
    
    document.getElementById('music-status').textContent = 'Watch and remember! 👀';
    document.getElementById('music-status').style.background = 'rgba(139, 92, 246, 0.1)';
    document.getElementById('music-status').style.color = '#8B5CF6';
    
    const settings = MUSIC_SETTINGS[musicDifficulty];
    
    // Wait a moment before starting
    await sleep(500);
    
    // Play each color in sequence
    for (let i = 0; i < musicSequence.length; i++) {
        await playMusicPad(musicSequence[i], false);
        await sleep(settings.speedMs);
    }
    
    // Now player's turn
    musicIsShowingSequence = false;
    musicCanPlay = true;
    
    document.getElementById('music-status').textContent = 'Your turn! Repeat the pattern 🎯';
    document.getElementById('music-status').style.background = 'rgba(16, 185, 129, 0.1)';
    document.getElementById('music-status').style.color = '#10B981';
}

function playMusicPad(color, isPlayerInput) {
    return new Promise(resolve => {
        const pad = document.querySelector(`.music-pad[data-color="${color}"]`);
        
        // Visual feedback
        pad.style.transform = 'scale(0.9)';
        pad.style.filter = 'brightness(1.5)';
        
        // Play sound
        playMusicNote(MUSIC_NOTES[color].frequency);
        
        setTimeout(() => {
            pad.style.transform = 'scale(1)';
            pad.style.filter = 'brightness(1)';
            resolve();
        }, 300);
    });
}

// Create ONE shared audio context for the music game (at the top of the music section)
let sharedMusicAudioContext = null;

function playMusicNote(frequency) {
    // Use existing beep system if available
    if (typeof playSound === 'function') {
        playSound('click');
    }
    
    // Play actual musical note with proper cleanup
    try {
        // Create context once and reuse it
        if (!sharedMusicAudioContext) {
            sharedMusicAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const oscillator = sharedMusicAudioContext.createOscillator();
        const gainNode = sharedMusicAudioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(sharedMusicAudioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, sharedMusicAudioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, sharedMusicAudioContext.currentTime + 0.3);
        
        oscillator.start(sharedMusicAudioContext.currentTime);
        oscillator.stop(sharedMusicAudioContext.currentTime + 0.3);
        
        // Clean up after the note finishes
        oscillator.onended = () => {
            oscillator.disconnect();
            gainNode.disconnect();
        };
        
    } catch (e) {
        console.log('🔇 Web Audio error (silently ignored):', e.message);
        // Don't crash the game, just skip this note
    }
}

function checkMusicSequence() {
    const currentIndex = musicPlayerSequence.length - 1;
    
    // Check if current input is correct
    if (musicPlayerSequence[currentIndex] !== musicSequence[currentIndex]) {
        // Wrong!
        endMusicGame(false);
        return;
    }
    
    // Check if player completed the sequence
    if (musicPlayerSequence.length === musicSequence.length) {
        // Correct! Level complete
        musicCanPlay = false;
        
        const settings = MUSIC_SETTINGS[musicDifficulty];
        musicScore += settings.pointsPerLevel * musicLevel;
        musicLevel++;
        
        document.getElementById('music-score').textContent = musicScore;
        
        document.getElementById('music-status').textContent = '✅ Correct! Next level...';
        document.getElementById('music-status').style.background = 'rgba(16, 185, 129, 0.2)';
        document.getElementById('music-status').style.color = '#10B981';
        
        if (typeof playSound === 'function') {
            playSound('points');
        }
        
        // Next round
        setTimeout(() => {
            nextMusicRound();
        }, 1500);
    }
}

function endMusicGame(success = false) {
    musicGameActive = false;
    musicCanPlay = false;
    
    // Show final score
    document.getElementById('music-final-level').textContent = musicLevel;
    document.getElementById('music-final-score').textContent = musicScore;
    document.getElementById('music-game-over').style.display = 'block';
    
    // Check high score
    const highScoreMsg = document.getElementById('music-high-score-msg');
    const oldHighScore = gameHighScores.music[musicDifficulty];
    
    if (musicScore > oldHighScore) {
        gameHighScores.music[musicDifficulty] = musicScore;
        localStorage.setItem('beatMasterHighScores', JSON.stringify(gameHighScores.music));
        document.getElementById('music-high-score').textContent = musicScore;
        
        highScoreMsg.innerHTML = '🎉 NEW RECORD! 🎉<br>Previous best: ' + oldHighScore;
        
        if (typeof playSound === 'function') {
            playSound('points');
        }
    } else {
        highScoreMsg.innerHTML = 'Best score: ' + oldHighScore;
    }
    
    // Save to server
    saveScoreToServer(musicScore, musicDifficulty, 'music');
    
    // Reset button
    document.getElementById('music-start-btn').textContent = '🎵 Play Again';
    document.getElementById('music-start-btn').disabled = false;
    document.getElementById('music-difficulty-selector').style.opacity = '1';
    document.getElementById('music-difficulty-selector').style.pointerEvents = 'auto';
    
    document.getElementById('music-status').textContent = 'Game Over! ' + (success ? '🎉' : '❌');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('🎵 Beat Master loaded!');

// ============================================
// 🏆 UPDATE LEADERBOARD FOR MULTI-GAME
// ============================================

// Leaderboard game type selector
document.querySelectorAll('.leaderboard-game-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        currentGameType = this.dataset.game;
        
        // Update button styles
        document.querySelectorAll('.leaderboard-game-btn').forEach(b => {
            b.classList.remove('active');
            b.style.border = '2px solid #E5E7EB';
            b.style.background = 'white';
            b.style.color = '#6B7280';
        });
        
        this.classList.add('active');
        this.style.border = '2px solid #4F46E5';
        this.style.background = '#EEF2FF';
        this.style.color = '#4F46E5';
        
        loadLeaderboard();
        
        if (typeof playSound === 'function') {
            playSound('click');
        }
    });
});

// Update loadLeaderboard function to use currentGameType
async function loadLeaderboard() {
    console.log('🏆 Loading leaderboard:', { period: currentPeriod, difficulty: currentLeaderboardDifficulty, gameType: currentGameType });
    
    const result = await apiCall('get_leaderboard', {
        period: currentPeriod,
        difficulty: currentLeaderboardDifficulty,
        game_type: currentGameType
    });
    
    console.log('📡 Leaderboard response:', result);
    
    const container = document.getElementById('leaderboard-list');
    
    if (result.ok && result.data && result.data.length > 0) {
        console.log('✅ Found', result.data.length, 'leaderboard entries');
        const medals = ['🥇', '🥈', '🥉'];
        
        const html = result.data.map((entry, index) => {
            const medal = index < 3 ? medals[index] : `<span style="color: #9CA3AF; font-weight: bold;">#${index + 1}</span>`;
            const difficultyBadge = currentLeaderboardDifficulty === 'all' 
                ? `<span style="padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; background: ${
                    entry.difficulty === 'easy' ? '#D1FAE5' : entry.difficulty === 'medium' ? '#FEF3C7' : '#FEE2E2'
                  }; color: ${
                    entry.difficulty === 'easy' ? '#065F46' : entry.difficulty === 'medium' ? '#92400E' : '#991B1B'
                  };">${entry.difficulty}</span>`
                : '';
            
            return `
                <div style="display: flex; align-items: center; padding: 15px; margin-bottom: 10px; background: rgba(255,255,255,0.8); border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <div style="font-size: 24px; margin-right: 15px; min-width: 40px; text-align: center;">
                        ${medal}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 16px; color: #1F2937;">${entry.kid_name}</div>
                        <div style="font-size: 12px; color: #6B7280;">${difficultyBadge}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; font-size: 20px; color: #4F46E5;">${entry.best_score}</div>
                        <div style="font-size: 11px; color: #9CA3AF;">points</div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    } else {
        const gameEmojis = { stars: '⭐', math: '🧮', music: '🎵' };
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6B7280;">
                <div style="font-size: 48px; margin-bottom: 10px;">${gameEmojis[currentGameType]}</div>
                <p>No scores yet for this period!</p>
                <p style="font-size: 14px; margin-top: 10px;">Be the first to play!</p>
            </div>
        `;
    }
    
    // Reapply theme
    reapplyCurrentTheme();
}

console.log('🎮 All games loaded! Star Catcher, Math Quest, and Beat Master ready to play!');