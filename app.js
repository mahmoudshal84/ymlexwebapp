// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCP51P7jBtgK425eugqv7UwW3stAA2kaYE",
    authDomain: "ym-lex-nn-website.firebaseapp.com",
    projectId: "ym-lex-nn-website",
    storageBucket: "ym-lex-nn-website.firebasestorage.app",
    messagingSenderId: "359813736996",
    appId: "1:359813736996:web:e745bdb4cf8356183486b1",
    measurementId: "G-TM5HCSDV8L"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const approvalPendingScreen = document.getElementById('approval-pending');
const appContainer = document.getElementById('app-container');
const googleSignInBtn = document.getElementById('google-signin');
const logoutBtn = document.getElementById('logout-btn');
const userName = document.getElementById('user-name');
const mainNav = document.getElementById('main-nav');
const navLinks = mainNav.querySelectorAll('a');
const contentSections = document.querySelectorAll('.content-section');

// Current user information
let currentUser = null;

// Authentication
googleSignInBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch(error => {
            console.error('Error during sign in:', error);
            alert('Error signing in. Please try again.');
        });
});

logoutBtn.addEventListener('click', () => {
    auth.signOut()
        .catch(error => {
            console.error('Error during sign out:', error);
        });
});

// Check authentication state
auth.onAuthStateChanged(async user => {
    if (user) {
        currentUser = user;
        userName.textContent = user.displayName || user.email;
        
        // Check if user is approved
        let userDoc = await db.collection('users').doc(user.uid).get();
        
        // Create user in database if they don't exist
        if (!userDoc.exists) {
            console.log('Creating new user document in Firestore for:', user.email);
            await db.collection('users').doc(user.uid).set({
                name: user.displayName || '',
                email: user.email,
                approved: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // Get the updated user document after creation
            userDoc = await db.collection('users').doc(user.uid).get();
        }
        
        if (userDoc.exists && userDoc.data().approved) {
            // User is approved, show the app
            loginScreen.style.display = 'none';
            approvalPendingScreen.style.display = 'none';
            appContainer.style.display = 'block';
            
            // Load initial content (This Week's Work)
            loadContent('this-week');
        } else {
            // User is not approved, show pending screen
            loginScreen.style.display = 'none';
            appContainer.style.display = 'none';
            approvalPendingScreen.style.display = 'flex';
        }
    } else {
        // User is logged out
        currentUser = null;
        loginScreen.style.display = 'flex';
        approvalPendingScreen.style.display = 'none';
        appContainer.style.display = 'none';
    }
});

// Navigation
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.getAttribute('data-page');
        
        // Update active link
        navLinks.forEach(navLink => navLink.classList.remove('active'));
        link.classList.add('active');
        
        // Show corresponding content
        loadContent(page);
    });
});

// Load content based on selected nav item
function loadContent(page) {
    contentSections.forEach(section => {
        section.style.display = 'none';
    });
    
    const selectedSection = document.getElementById(page);
    if (selectedSection) {
        selectedSection.style.display = 'block';
        
        // Load data for the selected section
        switch (page) {
            case 'this-week':
                loadWorkItems();
                break;
            case 'meetings':
                loadMeetings();
                break;
            case 'checklists':
                loadChecklists();
                break;
            case 'finances':
                loadExpenses();
                break;
            case 'forms':
                loadForms();
                break;
            case 'roles':
                loadRoles();
                break;
            case 'halaqas':
                loadHalaqas();
                break;
        }
    }
}

// ====== THIS WEEK'S WORK FUNCTIONALITY ======
const addWorkItemBtn = document.getElementById('add-work-item');
const workItemsList = document.getElementById('work-items-list');
const addWorkForm = document.getElementById('add-work-form');
const workForm = document.getElementById('work-form');
const cancelWorkAddBtn = document.getElementById('cancel-work-add');

// Show/hide work form
addWorkItemBtn.addEventListener('click', () => {
    addWorkForm.style.display = 'block';
    workForm.reset();
});

cancelWorkAddBtn.addEventListener('click', () => {
    addWorkForm.style.display = 'none';
});

