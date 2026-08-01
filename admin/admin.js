import { auth, db } from '../js/firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  collection, 
  query, 
  orderBy,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- STATE ---
let currentUserRole = 'admin';
let currentEmail = null;
let hasUnsavedChanges = false;
let inactivityTimer = null;
const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

// --- SINGLE SESSION TOKEN ---
let currentSessionToken = sessionStorage.getItem('adminSessionToken');
if (!currentSessionToken) {
  currentSessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2);
  sessionStorage.setItem('adminSessionToken', currentSessionToken);
}

// --- 10-MINUTE INACTIVITY TIMER ---
function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (auth.currentUser) {
    inactivityTimer = setTimeout(async () => {
      alert("⏱️ Session Expired!\n\nYou have been automatically signed out due to 10 minutes of inactivity.");
      await signOut(auth);
    }, INACTIVITY_LIMIT_MS);
  }
}

['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, resetInactivityTimer, { passive: true });
});

// --- DOM ELEMENTS ---
const loginScreen = document.getElementById('login-screen');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const errorDiv = document.getElementById('login-error');
const badge = document.getElementById('unsaved-badge');

// --- FILE VALIDATION & RENAMING HELPER ---
function processAndValidateFile(file, titleOrLabel, allowedCategory, maxSizeMB = 5) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);

    const isPdf = allowedCategory === 'pdf';
    const allowedMIMEs = isPdf 
      ? ['application/pdf'] 
      : ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

    const isValidType = allowedMIMEs.some(type => file.type.toLowerCase().includes(type.split('/')[1])) ||
                        (isPdf ? file.name.endsWith('.pdf') : /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name));

    if (!isValidType) {
      const expectedMsg = isPdf ? "PDF documents (.pdf)" : "Image files (.webp, .jpg, .png, .gif)";
      const errorMsg = `❌ Invalid File Format!\n\n` +
                       `Selected File: "${file.name}" (Type: ${file.type || 'Unknown'})\n` +
                       `Accepted Formats: ${expectedMsg}\n\n` +
                       `How to Fix: Please convert or select a valid ${expectedMsg} file.`;
      alert(errorMsg);
      return reject(new Error("Invalid file format"));
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const errorMsg = `❌ File Size Exceeded!\n\n` +
                       `Selected File Size: ${fileSizeMB} MB\n` +
                       `Maximum Allowed Limit: ${maxSizeMB} MB\n\n` +
                       `How to Fix: Please compress or resize your ${isPdf ? 'PDF' : 'image'} before uploading.`;
      alert(errorMsg);
      return reject(new Error("File size limit exceeded"));
    }

    const ext = file.name.split('.').pop().toLowerCase();
    const cleanTitle = (titleOrLabel || 'file')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_');
    const renamedFileName = `${cleanTitle}.${ext}`;

    const reader = new FileReader();
    reader.onload = (e) => {
      resolve({
        dataUrl: e.target.result,
        renamedFileName: renamedFileName,
        originalName: file.name,
        sizeMB: (file.size / (1024 * 1024)).toFixed(2)
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// --- AUTHENTICATION & STRICT REVOCATION CHECK ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentEmail = user.email;
    try {
      // 1. Verify User Exists in admin_users Collection (REVOCATION CHECK)
      const teamSnap = await getDocs(collection(db, "admin_users"));
      const userDoc = teamSnap.docs.find(d => {
        const data = d.data();
        return d.id === user.uid || (data.email && data.email.toLowerCase() === user.email.toLowerCase());
      });

      if (!userDoc) {
        console.warn("[AUTH] User deleted/revoked from admin_users list.");
        errorDiv.textContent = "Access Denied: Your account access has been revoked by the administrator.";
        await signOut(auth);
        return;
      }

      const userData = userDoc.data();
      currentUserRole = userData.role || 'admin';

      // 2. Single Active Session Check
      const isNewLogin = sessionStorage.getItem('isNewLogin');
      if (isNewLogin === 'true') {
        sessionStorage.removeItem('isNewLogin');
        await updateDoc(doc(db, "admin_users", userDoc.id), {
          activeSessionToken: currentSessionToken,
          lastLoginAt: new Date().toISOString()
        });
      } else if (userData.activeSessionToken && userData.activeSessionToken !== currentSessionToken) {
        alert("🔒 Session Terminated!\n\nYour account was signed in from another device or browser window.");
        await signOut(auth);
        return;
      }

      // Update UI
      document.getElementById('user-role').textContent = currentUserRole;
      const teamNav = document.getElementById('nav-team');
      if (teamNav) {
        teamNav.style.display = (currentUserRole === 'admin') ? 'flex' : 'none';
      }
      loginScreen.style.display = 'none';
      adminPanel.style.display = 'flex';
      
      resetInactivityTimer();
      loadAllData();

    } catch (err) {
      console.warn("Role check error:", err.message);
      loginScreen.style.display = 'flex';
      adminPanel.style.display = 'none';
    }
  } else {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    loginScreen.style.display = 'flex';
    adminPanel.style.display = 'none';
  }
});

