import { db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- ANALYTICS TRACKING HELPER ---
async function trackEvent(eventName) {
  try {
    const statsRef = doc(db, "analytics", "stats");
    await setDoc(statsRef, { [eventName]: increment(1) }, { merge: true });
  } catch (e) {
    console.warn("Track event error:", e);
  }
}
window.trackEvent = trackEvent;

// Global Delegated Click Tracker (100% Reliable Tracking)
document.addEventListener('click', (e) => {
  const target = e.target.closest('#download-cv-btn, .c-card, .post-link');
  if (!target) return;

  if (target.id === 'download-cv-btn') {
    const href = target.getAttribute('href');
    if (href && href !== 'javascript:void(0)') {
      trackEvent('cvDownloads');
    }
  } else if (target.classList.contains('c-card')) {
    const labelEl = target.querySelector('.c-type');
    const label = labelEl ? labelEl.textContent : 'link';
    const cleanLabel = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
    trackEvent('contact_' + cleanLabel);
    trackEvent('totalContactClicks');
  } else if (target.classList.contains('post-link')) {
    trackEvent('linkedinPostClicks');
  }
});

// Skeleton logic
function setSkeleton(selector) {
  const container = document.querySelector(selector);
  if (container) {
    container.innerHTML = '<div style="opacity:0.5; animation: pulse 1.5s infinite; padding: 20px;">Loading content...</div>';
  }
}

async function fetchSiteData() {
  // Track Page View
  trackEvent('pageViews');

  setSkeleton('#posts-container');
  setSkeleton('#life-container');
  setSkeleton('.contact-grid');

  // 1. HERO
  try {
    const heroDoc = await getDoc(doc(db, "site_content", "hero"));
    if (heroDoc.exists()) {
      const heroData = heroDoc.data();
      const heroText = document.querySelector('.hero-tagline');
      if (heroText && heroData.description) heroText.textContent = heroData.description;
      const heroPhoto = document.querySelector('.photo-inner img');
      if (heroPhoto && (heroData.photoUrl || heroData.photo_url)) {
        heroPhoto.src = heroData.photoUrl || heroData.photo_url;
        heroPhoto.srcset = ""; 
        const sourceNode = document.querySelector('.photo-inner source');
        if (sourceNode) sourceNode.srcset = "";
      }
    }
  } catch (e) {
    console.warn("Hero fetch error:", e);
  }

  // 2. THINKING (Posts)
  try {
    const thinkingSnap = await getDocs(collection(db, "thinking"));
    let thinkingPosts = thinkingSnap.docs.map(d => d.data());
    
    const postsContainer = document.getElementById('posts-container');
    if (postsContainer) {
      if (thinkingPosts.length === 0) {
        postsContainer.innerHTML = '';
      } else {
        thinkingPosts.sort((a, b) => (a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0));
        postsContainer.innerHTML = thinkingPosts.map(post => `
          <div class="post-card">
            <span class="post-date">${post.date || ''}</span>
            <p class="post-text">${post.text || post.description || ''}</p>
            <a href="${post.link || post.url || '#'}" target="_blank" rel="noopener" class="post-link">Read on LinkedIn ↗</a>
          </div>
        `).join('');
      }
    }
  } catch (e) {
    console.warn("Thinking fetch error:", e);
  }

  // 3. LIFE (Milestones)
  try {
    const lifeSnap = await getDocs(collection(db, "life"));
    let lifeSlices = lifeSnap.docs.map(d => d.data());

    const lifeContainer = document.getElementById('life-container');
    if (lifeContainer) {
      if (lifeSlices.length === 0) {
        lifeContainer.innerHTML = '';
      } else {
        lifeSlices.sort((a, b) => (a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0));
        lifeContainer.innerHTML = lifeSlices.map(slice => {
          const imgPath = slice.imagePath || slice.image_path || slice.photo || '';
          const isMissing = slice.imageMissing || slice.image_missing || !imgPath;
          return `
            <div class="life-card">
              <div class="life-img-wrap">
                ${isMissing ? '' : `
                  <img src="${imgPath}" loading="lazy" decoding="async" width="280" height="180" alt="${slice.title || ''}" class="life-img" onerror="this.style.display='none'">
                `}
              </div>
              <div class="life-content">
                <h3 class="life-title">${slice.title || ''}</h3>
                <p class="life-caption">${slice.caption || slice.description || ''}</p>
                <span class="life-date">${slice.date || ''}</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  } catch (e) {
    console.warn("Life fetch error:", e);
  }

  // 4. CONTACT LINKS
  try {
    const contactSnap = await getDocs(collection(db, "contact"));
    let contactLinks = contactSnap.docs.map(d => d.data());

    const contactContainer = document.querySelector('.contact-grid');
    if (contactContainer) {
      if (contactLinks.length === 0) {
        contactContainer.innerHTML = '';
      } else {
        contactLinks.sort((a, b) => (a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0));
        contactContainer.innerHTML = contactLinks.map(link => {
          const displayVal = getDisplayValue(link.label, link.url);
          const iconClass = link.icon || 'fa-solid fa-link';
          return `
            <a href="${link.url}" target="_blank" rel="noopener" class="c-card">
              <div class="c-icon-wrap">
                <i class="${iconClass}" style="font-size: 18px;"></i>
              </div>
              <div class="c-text">
                <div class="c-type">${link.label}</div>
                <div class="c-value">${displayVal}</div>
              </div>
              <span class="c-arrow">↗</span>
            </a>
          `;
        }).join('');
      }
    }
  } catch (e) {
    console.warn("Contact fetch error:", e);
  }

  // 5. CV VERSION
  try {
    const cvSnap = await getDocs(collection(db, "cv_versions"));
    const cvBtn = document.getElementById('download-cv-btn');
    if (cvBtn) {
      if (!cvSnap.empty) {
        const activeCv = cvSnap.docs.map(d => d.data()).find(v => v.isActive || v.is_active);
        if (activeCv && (activeCv.storageUrl || activeCv.storage_url)) {
          cvBtn.href = activeCv.storageUrl || activeCv.storage_url;
          cvBtn.onclick = null;
        } else {
          cvBtn.href = "javascript:void(0)";
          cvBtn.onclick = (e) => {
            e.preventDefault();
            alert("No active CV version is currently published by the administrator.");
          };
        }
      }
    }
  } catch (e) {
    console.warn("CV fetch error:", e);
  }
}

document.addEventListener('DOMContentLoaded', fetchSiteData);

function getDisplayValue(label, url) {
  if (!url) return label || '';
  if (url.startsWith('tel:')) return url.replace('tel:', '');
  if (url.startsWith('mailto:')) return url.replace('mailto:', '');
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('linkedin.com')) {
      const parts = urlObj.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || url;
    }
    if (urlObj.hostname.includes('instagram.com') || urlObj.hostname.includes('tiktok.com')) {
      const parts = urlObj.pathname.split('/').filter(Boolean);
      const username = parts[parts.length - 1] || '';
      return username.startsWith('@') ? username : '@' + username;
    }
  } catch (e) {
    // Fallback
  }
  return label || url;
}