// Handle work form submission
workForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const description = document.getElementById('work-description').value;
    const deadline = document.getElementById('work-deadline').value || null;
    
    try {
        await db.collection('workItems').add({
            description,
            deadline,
            completed: false,
            completedBy: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid
        });
        
        addWorkForm.style.display = 'none';
        loadWorkItems();
    } catch (error) {
        console.error('Error adding work item:', error);
        alert('Error adding work item. Please try again.');
    }
});

// Load work items
async function loadWorkItems() {
    try {
        const snapshot = await db.collection('workItems')
            .orderBy('createdAt', 'desc')
            .get();
        
        let html = '';
        
        if (snapshot.empty) {
            html = '<div class="empty-list">No work items found. Add some using the button above.</div>';
        } else {
            snapshot.forEach(doc => {
                const item = doc.data();
                const completed = item.completed ? 'checked' : '';
                const textClass = item.completed ? 'work-item-text work-item-completed' : 'work-item-text';
                
                html += `
                    <div class="work-item" data-id="${doc.id}">
                        <input type="checkbox" class="work-item-checkbox" ${completed}>
                        <div class="${textClass}">
                            ${item.description}
                            ${item.deadline ? `<div class="work-item-meta">Deadline: ${item.deadline}</div>` : ''}
                            ${item.completed ? `<div class="work-item-meta">Completed by: ${item.completedBy}</div>` : ''}
                        </div>
                    </div>
                `;
            });
        }
        
        workItemsList.innerHTML = html;
        
        // Add event listeners to checkboxes
        const checkboxes = workItemsList.querySelectorAll('.work-item-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', handleWorkItemCheck);
        });
    } catch (error) {
        console.error('Error loading work items:', error);
        workItemsList.innerHTML = '<div class="error-message">Error loading work items. Please try again.</div>';
    }
}

// Handle work item checkbox change
async function handleWorkItemCheck(e) {
    const checkbox = e.target;
    const workItem = checkbox.closest('.work-item');
    const itemId = workItem.getAttribute('data-id');
    const isChecked = checkbox.checked;
    
    try {
        await db.collection('workItems').doc(itemId).update({
            completed: isChecked,
            completedBy: isChecked ? currentUser.displayName : null
        });
        
        // Update UI
        const textElement = workItem.querySelector('.work-item-text');
        if (isChecked) {
            textElement.classList.add('work-item-completed');
            const meta = document.createElement('div');
            meta.className = 'work-item-meta';
            meta.textContent = `Completed by: ${currentUser.displayName}`;
            textElement.appendChild(meta);
        } else {
            textElement.classList.remove('work-item-completed');
            const meta = textElement.querySelector('.work-item-meta:last-child');
            if (meta && meta.textContent.includes('Completed by')) {
                meta.remove();
            }
        }
    } catch (error) {
        console.error('Error updating work item:', error);
        alert('Error updating work item. Please try again.');
        // Revert checkbox state
        checkbox.checked = !isChecked;
    }
}

// ====== MEETINGS FUNCTIONALITY ======
const addMeetingBtn = document.getElementById('add-meeting');
const viewPastMeetingsBtn = document.getElementById('view-past-meetings');
const meetingList = document.getElementById('meeting-list');
const addMeetingForm = document.getElementById('add-meeting-form');
const meetingForm = document.getElementById('meeting-form');
const cancelMeetingAddBtn = document.getElementById('cancel-meeting-add');

// Show/hide meeting form
addMeetingBtn.addEventListener('click', () => {
    addMeetingForm.style.display = 'block';
    meetingForm.reset();
});

cancelMeetingAddBtn.addEventListener('click', () => {
    addMeetingForm.style.display = 'none';
});

// Handle meeting form submission
meetingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const date = document.getElementById('meeting-date').value;
    const title = document.getElementById('meeting-title').value;
    const notes = document.getElementById('meeting-notes').value;
    
    try {
        await db.collection('meetings').add({
            date,
            title,
            notes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName
        });
        
        addMeetingForm.style.display = 'none';
        loadMeetings();
    } catch (error) {
        console.error('Error adding meeting:', error);
        alert('Error adding meeting. Please try again.');
    }
});