loginForm.addEventListener('submit', async (event) => {
  if (event) event.preventDefault();
  const email = document.getElementById('login-email').value;
  const pw = document.getElementById('login-password').value;

  if (!email || !pw) {
    errorDiv.textContent = 'Please enter both email and password.';
    return;
  }

  errorDiv.textContent = 'Logging in with Firebase...';
  loginBtn.disabled = true;

  try {
    sessionStorage.setItem('isNewLogin', 'true');
    await signInWithEmailAndPassword(auth, email, pw);
    errorDiv.textContent = '';
  } catch (err) {
    console.error('[Login Error]', err);
    errorDiv.textContent = 'Login failed: ' + (err.message || 'Check credentials');
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  await signOut(auth);
});

// --- NAVIGATION ---
document.querySelectorAll('.sidebar-nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    if (hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Leave anyway?")) return;
    }
    document.querySelectorAll('.sidebar-nav a').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(link.dataset.view).classList.add('active');
    hasUnsavedChanges = false;
    updateBadge();
  });
});

function markUnsaved() {
  hasUnsavedChanges = true;
  updateBadge();
}
window.markUnsaved = markUnsaved;

function updateBadge() {
  if (badge) badge.style.display = hasUnsavedChanges ? 'inline-block' : 'none';
}

// --- DATA LOADING & SAVING ---
async function loadAllData() {
  // 0. Analytics Section
  try {
    await loadAnalyticsData();
  } catch (e) { console.warn("Load analytics error:", e.message); }

  // 1. Hero Section
  try {
    const heroDoc = await getDoc(doc(db, "site_content", "hero"));
    if (heroDoc.exists()) {
      const data = heroDoc.data();
      document.getElementById('hero-desc').value = data.description || "";
      const previewImg = document.getElementById('hero-photo-preview');
      const photoPath = data.photoUrl || data.photo_url || "/photo.webp";
      previewImg.src = photoPath;
      previewImg.style.display = 'block';
    }
  } catch (e) { console.warn("Load hero error:", e.message); }

  // 2. Thinking Section
  try {
    const thinkingSnap = await getDocs(collection(db, "thinking"));
    let posts = thinkingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    posts.sort((a, b) => (a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0));
    renderThinking(posts);
  } catch (e) { console.warn("Load thinking error:", e.message); }

  // 3. Life Section
  try {
    const lifeSnap = await getDocs(collection(db, "life"));
    let milestones = lifeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    milestones.sort((a, b) => (a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0));
    renderLife(milestones);
  } catch (e) { console.warn("Load life error:", e.message); }

  // 4. Contact Section
  try {
    const contactSnap = await getDocs(collection(db, "contact"));
    let links = contactSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    links.sort((a, b) => (a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0));
    renderContact(links);
  } catch (e) { console.warn("Load contact error:", e.message); }

  // 5. CV Versions
  try {
    const cvSnap = await getDocs(collection(db, "cv_versions"));
    let cvData = cvSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (cvData.length === 0) {
      cvData = [{
        id: 'cv_default',
        label: 'Marketing - Primary CV 2026',
        uploadDate: new Date().toISOString().split('T')[0],
        storageUrl: '/assets/cv/ziad-bahgat-cv.pdf',
        isActive: true
      }];
    }
    renderCV(cvData);
  } catch (e) { console.warn("Load CV error:", e.message); }

  // 6. Snaps
  try {
    const snapsSnap = await getDocs(collection(db, "snaps"));
    const snapsData = snapsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSnaps(snapsData);
  } catch (e) { console.warn("Load snaps error:", e.message); }

  // 7. Team
  if (currentUserRole === 'admin') {
    try {
      const teamSnap = await getDocs(collection(db, "admin_users"));
      const teamData = teamSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTeam(teamData);
    } catch (e) { console.warn("Load team error:", e.message); }
  }
}

document.getElementById('view-hero')?.addEventListener('input', markUnsaved);