// Load meetings
async function loadMeetings() {
    try {
        const snapshot = await db.collection('meetings')
            .orderBy('date', 'desc')
            .get();
        
        let html = '';
        
        if (snapshot.empty) {
            html = '<div class="empty-list">No meetings found. Add some using the button above.</div>';
        } else {
            snapshot.forEach(doc => {
                const meeting = doc.data();
                html += `
                    <div class="list-item" data-id="${doc.id}">
                        <div>
                            <h3>${meeting.title}</h3>
                            <div class="list-item-meta">Date: ${meeting.date}</div>
                            <div class="list-item-meta">Added by: ${meeting.createdByName || 'Unknown'}</div>
                        </div>
                        <div class="list-item-actions">
                            <button class="btn-small view-meeting">View</button>
                        </div>
                    </div>
                `;
            });
        }
        
        meetingList.innerHTML = html;
        
        // Add event listeners to view buttons
        const viewButtons = meetingList.querySelectorAll('.view-meeting');
        viewButtons.forEach(button => {
            button.addEventListener('click', viewMeeting);
        });
    } catch (error) {
        console.error('Error loading meetings:', error);
        meetingList.innerHTML = '<div class="error-message">Error loading meetings. Please try again.</div>';
    }
}

// View meeting details
async function viewMeeting(e) {
    const button = e.target;
    const listItem = button.closest('.list-item');
    const meetingId = listItem.getAttribute('data-id');
    
    try {
        const doc = await db.collection('meetings').doc(meetingId).get();
        if (doc.exists) {
            const meeting = doc.data();
            
            // Create modal for viewing meeting
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h2>${meeting.title}</h2>
                    <div class="modal-meta">Date: ${meeting.date}</div>
                    <div class="modal-meta">Added by: ${meeting.createdByName || 'Unknown'}</div>
                    <div class="modal-body">
                        <pre>${meeting.notes}</pre>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Handle closing modal
            const closeBtn = modal.querySelector('.close');
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
            
            // Close modal when clicking outside
            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        }
    } catch (error) {
        console.error('Error viewing meeting:', error);
        alert('Error viewing meeting. Please try again.');
    }
}

// ====== CHECKLISTS FUNCTIONALITY ======
const createChecklistBtn = document.getElementById('create-checklist');
const viewPastChecklistsBtn = document.getElementById('view-past-checklists');
const currentChecklistContainer = document.getElementById('current-checklist');
const addChecklistForm = document.getElementById('add-checklist-form');
const checklistForm = document.getElementById('checklist-form');
const cancelChecklistAddBtn = document.getElementById('cancel-checklist-add');
const addChecklistItemBtn = document.getElementById('add-checklist-item');
const checklistItems = document.getElementById('checklist-items');

// Show/hide checklist form
createChecklistBtn.addEventListener('click', () => {
    addChecklistForm.style.display = 'block';
    checklistForm.reset();
    
    // Clear all checklist items except the first one
    const items = checklistItems.querySelectorAll('.checklist-item');
    for (let i = 1; i < items.length; i++) {
        items[i].remove();
    }
    
    // Clear the first item's input
    const firstItemInput = checklistItems.querySelector('.checklist-item-text');
    if (firstItemInput) {
        firstItemInput.value = '';
    }
});

cancelChecklistAddBtn.addEventListener('click', () => {
    addChecklistForm.style.display = 'none';
});

// Add checklist item
addChecklistItemBtn.addEventListener('click', addChecklistItem);

function addChecklistItem() {
    const newItem = document.createElement('div');
    newItem.className = 'checklist-item';
    newItem.innerHTML = `
        <input type="text" class="checklist-item-text" placeholder="Checklist item" required>
        <button type="button" class="remove-item">×</button>
    `;
    checklistItems.appendChild(newItem);
    
    // Add event listener for the remove button
    const removeBtn = newItem.querySelector('.remove-item');
    removeBtn.addEventListener('click', () => {
        newItem.remove();
    });
    
    // Focus the new input
    const input = newItem.querySelector('.checklist-item-text');
    input.focus();
}

// Add event listeners to existing remove buttons
document.querySelectorAll('.remove-item').forEach(button => {
    button.addEventListener('click', () => {
        button.closest('.checklist-item').remove();
    });
});