document.querySelectorAll('.save-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    const target = e.target.dataset.target;
    btn.textContent = "Saving...";
    try {
      if (target === 'hero') await saveHero();
      if (target === 'thinking') await saveThinking();
      if (target === 'life') await saveLife();
      if (target === 'contact') await saveContact();
      
      hasUnsavedChanges = false;
      updateBadge();
      btn.textContent = "Saved!";
      setTimeout(() => btn.textContent = target === 'hero' ? "Save Changes" : "Save All", 2000);
    } catch(err) {
      console.error(err);
      btn.textContent = "Error";
    }
  });
});

// --- HERO SECTION ---
async function saveHero() {
  let photoUrl = document.getElementById('hero-photo-preview').src;
  const fileInput = document.getElementById('hero-photo-upload');
  
  if (fileInput && fileInput.files[0]) {
    try {
      const processed = await processAndValidateFile(fileInput.files[0], 'Ziad_Bahgat_Hero_Photo', 'image', 5);
      if (processed) {
        photoUrl = processed.dataUrl;
        document.getElementById('hero-photo-preview').src = photoUrl;
        document.getElementById('hero-photo-preview').style.display = 'block';
      }
    } catch (err) {
      throw err;
    }
  }

  const desc = document.getElementById('hero-desc').value;
  await setDoc(doc(db, "site_content", "hero"), {
    description: desc,
    photoUrl: photoUrl
  });
}

// --- THINKING SECTION ---
function renderThinking(posts) {
  const container = document.getElementById('thinking-list');
  if (!container) return;
  container.innerHTML = '';
  posts.forEach(post => {
    container.insertAdjacentHTML('beforeend', `
      <div class="list-item">
        <i class="fa-solid fa-grip-vertical drag-handle"></i>
        <div class="item-fields">
          <input type="hidden" class="t-id" value="${post.id || ''}">
          <input type="text" class="t-title" placeholder="Post Title / Content Preview" value="${post.text || ''}" oninput="markUnsaved()">
          <input type="text" class="t-url" placeholder="LinkedIn Post Link (https://...)" value="${post.link || post.url || ''}" oninput="markUnsaved()">
          <input type="text" class="t-date" placeholder="Date (e.g. August 2025)" value="${post.date || ''}" oninput="markUnsaved()">
        </div>
        <button class="delete-btn" onclick="window.deleteThinkingCard(this)"><i class="fa-solid fa-trash"></i></button>
      </div>
    `);
  });
}

window.deleteThinkingCard = async function(btn) {
  const item = btn.closest('.list-item');
  if (!item) return;
  const id = item.querySelector('.t-id')?.value;
  
  if (confirm('Delete this post permanently?')) {
    item.remove();
    markUnsaved();
    if (id) {
      try {
        await deleteDoc(doc(db, "thinking", id));
        await saveThinking();
      } catch (e) { console.warn("Thinking delete doc error:", e); }
    }
  }
};

document.getElementById('add-thinking-btn')?.addEventListener('click', () => {
  renderThinking([...getThinkingData(), { id: 'post_' + Date.now(), text: '', link: '', date: '' }]);
  markUnsaved();
});

function getThinkingData() {
  const items = document.querySelectorAll('#thinking-list .list-item');
  const arr = [];
  items.forEach((item, index) => {
    let id = item.querySelector('.t-id').value;
    if(!id) id = 'post_' + (Date.now() + index);
    arr.push({
      id: id,
      text: item.querySelector('.t-title').value,
      link: item.querySelector('.t-url').value,
      date: item.querySelector('.t-date').value,
      sortOrder: index
    });
  });
  return arr;
}

async function saveThinking() {
  const thinkingSnap = await getDocs(collection(db, "thinking"));
  const existingDocIds = thinkingSnap.docs.map(d => d.id);

  const items = getThinkingData();
  const currentIds = new Set(items.map(i => i.id));

  for (let item of items) {
    await setDoc(doc(db, "thinking", item.id), item);
  }

  for (let oldId of existingDocIds) {
    if (!currentIds.has(oldId)) {
      await deleteDoc(doc(db, "thinking", oldId));
    }
  }

  await setDoc(doc(db, "site_content", "thinking"), { posts: items });
}

// --- LIFE SECTION ---
function renderLife(milestones) {
  const container = document.getElementById('life-list');
  if (!container) return;
  container.innerHTML = '';
  milestones.forEach((slice) => {
    const imgPath = slice.imagePath || slice.image_path || '';
    const hasImage = imgPath && !slice.imageMissing && !slice.image_missing;
    
    container.insertAdjacentHTML('beforeend', `
      <div class="list-item" draggable="true" ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="drop(event, this)">
        <i class="fa-solid fa-grip-vertical drag-handle"></i>
        <div class="item-fields">
          <input type="hidden" class="l-id" value="${slice.id || ''}">
          
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
            <img class="l-preview" src="${imgPath}" style="max-height:80px; max-width:120px; border-radius:6px; object-fit:cover; display:${hasImage ? 'block' : 'none'}; border:1px solid #333;" onerror="this.style.display='none'">
            <div style="flex:1;">
              <label style="font-size:11px; color:#888; display:block; margin-bottom:2px;">Upload New Image (Max 5 MB - Auto Renamed to Title):</label>
              <input type="file" class="l-file" accept="image/*" onchange="window.previewLifeImage(this)" oninput="markUnsaved()">
            </div>
          </div>

          <input type="hidden" class="l-img" value="${imgPath}">
          <input type="text" class="l-title" placeholder="Card Title (e.g. Best Vice of Enactus)" value="${slice.title || ''}" oninput="markUnsaved()">
          <textarea class="l-desc" placeholder="Caption / Story Description" oninput="markUnsaved()">${slice.caption || slice.description || ''}</textarea>
          <input type="text" class="l-date" placeholder="Date (e.g. August 2025)" value="${slice.date || ''}" oninput="markUnsaved()">
        </div>
        <button class="delete-btn" onclick="window.deleteLifeCard(this)"><i class="fa-solid fa-trash"></i></button>
      </div>
    `);
  });
}

window.deleteLifeCard = async function(btn) {
  const item = btn.closest('.list-item');
  if (!item) return;
  const id = item.querySelector('.l-id')?.value;
  
  if (confirm('Delete this card permanently?')) {
    item.remove();
    markUnsaved();
    if (id) {
      try {
        await deleteDoc(doc(db, "life", id));
        await saveLife();
      } catch (e) {
        console.error("Delete life doc error:", e);
      }
    }
  }
};

window.previewLifeImage = async function(fileInput) {
  const item = fileInput.closest('.list-item');
  const title = item.querySelector('.l-title').value || 'Milestone';
  const file = fileInput.files[0];
  if (file) {
    try {
      const processed = await processAndValidateFile(file, title, 'image', 5);
      if (processed) {
        const previewImg = item.querySelector('.l-preview');
        const hiddenImg = item.querySelector('.l-img');
        previewImg.src = processed.dataUrl;
        previewImg.style.display = 'block';
        hiddenImg.value = processed.dataUrl;
        markUnsaved();
      }
    } catch (err) {
      fileInput.value = '';
    }
  }
};

document.getElementById('add-life-btn')?.addEventListener('click', () => {
  const container = document.getElementById('life-list');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `
    <div class="list-item" draggable="true" ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="drop(event, this)">
      <i class="fa-solid fa-grip-vertical drag-handle"></i>
      <div class="item-fields">
        <input type="hidden" class="l-id" value="slice_${Date.now()}">
        
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
          <img class="l-preview" src="" style="max-height:80px; max-width:120px; border-radius:6px; object-fit:cover; display:none; border:1px solid #333;">
          <div style="flex:1;">
            <label style="font-size:11px; color:#888; display:block; margin-bottom:2px;">Upload New Image (Max 5 MB - Auto Renamed):</label>
            <input type="file" class="l-file" accept="image/*" onchange="window.previewLifeImage(this)" oninput="markUnsaved()">
          </div>
        </div>

        <input type="hidden" class="l-img" value="">
        <input type="text" class="l-title" placeholder="Card Title" oninput="markUnsaved()">
        <textarea class="l-desc" placeholder="Caption / Story Description" oninput="markUnsaved()"></textarea>
        <input type="text" class="l-date" placeholder="Date" oninput="markUnsaved()">
      </div>
      <button class="delete-btn" onclick="window.deleteLifeCard(this)"><i class="fa-solid fa-trash"></i></button>
    </div>
  `);
  markUnsaved();
});

let draggedItem = null;
window.dragStart = function(e) { draggedItem = e.target.closest('.list-item'); };
window.dragOver = function(e) { e.preventDefault(); };
window.drop = function(e, target) {
  e.preventDefault();
  if (target !== draggedItem) {
    const list = target.parentNode;
    const items = Array.from(list.children);
    const targetIdx = items.indexOf(target);
    const draggedIdx = items.indexOf(draggedItem);
    if (draggedIdx > targetIdx) {
      list.insertBefore(draggedItem, target);
    } else {
      list.insertBefore(draggedItem, target.nextSibling);
    }
    markUnsaved();
  }
};