// Handle checklist form submission
checklistForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('checklist-title').value;
    const itemInputs = document.querySelectorAll('.checklist-item-text');
    const items = [];
    
    itemInputs.forEach(input => {
        if (input.value.trim()) {
            items.push({
                text: input.value.trim(),
                checked: false
            });
        }
    });
    
    if (items.length === 0) {
        alert('Please add at least one checklist item.');
        return;
    }
    
    try {
        await db.collection('checklists').add({
            title,
            items,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName
        });
        
        addChecklistForm.style.display = 'none';
        loadChecklists();
    } catch (error) {
        console.error('Error creating checklist:', error);
        alert('Error creating checklist. Please try again.');
    }
});

// Load checklists
async function loadChecklists() {
    try {
        const snapshot = await db.collection('checklists')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();
        
        let html = '<h3>Recent Checklists</h3>';
        
        if (snapshot.empty) {
            html += '<div class="empty-list">No checklists found. Create one using the button above.</div>';
        } else {
            html += '<div class="checklist-list">';
            snapshot.forEach(doc => {
                const checklist = doc.data();
                html += `
                    <div class="list-item" data-id="${doc.id}">
                        <div>
                            <h3>${checklist.title}</h3>
                            <div class="list-item-meta">Items: ${checklist.items.length}</div>
                            <div class="list-item-meta">Created by: ${checklist.createdByName || 'Unknown'}</div>
                        </div>
                        <div class="list-item-actions">
                            <button class="btn-small view-checklist">View/Edit</button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        currentChecklistContainer.innerHTML = html;
        
        // Add event listeners to view buttons
        const viewButtons = currentChecklistContainer.querySelectorAll('.view-checklist');
        viewButtons.forEach(button => {
            button.addEventListener('click', viewChecklist);
        });
    } catch (error) {
        console.error('Error loading checklists:', error);
        currentChecklistContainer.innerHTML = '<div class="error-message">Error loading checklists. Please try again.</div>';
    }
}

// View and edit checklist
async function viewChecklist(e) {
    const button = e.target;
    const listItem = button.closest('.list-item');
    const checklistId = listItem.getAttribute('data-id');
    
    try {
        const doc = await db.collection('checklists').doc(checklistId).get();
        if (doc.exists) {
            const checklist = doc.data();
            
            // Create modal for viewing/editing checklist
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h2>${checklist.title}</h2>
                    <div class="modal-meta">Created by: ${checklist.createdByName || 'Unknown'}</div>
                    <div class="checklist-items-container">
                        ${checklist.items.map((item, index) => `
                            <div class="checklist-item-view">
                                <input type="checkbox" id="item-${index}" data-index="${index}" ${item.checked ? 'checked' : ''}>
                                <label for="item-${index}">${item.text}</label>
                            </div>
                        `).join('')}
                    </div>
                    <div class="modal-actions">
                        <button id="save-checklist" class="btn">Save Changes</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Handle closing modal
            const closeBtn = modal.querySelector('.close');
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
            
            // Close modal when clicking outside
            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
            // Handle save changes
            const saveBtn = modal.querySelector('#save-checklist');
            saveBtn.addEventListener('click', async () => {
                const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
                const updatedItems = [...checklist.items];
                
                checkboxes.forEach(checkbox => {
                    const index = parseInt(checkbox.getAttribute('data-index'));
                    if (index >= 0 && index < updatedItems.length) {
                        updatedItems[index].checked = checkbox.checked;
                    }
                });
                
                try {
                    await db.collection('checklists').doc(checklistId).update({
                        items: updatedItems
                    });
                    modal.remove();
                    loadChecklists();
                } catch (error) {
                    console.error('Error updating checklist:', error);
                    alert('Error updating checklist. Please try again.');
                }
            });
        }
    } catch (error) {
        console.error('Error viewing checklist:', error);
        alert('Error viewing checklist. Please try again.');
    }
}

// ====== FINANCES FUNCTIONALITY ======
const addExpenseBtn = document.getElementById('add-expense');
const viewExpensesBtn = document.getElementById('view-expenses');
const expensesList = document.getElementById('expenses-list');
const addExpenseForm = document.getElementById('add-expense-form');
const expenseForm = document.getElementById('expense-form');
const cancelExpenseAddBtn = document.getElementById('cancel-expense-add');

// Show/hide expense form
addExpenseBtn.addEventListener('click', () => {
    addExpenseForm.style.display = 'block';
    expenseForm.reset();
});

cancelExpenseAddBtn.addEventListener('click', () => {
    addExpenseForm.style.display = 'none';
});

// Handle expense form submission
expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const item = document.getElementById('expense-item').value;
    const price = parseFloat(document.getElementById('expense-price').value);
    const date = document.getElementById('expense-date').value;
    const receipt = document.getElementById('expense-receipt').value;
    const reason = document.getElementById('expense-reason').value;
    const approver = document.getElementById('expense-approver').value;
    const refunded = document.getElementById('expense-refunded').value;
    
    try {
        await db.collection('expenses').add({
            item,
            price,
            date,
            receiptUrl: receipt,
            reason,
            approvedBy: approver,
            refunded: refunded === 'yes',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName
        });
        
        addExpenseForm.style.display = 'none';
        loadExpenses();
    } catch (error) {
        console.error('Error adding expense:', error);
        alert('Error adding expense. Please try again.');
    }
});

// Function to load budget information
async function loadBudgetInfo() {
    try {
        // Get the budget document from Firestore
        const budgetDoc = await db.collection('settings').doc('budget').get();
        
        if (budgetDoc.exists) {
            const budgetData = budgetDoc.data();
            document.getElementById('initial-budget').textContent = `$${budgetData.initialBudget.toFixed(2)}`;
        } else {
            // If the budget document doesn't exist, create it with a default value
            await db.collection('settings').doc('budget').set({
                initialBudget: 0.00,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentUser ? currentUser.uid : 'system'
            });
            document.getElementById('initial-budget').textContent = '$0.00';
        }
    } catch (error) {
        console.error('Error loading budget information:', error);
        document.getElementById('initial-budget').textContent = '$0.00';
    }
}

// Load expenses
async function loadExpenses() {
    try {
        // Load budget information first
        await loadBudgetInfo();
        
        const snapshot = await db.collection('expenses')
            .orderBy('date', 'desc')
            .get();
        
        let html = '';
        let total = 0;
        
        if (snapshot.empty) {
            html = '<div class="empty-list">No expenses found. Add some using the button above.</div>';
        } else {
            html += `
                <div class="expense-table">
                    <div class="expense-header">
                        <div class="expense-cell">Item</div>
                        <div class="expense-cell">Price</div>
                        <div class="expense-cell">Date</div>
                        <div class="expense-cell">Approved By</div>
                        <div class="expense-cell">Refunded</div>
                        <div class="expense-cell">Actions</div>
                    </div>
            `;
            
            snapshot.forEach(doc => {
                const expense = doc.data();
                // Only add to total if not refunded
                if (!expense.refunded) {
                    total += expense.price;
                }
                
                html += `
                    <div class="expense-row" data-id="${doc.id}">
                        <div class="expense-cell">${expense.item}</div>
                        <div class="expense-cell">$${expense.price.toFixed(2)}</div>
                        <div class="expense-cell">${expense.date}</div>
                        <div class="expense-cell">${expense.approvedBy}</div>
                        <div class="expense-cell">${expense.refunded ? 'Yes' : 'No'}</div>
                        <div class="expense-cell">
                            <button class="btn-small view-expense">Details</button>
                        </div>
                    </div>
                `;
            });
            
            html += `</div>
                <div class="expense-summary">
                    <strong>Total Expenses: $${total.toFixed(2)}</strong>
                </div>
            `;
        }
        
        expensesList.innerHTML = html;
        
        // Update the spent-to-date display
        document.getElementById('spent-to-date').textContent = `$${total.toFixed(2)}`;
        
        // Calculate remaining budget
        const initialBudget = parseFloat(document.getElementById('initial-budget').textContent.replace('$', ''));
        const remaining = initialBudget - total;
        document.getElementById('budget-remaining').textContent = `$${remaining.toFixed(2)}`;
        // Add color based on remaining amount
        const remainingElement = document.getElementById('budget-remaining');
        if (remaining < 0) {
            remainingElement.style.color = 'var(--error-color)';
        } else if (remaining < initialBudget * 0.2) { // Less than 20% remaining
            remainingElement.style.color = 'orange';
        } else {
            remainingElement.style.color = 'var(--success-color)';
        }
        
        // Add event listeners to view buttons
        const viewButtons = expensesList.querySelectorAll('.view-expense');
        viewButtons.forEach(button => {
            button.addEventListener('click', viewExpense);
        });
    } catch (error) {
        console.error('Error loading expenses:', error);
        expensesList.innerHTML = '<div class="error-message">Error loading expenses. Please try again.</div>';
    }
}

// View expense details
async function viewExpense(e) {
    const button = e.target;
    const row = button.closest('.expense-row');
    const expenseId = row.getAttribute('data-id');
    
    try {
        const doc = await db.collection('expenses').doc(expenseId).get();
        if (doc.exists) {
            const expense = doc.data();
            
            // Create modal for viewing expense
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h2>Expense Details: ${expense.item}</h2>
                    <div class="expense-details">
                        <div class="detail-row">
                            <div class="detail-label">Item:</div>
                            <div class="detail-value">${expense.item}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Price:</div>
                            <div class="detail-value">$${expense.price.toFixed(2)}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Date:</div>
                            <div class="detail-value">${expense.date}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Reason:</div>
                            <div class="detail-value">${expense.reason}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Approved By:</div>
                            <div class="detail-value">${expense.approvedBy}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Refunded:</div>
                            <div class="detail-value">${expense.refunded ? 'Yes' : 'No'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Added By:</div>
                            <div class="detail-value">${expense.createdByName || 'Unknown'}</div>
                        </div>
                        ${expense.receiptUrl ? `
                            <div class="detail-row">
                                <div class="detail-label">Receipt:</div>
                                <div class="detail-value">
                                    <a href="${expense.receiptUrl}" target="_blank">View Receipt</a>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Handle closing modal
            const closeBtn = modal.querySelector('.close');
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
            
            // Close modal when clicking outside
            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        }
    } catch (error) {
        console.error('Error viewing expense:', error);
        alert('Error viewing expense. Please try again.');
    }
}

// ====== FORMS FUNCTIONALITY ======
const addFormBtn = document.getElementById('add-form');
const viewFormsBtn = document.getElementById('view-forms');
const formsList = document.getElementById('forms-list');
const addFormForm = document.getElementById('add-form-form');
const formAddForm = document.getElementById('form-add-form');
const cancelFormAddBtn = document.getElementById('cancel-form-add');

// Show/hide form form
addFormBtn.addEventListener('click', () => {
    addFormForm.style.display = 'block';
    formAddForm.reset();
});

cancelFormAddBtn.addEventListener('click', () => {
    addFormForm.style.display = 'none';
});

// Handle form form submission
formAddForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('form-title').value;
    const url = document.getElementById('form-url').value;
    const description = document.getElementById('form-description').value;
    
    try {
        await db.collection('forms').add({
            title,
            url,
            description,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName
        });
        
        addFormForm.style.display = 'none';
        loadForms();
    } catch (error) {
        console.error('Error adding form:', error);
        alert('Error adding form. Please try again.');
    }
});