async function saveLife() {
  const lifeSnap = await getDocs(collection(db, "life"));
  const existingDocIds = lifeSnap.docs.map(d => d.id);

  const items = document.querySelectorAll('#life-list .list-item');
  const arr = [];
  const currentIds = new Set();
  let sortOrder = 0;

  for (let item of items) {
    const title = item.querySelector('.l-title').value || 'Milestone';
    let imgPath = item.querySelector('.l-img').value || '';
    const fileInput = item.querySelector('.l-file');
    
    if (fileInput && fileInput.files && fileInput.files[0] && !imgPath.startsWith('data:')) {
      try {
        const processed = await processAndValidateFile(fileInput.files[0], title, 'image', 5);
        if (processed) {
          imgPath = processed.dataUrl;
        }
      } catch (e) {
        console.warn("Save life image warning:", e.message);
      }
    }
    
    let sliceId = item.querySelector('.l-id').value;
    if (!sliceId) sliceId = 'slice_' + Date.now() + '_' + sortOrder;
    currentIds.add(sliceId);

    const sliceObj = {
      id: sliceId,
      title: title,
      caption: item.querySelector('.l-desc').value || '',
      date: item.querySelector('.l-date').value || '',
      imagePath: imgPath,
      imageMissing: !imgPath,
      sortOrder: sortOrder++
    };
    arr.push(sliceObj);
    await setDoc(doc(db, "life", sliceObj.id), sliceObj);
  }

  for (let oldId of existingDocIds) {
    if (!currentIds.has(oldId)) {
      await deleteDoc(doc(db, "life", oldId));
    }
  }

  await setDoc(doc(db, "site_content", "life"), { milestones: arr });
}

// --- CONTACT SECTION ---
const PRESET_ICONS = [
  { label: "💼 LinkedIn", class: "fa-brands fa-linkedin" },
  { label: "📷 Instagram", class: "fa-brands fa-instagram" },
  { label: "🎵 TikTok", class: "fa-brands fa-tiktok" },
  { label: "📞 Phone", class: "fa-solid fa-phone" },
  { label: "✉️ Email", class: "fa-solid fa-envelope" },
  { label: "💬 WhatsApp", class: "fa-brands fa-whatsapp" },
  { label: "🌐 Website / Link", class: "fa-solid fa-globe" }
];

function renderContact(links) {
  const container = document.getElementById('contact-list');
  if (!container) return;
  container.innerHTML = '';
  links.forEach(link => {
    const currentIcon = link.icon || 'fa-brands fa-linkedin';
    const isCustom = !PRESET_ICONS.some(p => p.class === currentIcon);
    const presetValue = isCustom ? 'custom' : currentIcon;

    const presetOptionsHtml = PRESET_ICONS.map(p => `
      <option value="${p.class}" ${presetValue === p.class ? 'selected' : ''}>${p.label}</option>
    `).join('') + `<option value="custom" ${isCustom ? 'selected' : ''}>Custom Class...</option>`;

    container.insertAdjacentHTML('beforeend', `
      <div class="list-item">
        <div class="item-fields">
          <input type="hidden" class="c-id" value="${link.id || ''}">
          <input type="text" class="c-label" placeholder="Label (e.g. Phone, LinkedIn, Email)" value="${link.label || ''}" oninput="markUnsaved()">
          <input type="text" class="c-url" placeholder="URL or Contact Value (e.g. tel:+201..., mailto:info@..., https://...)" value="${link.url || ''}" oninput="markUnsaved()">
          
          <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <label style="font-size:12px; color:#888;">Select Icon:</label>
              <select class="c-icon-preset" style="flex:1; background:#222; color:#fff; padding:8px; border:1px solid #444; border-radius:4px;" onchange="window.handleIconDropdownChange(this)">
                ${presetOptionsHtml}
              </select>
            </div>
            
            <input type="text" class="c-icon" placeholder="Type custom FontAwesome class (e.g. fa-brands fa-github)" value="${currentIcon}" style="display:${isCustom ? 'block' : 'none'}; width:100%; margin-top:4px;" oninput="markUnsaved()">
          </div>
        </div>
        <button class="delete-btn" onclick="window.deleteContactCard(this)"><i class="fa-solid fa-trash"></i></button>
      </div>
    `);
  });
}

window.handleIconDropdownChange = function(selectEl) {
  const item = selectEl.closest('.list-item');
  const customInput = item.querySelector('.c-icon');
  if (selectEl.value === 'custom') {
    customInput.style.display = 'block';
    customInput.value = '';
    customInput.focus();
  } else {
    customInput.style.display = 'none';
    customInput.value = selectEl.value;
  }
  markUnsaved();
};

window.deleteContactCard = async function(btn) {
  const item = btn.closest('.list-item');
  if (!item) return;
  const id = item.querySelector('.c-id')?.value;
  
  if (confirm('Delete this contact link permanently?')) {
    item.remove();
    markUnsaved();
    if (id) {
      try {
        await deleteDoc(doc(db, "contact", id));
        await saveContact();
      } catch (e) { console.warn("Delete contact doc error:", e); }
    }
  }
};

document.getElementById('add-contact-btn')?.addEventListener('click', () => {
  renderContact([...getContactData(), { id: 'link_' + Date.now(), label: '', url: '', icon: 'fa-solid fa-globe' }]);
  markUnsaved();
});

function getContactData() {
  const items = document.querySelectorAll('#contact-list .list-item');
  const arr = [];
  items.forEach((item, index) => {
    let id = item.querySelector('.c-id').value;
    if(!id) id = 'link_' + (Date.now() + index);
    arr.push({
      id: id,
      label: item.querySelector('.c-label').value,
      url: item.querySelector('.c-url').value,
      icon: item.querySelector('.c-icon').value,
      sortOrder: index
    });
  });
  return arr;
}

async function saveContact() {
  const contactSnap = await getDocs(collection(db, "contact"));
  const existingDocIds = contactSnap.docs.map(d => d.id);

  const items = getContactData();
  const currentIds = new Set(items.map(i => i.id));

  for (let item of items) {
    await setDoc(doc(db, "contact", item.id), item);
  }

  for (let oldId of existingDocIds) {
    if (!currentIds.has(oldId)) {
      await deleteDoc(doc(db, "contact", oldId));
    }
  }

  await setDoc(doc(db, "site_content", "contact"), { links: items });
}

// --- CV MANAGER ---
let currentVersions = [];
function renderCV(cvData) {
  currentVersions = cvData;
  const tbody = document.getElementById('cv-list');
  if (!tbody) return;
  tbody.innerHTML = '';
  cvData.forEach(v => {
    const isActive = v.isActive || v.is_active;
    const url = v.storageUrl || v.storage_url || v.url || '';
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${isActive ? '<span style="color:#C8FF00; font-weight:bold;">✅ Active</span>' : '<span style="color:#888;">Inactive</span>'}</td>
        <td><strong>${v.label}</strong></td>
        <td>${v.uploadDate || v.upload_date || ''}</td>
        <td>
          ${!isActive ? `<button onclick="window.setActiveCV('${v.id}')" class="add-btn" style="padding:4px 10px; font-size:12px; margin-right:4px;">Set Active</button>` : ''}
          <a href="${url}" target="_blank" download class="add-btn" style="padding:4px 10px; font-size:12px; background:#333; color:#fff; text-decoration:none; margin-right:4px;">Download</a>
          <button class="delete-btn" onclick="window.deleteCV('${v.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `);
  });
}

document.getElementById('upload-cv-btn')?.addEventListener('click', async () => {
  const labelInput = document.getElementById('cv-label');
  const fileInput = document.getElementById('cv-file');
  const urlInput = document.getElementById('cv-url');
  const label = labelInput ? labelInput.value.trim() : '';

  if (!label) return alert("Please provide a Version Label (e.g. Marketing - Primary CV 2026)");

  const uploadBtn = document.getElementById('upload-cv-btn');
  uploadBtn.textContent = "Validating & Processing...";
  uploadBtn.disabled = true;

  try {
    let finalUrl = urlInput ? urlInput.value.trim() : '';

    if (fileInput && fileInput.files[0]) {
      const processed = await processAndValidateFile(fileInput.files[0], label, 'pdf', 10);
      if (processed) {
        finalUrl = processed.dataUrl;
      }
    }

    if (!finalUrl) {
      finalUrl = '/assets/cv/ziad-bahgat-cv.pdf';
    }

    const newId = 'cv_' + Date.now();

    const cvSnap = await getDocs(collection(db, "cv_versions"));
    for (let docSnap of cvSnap.docs) {
      await updateDoc(doc(db, "cv_versions", docSnap.id), { isActive: false });
    }

    await setDoc(doc(db, "cv_versions", newId), {
      id: newId,
      label: label,
      uploadDate: new Date().toISOString().split('T')[0],
      storageUrl: finalUrl,
      isActive: true
    });

    labelInput.value = '';
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';

    const refreshed = await getDocs(collection(db, "cv_versions"));
    renderCV(refreshed.docs.map(d => ({ id: d.id, ...d.data() })));
    alert(`✅ Successfully uploaded & set "${label}" as your Active CV!`);

  } catch (err) {
    console.error(err);
  } finally {
    uploadBtn.textContent = "Upload & Save Active CV";
    uploadBtn.disabled = false;
  }
});