// Load forms
async function loadForms() {
    try {
        const snapshot = await db.collection('forms')
            .orderBy('createdAt', 'desc')
            .get();
        
        let html = '';
        
        if (snapshot.empty) {
            html = '<div class="empty-list">No forms found. Add some using the button above.</div>';
        } else {
            snapshot.forEach(doc => {
                const form = doc.data();
                html += `
                    <div class="list-item" data-id="${doc.id}">
                        <div>
                            <h3>${form.title}</h3>
                            <div class="list-item-meta">Added by: ${form.createdByName || 'Unknown'}</div>
                            <div class="list-item-description">${form.description || ''}</div>
                        </div>
                        <div class="list-item-actions">
                            <a href="${form.url}" target="_blank" class="btn-small">Open Form</a>
                            <button class="btn-small view-form-responses">Responses</button>
                        </div>
                    </div>
                `;
            });
        }
        
        formsList.innerHTML = html;
        
        // Add event listeners to view responses buttons
        const viewResponsesButtons = formsList.querySelectorAll('.view-form-responses');
        viewResponsesButtons.forEach(button => {
            button.addEventListener('click', () => {
                alert('Google Form responses need to be viewed directly in Google Forms. Please open the form and check the responses there.');
            });
        });
    } catch (error) {
        console.error('Error loading forms:', error);
        formsList.innerHTML = '<div class="error-message">Error loading forms. Please try again.</div>';
    }
}