window.setActiveCV = async (id) => {
  const cvSnap = await getDocs(collection(db, "cv_versions"));
  for (let docSnap of cvSnap.docs) {
    await updateDoc(doc(db, "cv_versions", docSnap.id), { isActive: docSnap.id === id });
  }
  const refreshed = await getDocs(collection(db, "cv_versions"));
  renderCV(refreshed.docs.map(d => ({ id: d.id, ...d.data() })));
};

window.deleteCV = async (id) => {
  if(!confirm("Delete this CV version?")) return;
  await deleteDoc(doc(db, "cv_versions", id));
  const refreshed = await getDocs(collection(db, "cv_versions"));
  renderCV(refreshed.docs.map(d => ({ id: d.id, ...d.data() })));
};

// --- SNAPS MANAGER ---
function renderSnaps(snaps) {
  const tbody = document.getElementById('snaps-list');
  if (!tbody) return;
  tbody.innerHTML = '';
  snaps.forEach(snap => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td><i class="fa-brands fa-${snap.platform}"></i></td>
        <td>${(snap.caption || "").substring(0, 30)}...</td>
        <td>${snap.dateAdded || snap.date_added || ''}</td>
        <td>
          <button class="action-btn" title="Copy Direct Link" onclick="window.copySnapLink(event, '${snap.id}')"><i class="fa-solid fa-link"></i></button>
          <button class="delete-btn" onclick="window.deleteSnap('${snap.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `);
  });
}

document.getElementById('snap-url')?.addEventListener('input', (e) => {
  const url = e.target.value;
  let id = "";
  if(url.includes("instagram.com/p/")) {
    id = "snap-ig-" + url.split("/p/")[1].split("/")[0];
  } else if (url.includes("tiktok.com")) {
    id = "snap-tk-" + url.split("/video/")[1].split("?")[0];
  } else {
    id = "snap-" + Date.now();
  }
  document.getElementById('snap-id').value = id;
});

if (document.getElementById('snap-date')) {
  document.getElementById('snap-date').valueAsDate = new Date();
}