// ====== ROLES FUNCTIONALITY ======
const addRoleBtn = document.getElementById('add-role');
const rolesList = document.getElementById('roles-list');
const addRoleForm = document.getElementById('add-role-form');
const roleForm = document.getElementById('role-form');
const cancelRoleAddBtn = document.getElementById('cancel-role-add');

// Show/hide role form
addRoleBtn.addEventListener('click', () => {
    addRoleForm.style.display = 'block';
    roleForm.reset();
});

cancelRoleAddBtn.addEventListener('click', () => {
    addRoleForm.style.display = 'none';
});

// Handle role form submission
roleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('member-name').value;
    const role = document.getElementById('member-role').value;
    const description = document.getElementById('role-description').value;
    
    try {
        await db.collection('roles').add({
            name,
            role,
            description,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid
        });
        
        addRoleForm.style.display = 'none';
        loadRoles();
    } catch (error) {
        console.error('Error adding role:', error);
        alert('Error adding role. Please try again.');
    }
});

// Load roles
async function loadRoles() {
    try {
        const snapshot = await db.collection('roles')
            .orderBy('name')
            .get();
        
        let html = '';
        
        if (snapshot.empty) {
            html = '<div class="empty-list">No roles found. Add some using the button above.</div>';
        } else {
            html += '<div class="roles-grid">';
            snapshot.forEach(doc => {
                const role = doc.data();
                html += `
                    <div class="role-card" data-id="${doc.id}">
                        <h3 class="role-name">${role.name}</h3>
                        <div class="role-title">${role.role}</div>
                        ${role.description ? `<div class="role-description">${role.description}</div>` : ''}
                    </div>
                `;
            });
            html += '</div>';
        }
        
        rolesList.innerHTML = html;
    } catch (error) {
        console.error('Error loading roles:', error);
        rolesList.innerHTML = '<div class="error-message">Error loading roles. Please try again.</div>';
    }
}