document.getElementById('add-snap-btn')?.addEventListener('click', async () => {
  const id = document.getElementById('snap-id').value || "snap-" + Date.now();
  const platform = document.getElementById('snap-platform').value;
  const url = document.getElementById('snap-url').value;
  const embedCode = document.getElementById('snap-embed').value;
  const caption = document.getElementById('snap-caption').value;
  const dateAdded = document.getElementById('snap-date').value;

  if(!embedCode) return alert("Embed code required");
  
  await setDoc(doc(db, "snaps", id), {
    id, platform, url, embedCode, caption, dateAdded
  });
  
  document.getElementById('snap-url').value = '';
  document.getElementById('snap-embed').value = '';
  document.getElementById('snap-caption').value = '';
  
  const snapsSnap = await getDocs(collection(db, "snaps"));
  renderSnaps(snapsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
});

window.copySnapLink = (event, id) => {
  const btn = event.currentTarget;
  const originalHtml = btn.innerHTML;
  const snapUrl = window.location.origin + '/snaps/#' + id;
  
  navigator.clipboard.writeText(snapUrl).then(() => {
    btn.innerHTML = '<i class="fa-solid fa-check" style="color: var(--pop);"></i>';
    btn.title = "Copied!";
    setTimeout(() => {
      btn.innerHTML = originalHtml;
      btn.title = "Copy Direct Link";
    }, 2000);
  }).catch(err => {
    alert("Snap link: " + snapUrl);
  });
};

window.deleteSnap = async (id) => {
  if(!confirm("Delete snap?")) return;
  await deleteDoc(doc(db, "snaps", id));
  const snapsSnap = await getDocs(collection(db, "snaps"));
  renderSnaps(snapsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
};

// --- TEAM MANAGER ---
function renderTeam(team) {
  const tbody = document.getElementById('team-list');
  if (!tbody) return;
  tbody.innerHTML = '';
  team.forEach(member => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${member.email}</td>
        <td>${member.role}</td>
        <td>${(member.createdAt || '').split('T')[0]}</td>
        <td>
          ${member.email !== currentEmail ? `<button class="delete-btn" onclick="window.deleteTeam('${member.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
        </td>
      </tr>
    `);
  });
}

document.getElementById('add-team-btn')?.addEventListener('click', async () => {
  const emailInput = document.getElementById('team-email');
  const roleSelect = document.getElementById('team-role');
  const pwInput = document.getElementById('team-temp-pw');

  const email = emailInput ? emailInput.value.trim() : '';
  const role = roleSelect ? roleSelect.value : 'editor';
  const pw = pwInput ? pwInput.value.trim() : '';

  if (!email || !pw) return alert("Email and temporary password required");

  let uid = null;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    uid = cred.user.uid;
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      const teamSnap = await getDocs(collection(db, "admin_users"));
      const existingDoc = teamSnap.docs.find(d => d.data().email && d.data().email.toLowerCase() === email.toLowerCase());
      uid = existingDoc ? existingDoc.id : ('user_' + Date.now());
    } else {
      return alert("Error adding team member: " + err.message);
    }
  }

  try {
    await setDoc(doc(db, "admin_users", uid), {
      id: uid,
      email: email,
      role: role,
      createdAt: new Date().toISOString()
    });

    emailInput.value = '';
    pwInput.value = '';
    
    alert(`✅ Successfully added/updated ${email} as ${role}!`);
    const teamSnap = await getDocs(collection(db, "admin_users"));
    renderTeam(teamSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (dbErr) {
    alert("Error updating team list: " + dbErr.message);
  }
});

window.deleteTeam = async (id) => {
  if(!confirm("Revoke access for this team member?")) return;
  await deleteDoc(doc(db, "admin_users", id));
  const teamSnap = await getDocs(collection(db, "admin_users"));
  renderTeam(teamSnap.docs.map(d => ({ id: d.id, ...d.data() })));
};

// --- ANALYTICS DASHBOARD ---
async function loadAnalyticsData() {
  const pageViewsEl = document.getElementById('stat-page-views');
  const cvDownloadsEl = document.getElementById('stat-cv-downloads');
  const contactClicksEl = document.getElementById('stat-contact-clicks');
  const snapsViewsEl = document.getElementById('stat-snaps-views');
  const tbody = document.getElementById('analytics-breakdown-body');

  if (!pageViewsEl || !tbody) return;

  try {
    const statsDoc = await getDoc(doc(db, "analytics", "stats"));
    if (statsDoc.exists()) {
      const data = statsDoc.data();
      const pageViews = data.pageViews || 0;
      const cvDownloads = data.cvDownloads || 0;
      const snapsViews = data.snapsViews || 0;
      const totalContactClicks = data.totalContactClicks || 0;

      pageViewsEl.textContent = pageViews.toLocaleString();
      cvDownloadsEl.textContent = cvDownloads.toLocaleString();
      contactClicksEl.textContent = totalContactClicks.toLocaleString();
      snapsViewsEl.textContent = snapsViews.toLocaleString();

      const items = [];
      let grandTotal = 0;
      Object.keys(data).forEach(k => {
        if (k.startsWith('contact_') || k === 'cvDownloads' || k === 'snapsViews' || k === 'linkedinPostClicks') {
          const val = data[k] || 0;
          grandTotal += val;
          items.push({ key: k, count: val });
        }
      });

      // Sort descending (highest clicks at top, lowest at bottom)
      items.sort((a, b) => b.count - a.count);

      const rows = items.map(item => {
        let label = item.key;
        if (item.key === 'cvDownloads') label = '📄 CV Downloads';
        else if (item.key === 'snapsViews') label = '🎬 Snaps Feed Views';
        else if (item.key === 'linkedinPostClicks') label = '💼 LinkedIn Posts Read';
        else label = '🔗 Contact: ' + item.key.replace('contact_', '').replace(/_/g, ' ').toUpperCase();

        const sharePct = grandTotal > 0 ? ((item.count / grandTotal) * 100).toFixed(1) : 0;

        return `
          <tr>
            <td><strong>${label}</strong></td>
            <td>${item.count.toLocaleString()} clicks</td>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <div style="flex:1; background:#222; height:8px; border-radius:4px; overflow:hidden;">
                  <div style="width:${sharePct}%; background:var(--pop); height:100%;"></div>
                </div>
                <span style="font-size:12px; color:var(--text-muted); width:45px;">${sharePct}%</span>
              </div>
            </td>
          </tr>
        `;
      });

      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">No interaction events recorded yet. Visit your live site to generate data!</td></tr>`;
      } else {
        tbody.innerHTML = rows.join('');
      }

    } else {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">No analytics recorded yet. Visit your live website to generate metrics!</td></tr>`;
    }
  } catch (e) {
    console.warn("Analytics fetch error:", e);
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--danger);">Failed to load analytics: ${e.message}</td></tr>`;
  }
}

document.getElementById('refresh-analytics-btn')?.addEventListener('click', loadAnalyticsData);