// ====== HALAQAS FUNCTIONALITY ======
const addHalaqaBtn = document.getElementById('add-halaqa');
const viewHalaqasBtn = document.getElementById('view-halaqas');
const halaqasList = document.getElementById('halaqas-list');
const addHalaqaForm = document.getElementById('add-halaqa-form');
const halaqaForm = document.getElementById('halaqa-form');
const cancelHalaqaAddBtn = document.getElementById('cancel-halaqa-add');

// Show/hide halaqa form
addHalaqaBtn.addEventListener('click', () => {
    addHalaqaForm.style.display = 'block';
    halaqaForm.reset();
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('halaqa-date').value = today;
});

cancelHalaqaAddBtn.addEventListener('click', () => {
    addHalaqaForm.style.display = 'none';
});

// Handle halaqa form submission
halaqaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('halaqa-title').value;
    const date = document.getElementById('halaqa-date').value;
    const citation1 = document.getElementById('halaqa-citation1').value;
    const citation2 = document.getElementById('halaqa-citation2').value;
    const citation3 = document.getElementById('halaqa-citation3').value;
    const notes = document.getElementById('halaqa-notes').value;
    
    // Prepare citations array (filter out empty ones)
    const citations = [citation1, citation2, citation3].filter(citation => citation.trim() !== '');
    
    try {
        await db.collection('halaqas').add({
            title,
            date,
            citations,
            notes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName
        });
        
        addHalaqaForm.style.display = 'none';
        loadHalaqas();
    } catch (error) {
        console.error('Error adding halaqa:', error);
        alert('Error adding halaqa. Please try again.');
    }
});

// Load halaqas
async function loadHalaqas() {
    try {
        const snapshot = await db.collection('halaqas')
            .orderBy('date', 'desc')
            .get();
        
        let html = '';
        
        if (snapshot.empty) {
            html = '<div class="empty-list">No halaqas found. Add some using the button above.</div>';
        } else {
            snapshot.forEach(doc => {
                const halaqa = doc.data();
                const citationsHtml = halaqa.citations.map(citation => 
                    `<div class="citation-item">${citation}</div>`
                ).join('');
                
                html += `
                    <div class="halaqa-card" data-id="${doc.id}">
                        <div class="halaqa-header">
                            <h3 class="halaqa-title">${halaqa.title}</h3>
                            <div class="halaqa-date">${halaqa.date}</div>
                        </div>
                        <div class="halaqa-citations">
                            ${citationsHtml}
                        </div>
                        ${halaqa.notes ? `
                            <div class="halaqa-notes">
                                <strong>Notes:</strong>
                                <p>${halaqa.notes}</p>
                            </div>
                        ` : ''}
                        <div class="halaqa-actions">
                            <button class="btn-small edit-halaqa">Edit</button>
                            <button class="btn-small delete-halaqa">Delete</button>
                        </div>
                    </div>
                `;
            });
        }
        
        halaqasList.innerHTML = html;
        
        // Add event listeners to buttons
        const editButtons = halaqasList.querySelectorAll('.edit-halaqa');
        const deleteButtons = halaqasList.querySelectorAll('.delete-halaqa');
        
        editButtons.forEach(button => {
            button.addEventListener('click', editHalaqa);
        });
        
        deleteButtons.forEach(button => {
            button.addEventListener('click', deleteHalaqa);
        });
    } catch (error) {
        console.error('Error loading halaqas:', error);
        halaqasList.innerHTML = '<div class="error-message">Error loading halaqas. Please try again.</div>';
    }
}

// Edit halaqa
async function editHalaqa(e) {
    const button = e.target;
    const halaqaCard = button.closest('.halaqa-card');
    const halaqaId = halaqaCard.getAttribute('data-id');
    
    try {
        const doc = await db.collection('halaqas').doc(halaqaId).get();
        if (doc.exists) {
            const halaqa = doc.data();
            
            // Populate form with halaqa data
            document.getElementById('halaqa-title').value = halaqa.title;
            document.getElementById('halaqa-date').value = halaqa.date;
            document.getElementById('halaqa-citation1').value = halaqa.citations[0] || '';
            document.getElementById('halaqa-citation2').value = halaqa.citations[1] || '';
            document.getElementById('halaqa-citation3').value = halaqa.citations[2] || '';
            document.getElementById('halaqa-notes').value = halaqa.notes || '';
            
            // Show form
            addHalaqaForm.style.display = 'block';
            
            // Change form submission to update instead of create
            halaqaForm.removeEventListener('submit', halaqaForm.onsubmit);
            halaqaForm.onsubmit = async (e) => {
                e.preventDefault();
                
                const title = document.getElementById('halaqa-title').value;
                const date = document.getElementById('halaqa-date').value;
                const citation1 = document.getElementById('halaqa-citation1').value;
                const citation2 = document.getElementById('halaqa-citation2').value;
                const citation3 = document.getElementById('halaqa-citation3').value;
                const notes = document.getElementById('halaqa-notes').value;
                
                // Prepare citations array (filter out empty ones)
                const citations = [citation1, citation2, citation3].filter(citation => citation.trim() !== '');
                
                try {
                    await db.collection('halaqas').doc(halaqaId).update({
                        title,
                        date,
                        citations,
                        notes,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedBy: currentUser.uid
                    });
                    
                    addHalaqaForm.style.display = 'none';
                    loadHalaqas();
                    
                    // Reset form submission
                    halaqaForm.removeEventListener('submit', halaqaForm.onsubmit);
                    halaqaForm.addEventListener('submit', halaqaForm.originalSubmit);
                } catch (error) {
                    console.error('Error updating halaqa:', error);
                    alert('Error updating halaqa. Please try again.');
                }
            };
            
            // Store original submit handler
            halaqaForm.originalSubmit = halaqaForm.onsubmit;
        }
    } catch (error) {
        console.error('Error editing halaqa:', error);
        alert('Error editing halaqa. Please try again.');
    }
}

// Delete halaqa
async function deleteHalaqa(e) {
    const button = e.target;
    const halaqaCard = button.closest('.halaqa-card');
    const halaqaId = halaqaCard.getAttribute('data-id');
    
    if (confirm('Are you sure you want to delete this halaqa? This action cannot be undone.')) {
        try {
            await db.collection('halaqas').doc(halaqaId).delete();
            loadHalaqas();
        } catch (error) {
            console.error('Error deleting halaqa:', error);
            alert('Error deleting halaqa. Please try again.');
        }
    }
}

// Initialize the application by loading the content
document.addEventListener('DOMContentLoaded', () => {
    // Set "This Week's Work" as active by default
    const defaultNavLink = document.querySelector('a[data-page="this-week"]');
    if (defaultNavLink) {
        defaultNavLink.classList.add('active');
    }
});
