/* ============================================
   YUMMI RECIPE APP — JavaScript
   Semi-Circle Wheel + Dynamic Recipes + Photo Upload
   ============================================ */

// Helper to resolve images instantly from memory cache if available
function resolveImg(path) {
  if (typeof window !== 'undefined' && window.BUNDLED_IMAGES && window.BUNDLED_IMAGES[path]) {
    return window.BUNDLED_IMAGES[path];
  }
  return path;
}

// ========== RECIPES DATABASE ==========
const REMOVED_RECIPES = [
  'Steamed Dumplings',
  'Strawberry Pastry',
  'Salmon Poke Bowl',
  'Berry Lychee Fizz',
  'Peach Shortcake'
];

const defaultRecipes = [
  {
    name: 'Braised Pork',
    meta: '6 ingredients · 45m · Medium',
    img: 'images/meal1.jpg',
    glowColor: 'rgba(255, 205, 80, 0.75)',
    ingredients: ['Pork belly (500g)', 'Preserved mustard greens', 'Dark & light soy sauce', 'Rock sugar', 'Ginger & garlic slices', 'Shaoxing cooking wine']
  },
  {
    name: 'Soba Noodle Bowl',
    meta: '8 ingredients · 20m · Easy',
    img: 'images/meal2.jpg',
    glowColor: 'rgba(160, 220, 110, 0.7)',
    ingredients: ['Buckwheat soba noodles', 'Broccoli florets', 'Soy sauce soft-boiled egg', 'Avocado cubes', 'Soybean sprouts', 'Sesame oil & dashi']
  },
  {
    name: 'Steak & Mash',
    meta: '7 ingredients · 30m · Medium',
    img: 'images/meal3.jpg',
    glowColor: 'rgba(255, 175, 95, 0.75)',
    ingredients: ['Ribeye steak', 'Russet potatoes (mashed)', 'Fresh asparagus spears', 'Cherry tomatoes', 'Garlic herb butter', 'Sea salt & cracked black pepper']
  },
  {
    name: 'Meatball Soup',
    meta: '9 ingredients · 25m · Easy',
    img: 'images/meal4.jpg',
    glowColor: 'rgba(255, 215, 100, 0.75)',
    ingredients: ['Pork meatballs', 'Fresh baby spinach', 'Egg ribbon omelet slices', 'Chicken broth', 'White pepper', 'Sesame oil & scallions']
  },
  {
    name: 'Tomato & Egg Stir-Fry',
    meta: '5 ingredients · 15m · Easy',
    img: 'images/tomato_egg.jpg',
    glowColor: 'rgba(255, 150, 80, 0.75)',
    ingredients: ['Ripe tomatoes (3 pcs)', 'Eggs (4 pcs, beaten)', 'Scallions (chopped)', 'Pinch of sugar & salt', 'Sesame oil']
  }
];

// ========== FIREBASE SETUP ==========
const firebaseConfig = {
  apiKey: "AIzaSyCq7sXrLc2-pzEuyorf6BeRsCIPZWtDHMM",
  authDomain: "recipe-app-1326f.firebaseapp.com",
  projectId: "recipe-app-1326f",
  storageBucket: "recipe-app-1326f.firebasestorage.app",
  messagingSenderId: "339463174061",
  appId: "1:339463174061:web:e62c7472f4d8cc23975324",
  measurementId: "G-QDMHH246E5"
};

let db = null;
let auth = null;
let currentUser = null;

// Helper to record any uploaded image into Firestore 'uploaded_images' collection
function recordUploadedImageToFirestore(type, base64Data, metadata = {}) {
  if (!db || !base64Data || !base64Data.startsWith('data:')) return;
  db.collection("uploaded_images").add({
    type: type, // 'recipe', 'community_post', or 'profile_avatar'
    img: base64Data,
    name: metadata.name || '',
    caption: metadata.caption || '',
    userId: (currentUser && currentUser.uid) || 'anonymous',
    userName: (currentUser && currentUser.displayName) || (typeof userProfile !== 'undefined' ? userProfile.name : 'Chef'),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then((docRef) => {
    console.log(`Uploaded image [${type}] saved to Firestore with ID:`, docRef.id);
  }).catch((err) => {
    console.warn("Could not record uploaded image to Firestore:", err);
  });
}

if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    console.log("Firebase Auth & Firestore connected successfully!");

    // Listen for Authentication state changes
    auth.onAuthStateChanged((user) => {
      currentUser = user;
      updateAuthUI(user);
      updateCommunityAuthUI(user);
      syncProfileFromFirestore();
    });
  } catch (err) {
    console.warn("Firebase initialization error:", err);
  }
}

// ========== GOOGLE AUTH HANDLERS ==========
function handleGoogleSignIn() {
  if (!auth) {
    alert("Firebase Auth is not initialized yet.");
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  // Using signInWithPopup (falls back gracefully)
  auth.signInWithPopup(provider)
    .then((result) => {
      console.log("Signed in as:", result.user.displayName);
    })
    .catch((error) => {
      console.error("Sign-in error:", error);
      // If popup was blocked or mobile redirect needed
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
        auth.signInWithRedirect(provider).catch((e) => console.error("Redirect error:", e));
      } else {
        alert("Google Sign-In: " + error.message);
      }
    });
}

function handleGoogleSignOut() {
  if (!auth) return;
  closeUserDropdown();
  auth.signOut()
    .then(() => {
      console.log("User signed out");
    })
    .catch((error) => {
      console.error("Sign-out error:", error);
    });
}

function updateAuthUI(user) {
  const loginBtn = document.getElementById('google-login-btn');
  const userBadge = document.getElementById('user-profile-badge');
  const avatarImg = document.getElementById('auth-user-avatar');
  const nameShort = document.getElementById('auth-user-name');
  const dropdownName = document.getElementById('dropdown-user-name');
  const dropdownEmail = document.getElementById('dropdown-user-email');

  if (user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userBadge) userBadge.style.display = 'inline-flex';

    const displayName = user.displayName || userProfile.name || 'Chef';
    const photoURL = user.photoURL || userProfile.avatar || 'images/meal2.jpg';
    const email = user.email || '';

    if (avatarImg) avatarImg.src = photoURL;
    if (nameShort) nameShort.textContent = displayName.split(' ')[0];
    if (dropdownName) dropdownName.textContent = displayName;
    if (dropdownEmail) dropdownEmail.textContent = email;

    if (!userProfile.avatar && user.photoURL) {
      userProfile.avatar = user.photoURL;
    }
    if (user.displayName && (!userProfile.name || userProfile.name === 'Chef Linda')) {
      userProfile.name = user.displayName;
    }
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (userBadge) userBadge.style.display = 'none';
  }
  applyUserProfileToUI();
}

function toggleUserDropdown(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('user-dropdown-menu');
  const badge = document.getElementById('user-profile-badge');
  if (dropdown) {
    dropdown.classList.toggle('show');
    if (badge) badge.classList.toggle('menu-open');
  }
}

function closeUserDropdown() {
  const dropdown = document.getElementById('user-dropdown-menu');
  const badge = document.getElementById('user-profile-badge');
  if (dropdown) dropdown.classList.remove('show');
  if (badge) badge.classList.remove('menu-open');
}

// Close dropdown when tapping anywhere else on the document
document.addEventListener('click', () => {
  closeUserDropdown();
});

// ========== USER PROFILE MANAGER ==========
let userProfile = (function loadUserProfile() {
  try {
    const stored = localStorage.getItem('YUMMI_PINK_PROFILE');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Could not read user profile:', e);
  }
  return {
    name: 'Chef Linda',
    bio: 'Your recipes live here ✨',
    avatar: ''
  };
})();

let pendingEditProfileAvatarData = null;

function applyUserProfileToUI() {
  const nameEls = document.querySelectorAll('.profile-name');
  nameEls.forEach(el => {
    if (el.id !== 'user-modal-name') {
      el.textContent = userProfile.name;
    }
  });

  const bioEl = document.querySelector('.profile-bio');
  if (bioEl && bioEl.id !== 'user-modal-bio') {
    bioEl.textContent = userProfile.bio;
  }

  const avatarImg = document.getElementById('profile-page-avatar-img');
  const avatarDef = document.getElementById('profile-page-avatar-default');
  if (userProfile.avatar) {
    if (avatarImg) {
      avatarImg.src = userProfile.avatar;
      avatarImg.style.display = 'block';
    }
    if (avatarDef) avatarDef.style.display = 'none';
  } else if (!currentUser) {
    if (avatarImg) avatarImg.style.display = 'none';
    if (avatarDef) avatarDef.style.display = 'flex';
  }

  const authName = document.getElementById('auth-user-name');
  const authAvatar = document.getElementById('auth-user-avatar');
  if (!currentUser) {
    if (authName) authName.textContent = (userProfile.name || 'Chef').split(' ')[0];
    if (authAvatar && userProfile.avatar) authAvatar.src = userProfile.avatar;
  }
}

function openEditProfileModal() {
  const modal = document.getElementById('edit-profile-modal-backdrop');
  const nameInput = document.getElementById('edit-profile-name-input');
  const bioInput = document.getElementById('edit-profile-bio-input');
  const previewImg = document.getElementById('edit-profile-avatar-preview');
  const defaultSvg = document.getElementById('edit-profile-avatar-default');

  if (nameInput) nameInput.value = userProfile.name || 'Chef Linda';
  if (bioInput) bioInput.value = userProfile.bio || 'Your recipes live here ✨';

  pendingEditProfileAvatarData = userProfile.avatar || null;
  if (pendingEditProfileAvatarData) {
    if (previewImg) {
      previewImg.src = pendingEditProfileAvatarData;
      previewImg.style.display = 'block';
    }
    if (defaultSvg) defaultSvg.style.display = 'none';
  } else {
    if (previewImg) previewImg.style.display = 'none';
    if (defaultSvg) defaultSvg.style.display = 'flex';
  }

  if (modal) modal.classList.add('open');
}

function closeEditProfileModal() {
  const modal = document.getElementById('edit-profile-modal-backdrop');
  if (modal) modal.classList.remove('open');
  pendingEditProfileAvatarData = null;
}

function triggerEditProfilePhoto() {
  const input = document.getElementById('edit-profile-photo-input');
  if (input) input.click();
}

function handleEditProfilePhotoSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const rawData = e.target.result;
    const img = new Image();
    img.onload = function () {
      const maxDim = 320;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      pendingEditProfileAvatarData = canvas.toDataURL('image/jpeg', 0.85);

      const previewImg = document.getElementById('edit-profile-avatar-preview');
      const defaultSvg = document.getElementById('edit-profile-avatar-default');
      if (previewImg) {
        previewImg.src = pendingEditProfileAvatarData;
        previewImg.style.display = 'block';
      }
      if (defaultSvg) defaultSvg.style.display = 'none';
    };
    img.src = rawData;
  };
  reader.readAsDataURL(file);
}

function saveUserProfile() {
  const nameInput = document.getElementById('edit-profile-name-input');
  const bioInput = document.getElementById('edit-profile-bio-input');

  const newName = (nameInput && nameInput.value.trim()) || 'Chef Linda';
  const newBio = (bioInput && bioInput.value.trim()) || 'Your recipes live here ✨';

  userProfile.name = newName;
  userProfile.bio = newBio;
  if (pendingEditProfileAvatarData !== null) {
    userProfile.avatar = pendingEditProfileAvatarData;
  }

  try {
    localStorage.setItem('YUMMI_PINK_PROFILE', JSON.stringify(userProfile));
  } catch (e) {
    console.warn('Could not save profile to localStorage:', e);
  }

  // Record profile and uploaded avatar image to Firestore
  if (db) {
    const docId = (currentUser && currentUser.uid) ? currentUser.uid : 'default_profile';
    db.collection("user_profiles").doc(docId).set({
      name: newName,
      bio: newBio,
      avatar: userProfile.avatar || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
      .then(() => console.log("Profile recorded to Firestore successfully!"))
      .catch((err) => console.warn("Could not save profile to Firestore:", err));

    if (userProfile.avatar && userProfile.avatar.startsWith('data:')) {
      recordUploadedImageToFirestore('profile_avatar', userProfile.avatar, { name: newName });
    }
  }

  applyUserProfileToUI();
  closeEditProfileModal();
}

function syncProfileFromFirestore() {
  if (!db) return;
  const docId = (currentUser && currentUser.uid) ? currentUser.uid : 'default_profile';
  db.collection("user_profiles").doc(docId).get()
    .then((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data.avatar && !userProfile.avatar) userProfile.avatar = data.avatar;
        if (data.name && (!userProfile.name || userProfile.name === 'Chef Linda')) userProfile.name = data.name;
        if (data.bio && (!userProfile.bio || userProfile.bio === 'Your recipes live here ✨')) userProfile.bio = data.bio;
        applyUserProfileToUI();
      }
    })
    .catch((err) => console.warn("Could not sync profile from Firestore:", err));
}

// Load recipes from localStorage or fallback
let recipes = (function loadStoredRecipes() {
  try {
    const stored = localStorage.getItem('YUMMI_PINK_RECIPES');
    if (stored) {
      let parsed = JSON.parse(stored);
      // Filter out removed recipes and ensure clean data
      if (Array.isArray(parsed) && parsed.length >= 1) {
        parsed = parsed.filter(r => r && r.name && !REMOVED_RECIPES.includes(r.name) && !(r.img && r.img.includes('pink_dish')));
        if (parsed.length >= 1) {
          localStorage.setItem('YUMMI_PINK_RECIPES', JSON.stringify(parsed));
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Could not read localStorage:', e);
  }
  return defaultRecipes.slice();
})();

// Sync with Firestore (load any community/uploaded recipes saved in Firestore)
function syncFromFirestore() {
  if (!db) return;
  db.collection("recipes").orderBy("createdAt", "desc").get()
    .then((querySnapshot) => {
      let firestoreRecipes = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (REMOVED_RECIPES.includes(data.name)) return;
        firestoreRecipes.push({
          id: doc.id,
          name: data.name,
          meta: data.meta,
          img: data.img,
          glowColor: data.glowColor || 'rgba(255, 205, 80, 0.75)',
          ingredients: data.ingredients || ['Fresh ingredients', 'Cooked with love'],
          fromFirestore: true
        });
      });

      if (firestoreRecipes.length > 0) {
        // Merge into recipes, avoiding duplicates by id or name
        firestoreRecipes.forEach((fRec) => {
          if (REMOVED_RECIPES.includes(fRec.name)) return;
          const exists = recipes.some(r => (r.id && r.id === fRec.id) || (r.name === fRec.name && r.img === fRec.img));
          if (!exists) {
            recipes.unshift(fRec);
          }
        });
        persistRecipes();
        if (typeof updateWheelDishesFn === 'function') updateWheelDishesFn();
        renderBrowseGrid();
        renderProfileRecipes();
      }
    })
    .catch((err) => {
      console.warn("Could not sync recipes from Firestore:", err);
    });
}

// Trigger initial sync once DOM and Firebase are ready
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    syncFromFirestore();
  });
}

function persistRecipes() {
  try {
    localStorage.setItem('YUMMI_PINK_RECIPES', JSON.stringify(recipes));
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
}

// ========== PAGE NAVIGATION ==========
function switchPage(pageId, btnEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  if (target) {
    target.classList.add('active');
    target.scrollTop = 0;
  }
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
}

// ========== DYNAMIC RENDERING ==========

let currentActiveRecipeIndex = 0;

// Render Browse Grid (Page 2)
function renderBrowseGrid() {
  const grid = document.getElementById('recipe-grid');
  const countEl = document.getElementById('browse-recipe-count');
  const profileCountEl = document.getElementById('profile-recipe-count');

  if (countEl) countEl.textContent = `${recipes.length} delicious favorites`;
  if (profileCountEl) profileCountEl.textContent = recipes.length;
  if (!grid) return;

  grid.innerHTML = recipes.map((rec, i) => `
    <div class="recipe-card" onclick="openRecipeByIndex(${i})">
      <div class="recipe-card-img">
        <img src="${resolveImg(rec.img)}" alt="${rec.name}" loading="lazy" />
      </div>
      <div class="recipe-card-info">
        <h3>${rec.name}</h3>
        <p>${rec.meta}</p>
        <div class="recipe-rating">
          <span class="star">★</span><span class="star">★</span><span class="star">★</span><span class="star">★</span><span class="star">★</span>
        </div>
      </div>
    </div>
  `).join('');
}

// Render Published Recipes Grid on Profile Page
function renderProfileRecipes() {
  const grid = document.getElementById('profile-recipes-grid');
  const countBadge = document.getElementById('profile-recipes-badge');
  const statCount = document.getElementById('profile-recipe-count');

  if (countBadge) countBadge.textContent = `${recipes.length} recipes`;
  if (statCount) statCount.textContent = recipes.length;
  if (!grid) return;

  grid.innerHTML = recipes.map((rec, i) => `
    <div class="recipe-card" onclick="openRecipeByIndex(${i})">
      <div class="recipe-card-img">
        <img src="${resolveImg(rec.img)}" alt="${escapeHtml(rec.name)}" loading="lazy" />
      </div>
      <div class="recipe-card-info">
        <h3>${escapeHtml(rec.name)}</h3>
        <p>${escapeHtml(rec.meta)}</p>
        <div class="recipe-rating">
          <span class="star">★</span><span class="star">★</span><span class="star">★</span><span class="star">★</span><span class="star">★</span>
        </div>
      </div>
    </div>
  `).join('');
}

// Render Wheel Dishes (Page 1)
function renderWheelDishes() {
  const pivot = document.getElementById('wheel-pivot');
  if (!pivot) return;

  pivot.innerHTML = recipes.map((rec, i) => `
    <div class="dish" data-index="${i}">
      <!-- Arc curved text attached directly to each individual dish -->
      <div class="dish-curved-title-wrap">
        <svg class="dish-arc-svg" viewBox="0 0 340 130" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
          <defs>
            <path id="dish-arc-path-${i}" d="M 25,105 A 165,165 0 0,1 315,105" fill="none" />
          </defs>
          <text class="dish-arc-text" font-family="'Gaegu', 'Patrick Hand', cursive, sans-serif" font-weight="700">
            <textPath href="#dish-arc-path-${i}" xlink:href="#dish-arc-path-${i}" startOffset="50%" text-anchor="middle">
              ${escapeHtml(rec.name)}
            </textPath>
          </text>
        </svg>
      </div>

      <div class="dish-circle">
        <img src="${resolveImg(rec.img)}" alt="${escapeHtml(rec.name)}" draggable="false" decoding="sync" fetchpriority="${i < 3 ? 'high' : 'auto'}" />
      </div>
    </div>
  `).join('');
}

// Preload rest of recipe images in background
function preloadAllRecipeImages() {
  if (typeof window === 'undefined') return;
  recipes.forEach(r => {
    if (r.img) {
      const im = new Image();
      im.src = r.img;
    }
  });
}

// ========== INTERACTIVE SEMI-CIRCLE WHEEL ==========
let updateWheelDishesFn = null;
let snapToWheelIndexFn = null;

(function initWheel() {
  const stage = document.getElementById('wheel-stage');
  const pivot = document.getElementById('wheel-pivot');
  const glow = document.getElementById('home-glow');

  if (!stage || !pivot) return;

  // Initial renders
  renderWheelDishes();
  renderBrowseGrid();
  renderProfileRecipes();

  let currentAngle = 0; // Global rotation angle in degrees
  let isDragging = false;
  let startX = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0;
  let animFrame = null;
  let glowTimer = null;

  function getRadius() {
    const stageWidth = stage.clientWidth || window.innerWidth;
    return Math.max(180, Math.min(stageWidth * 0.58, 255));
  }

  function updateDishes() {
    const radius = getRadius();
    const dishes = Array.from(pivot.querySelectorAll('.dish'));
    const numItems = recipes.length;
    if (numItems === 0) return;

    const stepAngle = 360 / numItems;

    dishes.forEach((dish, i) => {
      const nominalAngle = (i * stepAngle) + currentAngle;
      let diff = ((nominalAngle % 360) + 540) % 360 - 180; // range [-180, 180]

      // ratio = diff / stepAngle (0 = apex, +1 = right neighbor, -1 = left neighbor)
      const ratio = diff / stepAngle;

      // Map to visual arc angle (approx 58° per step)
      const arcAngleDeg = ratio * 58;
      const arcAngleRad = (arcAngleDeg * Math.PI) / 180;

      const x = radius * Math.sin(arcAngleRad);
      const y = radius * (1 - Math.cos(arcAngleRad));

      const absRatio = Math.abs(ratio);

      // Scale: 1.15 at apex down to 0.76 for neighbors
      const scale = Math.max(0.65, 1.15 - (Math.min(absRatio, 1.5) * 0.36));

      // Opacity: smoothly visible for |ratio| <= 1.45, fades to 0 beyond that
      let opacity = 0;
      if (absRatio <= 1.45) {
        opacity = Math.max(0, 1 - Math.pow(absRatio / 1.45, 2));
      }

      const zIndex = Math.round((1 - Math.min(1, absRatio / 2)) * 50);

      dish.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      dish.style.opacity = opacity.toFixed(2);
      dish.style.zIndex = zIndex;
      dish.style.pointerEvents = opacity < 0.25 ? 'none' : 'auto';

      dish.classList.toggle('active-dish', absRatio < 0.5);

      // Fade arc text: fully visible on center dish, hidden on side dishes
      const titleWrap = dish.querySelector('.dish-curved-title-wrap');
      if (titleWrap) {
        titleWrap.style.opacity = absRatio < 0.5 ? '1' : '0';
      }
    });
  }

  function getClosestIndex() {
    let closestIdx = 0;
    let minDiff = Infinity;
    const numItems = recipes.length;
    if (numItems === 0) return 0;
    const stepAngle = 360 / numItems;

    for (let i = 0; i < numItems; i++) {
      const nominalAngle = (i * stepAngle) + currentAngle;
      const diff = Math.abs(((nominalAngle % 360) + 540) % 360 - 180);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    return closestIdx;
  }

  function onRecipeSelected(index) {
    currentActiveRecipeIndex = index;
    const recipe = recipes[index];
    if (!recipe) return;

    clearTimeout(glowTimer);
    glowTimer = setTimeout(() => {
      glow.classList.add('glowing');
      if (recipe.glowColor) {
        glow.style.background = `radial-gradient(circle, ${recipe.glowColor} 0%, rgba(247, 185, 80, 0.35) 45%, transparent 72%)`;
      }
    }, 110);
  }

  function dimGlowWhileSpinning() {
    glow.classList.remove('glowing');
  }

  function snapToIndex(targetIndex) {
    if (animFrame) cancelAnimationFrame(animFrame);
    const numItems = recipes.length;
    if (numItems === 0) return;

    const stepAngle = 360 / numItems;
    const idealAngle = -(targetIndex * stepAngle);
    let diff = ((idealAngle - currentAngle) % 360 + 540) % 360 - 180;
    const finalAngle = currentAngle + diff;

    const start = currentAngle;
    const distance = diff;
    const startTime = performance.now();
    const duration = Math.min(450, Math.max(240, Math.abs(distance) * 4.5));

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      currentAngle = start + distance * easeOutCubic(progress);
      updateDishes();

      if (progress < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        currentAngle = finalAngle;
        updateDishes();
        onRecipeSelected(targetIndex);
      }
    }

    animFrame = requestAnimationFrame(step);
  }

  function applyInertia() {
    const friction = 0.92;
    const minVelocity = 0.12;

    function step() {
      velocity *= friction;
      currentAngle += velocity;
      updateDishes();

      if (Math.abs(velocity) > minVelocity) {
        animFrame = requestAnimationFrame(step);
      } else {
        const bestIdx = getClosestIndex();
        snapToIndex(bestIdx);
      }
    }

    animFrame = requestAnimationFrame(step);
  }

  function onDragStart(clientX) {
    if (animFrame) cancelAnimationFrame(animFrame);
    isDragging = true;
    startX = clientX;
    lastX = clientX;
    lastTime = performance.now();
    velocity = 0;
    dimGlowWhileSpinning();
  }

  function onDragMove(clientX) {
    if (!isDragging) return;

    const deltaX = clientX - lastX;
    const numItems = recipes.length;
    const stepAngle = 360 / numItems;

    // A swipe of 150px advances 1 recipe
    const angleDelta = (deltaX / 150) * stepAngle;

    currentAngle += angleDelta;
    lastX = clientX;

    const now = performance.now();
    const dt = now - lastTime;
    if (dt > 0) {
      velocity = (angleDelta / dt) * 16;
    }
    lastTime = now;

    updateDishes();
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;

    if (Math.abs(velocity) > 0.3) {
      applyInertia();
    } else {
      const bestIdx = getClosestIndex();
      snapToIndex(bestIdx);
    }
  }

  // Touch handlers
  stage.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) onDragStart(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length === 1) onDragMove(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener('touchend', onDragEnd);
  window.addEventListener('touchcancel', onDragEnd);

  // Mouse handlers
  stage.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onDragStart(e.clientX);
  });
  window.addEventListener('mousemove', (e) => {
    if (isDragging) onDragMove(e.clientX);
  });
  window.addEventListener('mouseup', () => {
    if (isDragging) onDragEnd();
  });

  // Tap on dish
  pivot.addEventListener('click', (e) => {
    const dish = e.target.closest('.dish');
    if (!dish) return;
    const idx = parseInt(dish.getAttribute('data-index'), 10);
    if (!isNaN(idx) && (!isDragging || Math.abs(velocity) < 0.2)) {
      snapToIndex(idx);
    }
  });

  window.addEventListener('resize', updateDishes);

  // Exports for dynamic additions
  updateWheelDishesFn = () => {
    renderWheelDishes();
    updateDishes();
  };
  snapToWheelIndexFn = (idx) => {
    snapToIndex(idx);
  };

  // Initial load
  updateDishes();
  setTimeout(() => snapToIndex(0), 100);
})();

// ========== RECIPE DETAIL MODAL (OPEN BUTTON) ==========

let currentModalRecipeIndex = 0;

function openRecipeModalWithData(recipe, idx) {
  if (!recipe) return;
  currentModalRecipeIndex = (typeof idx === 'number') ? idx : currentActiveRecipeIndex;

  const backdrop = document.getElementById('recipe-modal-backdrop');
  const imgEl = document.getElementById('modal-img');
  const titleEl = document.getElementById('modal-title');
  const metaEl = document.getElementById('modal-meta');
  const ingList = document.getElementById('modal-ingredients');

  imgEl.src = resolveImg(recipe.img);
  titleEl.textContent = recipe.name;
  metaEl.textContent = recipe.meta;

  if (recipe.ingredients && recipe.ingredients.length > 0) {
    ingList.innerHTML = recipe.ingredients.map(ing => `<li>${ing}</li>`).join('');
  } else {
    ingList.innerHTML = `
      <li>Fresh ingredients prepared with passion</li>
      <li>Seasoned with garlic, scallions, and soy sauce</li>
      <li>Cooked to golden perfection</li>
    `;
  }

  backdrop.classList.add('open');
}

function openCurrentRecipeModal() {
  const current = recipes[currentActiveRecipeIndex];
  openRecipeModalWithData(current, currentActiveRecipeIndex);
}

function openRecipeByIndex(idx) {
  const current = recipes[idx];
  openRecipeModalWithData(current, idx);
}

function closeRecipeModal() {
  const backdrop = document.getElementById('recipe-modal-backdrop');
  backdrop.classList.remove('open');
}

function deleteCurrentModalRecipe() {
  if (recipes.length <= 1) {
    alert('You need at least 1 recipe in your app!');
    return;
  }

  const recipeToRemove = recipes[currentModalRecipeIndex];
  const recipeName = recipeToRemove ? recipeToRemove.name : 'this recipe';

  if (!confirm(`Are you sure you want to remove "${recipeName}"?`)) {
    return;
  }

  // If stored in Firestore, delete from collection as well
  if (db && recipeToRemove.id) {
    db.collection("recipes").doc(recipeToRemove.id).delete()
      .then(() => console.log("Deleted recipe from Firestore:", recipeToRemove.id))
      .catch((err) => console.warn("Failed to delete from Firestore:", err));
  }

  // Remove from array and persist
  recipes.splice(currentModalRecipeIndex, 1);
  persistRecipes();

  // Close modal
  closeRecipeModal();

  // Re-render both views
  if (updateWheelDishesFn) updateWheelDishesFn();
  renderBrowseGrid();
  renderProfileRecipes();

  // Snap to safe index
  if (snapToWheelIndexFn) {
    const nextIdx = Math.max(0, Math.min(currentModalRecipeIndex, recipes.length - 1));
    setTimeout(() => snapToWheelIndexFn(nextIdx), 150);
  }
}

// ========== PHOTO LIBRARY UPLOAD (PAGE 3: ADD) ==========

let pendingRecipeImageData = null;

function triggerPhotoLibrary() {
  const input = document.getElementById('recipe-file-input');
  if (input) input.click();
}

function handlePhotoSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const rawData = e.target.result;

    // Downscale via canvas to max 600x600 for optimal speed and storage
    const img = new Image();
    img.onload = function () {
      const maxDim = 600;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      pendingRecipeImageData = canvas.toDataURL('image/jpeg', 0.85);

      // Show preview and remove button
      const previewImg = document.getElementById('add-preview-img');
      const plusIcon = document.querySelector('.placeholder-plus-icon');
      const label = document.getElementById('add-photo-label');
      const removeBtn = document.getElementById('remove-photo-btn');

      if (previewImg && plusIcon) {
        previewImg.src = pendingRecipeImageData;
        previewImg.style.display = 'block';
        plusIcon.style.display = 'none';
        if (label) label.textContent = 'Looks delicious! Tap to change 📸';
        if (removeBtn) removeBtn.style.display = 'inline-block';
      }

      // Auto-focus the name field
      const nameInput = document.getElementById('input-recipe-name');
      if (nameInput) nameInput.focus();
    };
    img.src = rawData;
  };
  reader.readAsDataURL(file);
}

function clearSelectedPhoto() {
  pendingRecipeImageData = null;
  const fileInput = document.getElementById('recipe-file-input');
  if (fileInput) fileInput.value = '';

  const previewImg = document.getElementById('add-preview-img');
  const plusIcon = document.querySelector('.placeholder-plus-icon');
  const label = document.getElementById('add-photo-label');
  const removeBtn = document.getElementById('remove-photo-btn');

  if (previewImg && plusIcon) {
    previewImg.style.display = 'none';
    previewImg.src = '';
    plusIcon.style.display = 'block';
    if (label) label.textContent = 'Tap to choose from Library 📸';
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

function saveNewRecipe() {
  const nameInput = document.getElementById('input-recipe-name');
  const metaInput = document.getElementById('input-recipe-meta');

  const name = (nameInput && nameInput.value.trim()) || 'My Secret Recipe';
  const meta = (metaInput && metaInput.value.trim()) || 'Fresh ingredients · 20m · Easy';
  const img = pendingRecipeImageData || 'images/tomato_egg.jpg';

  const newRecipe = {
    name: name,
    meta: meta,
    img: img,
    glowColor: 'rgba(255, 205, 80, 0.75)',
    ingredients: ['Fresh seasonal produce', 'Chef secret seasonings', 'Cooked with love']
  };

  // Record to Firebase Firestore if connected
  if (db) {
    db.collection("recipes").add({
      name: newRecipe.name,
      meta: newRecipe.meta,
      img: newRecipe.img,
      glowColor: newRecipe.glowColor,
      ingredients: newRecipe.ingredients,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then((docRef) => {
      console.log("Recorded recipe to Firestore with ID:", docRef.id);
      newRecipe.id = docRef.id;
      persistRecipes();
    }).catch((error) => {
      console.error("Error adding recipe to Firestore:", error);
    });

    // Record uploaded image to Firestore uploaded_images collection
    if (newRecipe.img && newRecipe.img.startsWith('data:')) {
      recordUploadedImageToFirestore('recipe', newRecipe.img, { name: newRecipe.name });
    }
  }

  // Add to top of list
  recipes.unshift(newRecipe);
  persistRecipes();

  // Re-render both Wheel and Browse Grid!
  if (updateWheelDishesFn) updateWheelDishesFn();
  renderBrowseGrid();
  renderProfileRecipes();

  // Reset form
  if (nameInput) nameInput.value = '';
  if (metaInput) metaInput.value = '';
  clearSelectedPhoto();

  // Switch to Home page and highlight the new recipe!
  const homeBtn = document.querySelector('.nav-btn[data-page="page-home"]');
  switchPage('page-home', homeBtn);
  if (snapToWheelIndexFn) {
    setTimeout(() => snapToWheelIndexFn(0), 150);
  }
}

// ========== COMMUNITY: LIKE BUTTON ==========
function toggleLike(btn) {
  btn.classList.toggle('liked');
  const countEl = btn.querySelector('.like-count');
  if (countEl) {
    let count = parseInt(countEl.textContent, 10);
    count += btn.classList.contains('liked') ? 1 : -1;
    countEl.textContent = count;
  }
}

// ============================================
// LIVE COMMUNITY FEED (FIRESTORE REAL-TIME)
// ============================================
let communityPosts = [];
let communityUnsubscribe = null;
let pendingCommunityPhotoData = null;

function updateCommunityAuthUI(user) {
  const createCard = document.getElementById('create-post-card');
  const loginPrompt = document.getElementById('create-post-login-prompt');
  const createAvatar = document.getElementById('create-post-avatar');
  const greeting = document.getElementById('create-post-greeting');
  const profileAvatarImg = document.getElementById('profile-page-avatar-img');
  const profileAvatarDef = document.getElementById('profile-page-avatar-default');
  const profilePostsCount = document.getElementById('profile-posts-count');

  if (user) {
    if (createCard) createCard.style.display = 'flex';
    if (loginPrompt) loginPrompt.style.display = 'none';
    if (createAvatar) createAvatar.src = user.photoURL || 'images/dish_new1.jpg';
    if (greeting) greeting.textContent = `${user.displayName ? user.displayName.split(' ')[0] : 'Chef'}'s kitchen moment...`;

    if (profileAvatarImg) {
      profileAvatarImg.src = user.photoURL || '';
      profileAvatarImg.style.display = 'block';
    }
    if (profileAvatarDef) profileAvatarDef.style.display = 'none';

    if (profilePostsCount) {
      const myPosts = communityPosts.filter(p => p.userId === user.uid);
      profilePostsCount.textContent = myPosts.length;
    }
  } else {
    if (createCard) createCard.style.display = 'none';
    if (loginPrompt) loginPrompt.style.display = 'block';
    if (profileAvatarImg) profileAvatarImg.style.display = 'none';
    if (profileAvatarDef) profileAvatarDef.style.display = 'block';
  }
}

function triggerCommunityPhoto() {
  const input = document.getElementById('community-photo-input');
  if (input) input.click();
}

function handleCommunityPhotoSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const rawData = e.target.result;
    const img = new Image();
    img.onload = function () {
      const maxDim = 800;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      pendingCommunityPhotoData = canvas.toDataURL('image/jpeg', 0.8);

      const wrap = document.getElementById('post-photo-preview-wrap');
      const prevImg = document.getElementById('post-photo-preview-img');
      if (wrap && prevImg) {
        prevImg.src = pendingCommunityPhotoData;
        wrap.style.display = 'inline-block';
      }
    };
    img.src = rawData;
  };
  reader.readAsDataURL(file);
}

function clearCommunityPhoto() {
  pendingCommunityPhotoData = null;
  const input = document.getElementById('community-photo-input');
  if (input) input.value = '';
  const wrap = document.getElementById('post-photo-preview-wrap');
  if (wrap) wrap.style.display = 'none';
}

function publishCommunityPost() {
  if (!currentUser) {
    alert("Please sign in with Google first to publish to the community! 🌸");
    handleGoogleSignIn();
    return;
  }
  const captionInput = document.getElementById('post-caption-input');
  const caption = (captionInput && captionInput.value.trim()) || '';

  if (!caption && !pendingCommunityPhotoData) {
    alert("Please write something or attach a photo before posting! ✨");
    return;
  }

  const publishBtn = document.getElementById('publish-post-btn');
  if (publishBtn) {
    publishBtn.disabled = true;
    publishBtn.textContent = 'Posting... 🌸';
  }

  const newPostData = {
    userId: currentUser.uid,
    userName: currentUser.displayName || 'Chef',
    userEmail: currentUser.email || '',
    userAvatar: currentUser.photoURL || 'images/dish_new1.jpg',
    caption: caption,
    img: pendingCommunityPhotoData || '',
    likes: 0,
    likedBy: [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (!db) {
    alert("Database connection is initializing, please try again in a moment.");
    if (publishBtn) { publishBtn.disabled = false; publishBtn.textContent = 'Publish ✨'; }
    return;
  }

  db.collection("community_posts").add(newPostData)
    .then((docRef) => {
      console.log("Community post published with ID:", docRef.id);
      if (newPostData.img && newPostData.img.startsWith('data:')) {
        recordUploadedImageToFirestore('community_post', newPostData.img, { caption: newPostData.caption });
      }
      if (captionInput) captionInput.value = '';
      clearCommunityPhoto();
      if (publishBtn) {
        publishBtn.disabled = false;
        publishBtn.textContent = 'Publish ✨';
      }
    })
    .catch((err) => {
      console.error("Error publishing community post:", err);
      alert("Error sharing post: " + err.message);
      if (publishBtn) {
        publishBtn.disabled = false;
        publishBtn.textContent = 'Publish ✨';
      }
    });
}

function listenToCommunityPosts() {
  if (!db) return;
  if (communityUnsubscribe) communityUnsubscribe();

  communityUnsubscribe = db.collection("community_posts")
    .orderBy("createdAt", "desc")
    .limit(40)
    .onSnapshot((snapshot) => {
      communityPosts = [];
      snapshot.forEach((doc) => {
        communityPosts.push({ id: doc.id, ...doc.data() });
      });

      if (communityPosts.length === 0) {
        seedInitialCommunityPosts();
      } else {
        renderCommunityFeed();
      }

      if (currentUser) {
        const myPosts = communityPosts.filter(p => p.userId === currentUser.uid);
        const profilePostsCount = document.getElementById('profile-posts-count');
        if (profilePostsCount) profilePostsCount.textContent = myPosts.length;
      }
    }, (err) => {
      console.warn("Community feed snapshot notice:", err);
      renderFallbackCommunityFeed();
    });
}

function renderCommunityFeed() {
  const container = document.getElementById('community-posts-container');
  if (!container) return;

  if (communityPosts.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 30px; font-family: var(--font-display); font-size: 22px; color: var(--text-light);">
        Be the first to share a warm dish in our community! 🌸
      </div>
    `;
    return;
  }

  container.innerHTML = communityPosts.map((post) => {
    const isLiked = currentUser && post.likedBy && post.likedBy.includes(currentUser.uid);
    const timeStr = formatPostTime(post.createdAt);
    const avatar = post.userAvatar || 'images/dish_new1.jpg';
    const name = post.userName || 'Community Chef';
    const imageHtml = post.img ? `
      <div class="post-image">
        <img src="${post.img}" alt="${escapeHtml(post.caption || 'Meal')}" loading="lazy" onerror="this.onerror=null;this.parentElement.style.display='none';" />
      </div>
    ` : '';

    return `
      <div class="community-post" data-post-id="${post.id}">
        <!-- Clickable post header to open User Profile -->
        <div class="post-header" onclick="openUserProfileModal('${post.userId}', '${escapeAttr(name)}', '${escapeAttr(avatar)}')">
          <div class="post-avatar">
            <img src="${avatar}" alt="${name}" onerror="this.onerror=null;this.src='images/dish_new1.jpg';" />
          </div>
          <div class="post-user-info">
            <span class="post-username">
              ${escapeHtml(name)}
              <span class="post-user-badge-tag">view profile ↗</span>
            </span>
            <span class="post-time">${timeStr}</span>
          </div>
        </div>
        ${imageHtml}
        <div class="post-content">
          ${post.caption ? `<p class="post-caption">${escapeHtml(post.caption)}</p>` : ''}
          <div class="post-actions">
            <button class="post-action-btn like-btn ${isLiked ? 'liked' : ''}" onclick="togglePostLike('${post.id}')">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M12 21C12 21 3 13.5 3 8.5C3 5.4 5.4 3 8.5 3C10.2 3 11.8 3.8 12 5C12.2 3.8 13.8 3 15.5 3C18.6 3 21 5.4 21 8.5C21 13.5 12 21 12 21Z"
                  fill="none" stroke="#E8A03E" stroke-width="1.8" stroke-linecap="round" />
              </svg>
              <span class="like-count">${post.likes || (post.likedBy ? post.likedBy.length : 0)}</span>
            </button>
            <button class="post-action-btn" onclick="openUserProfileModal('${post.userId}', '${escapeAttr(name)}', '${escapeAttr(avatar)}')">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#A08770" stroke-width="1.8">
                <circle cx="12" cy="7" r="4"></circle>
                <path d="M5 21v-2a7 7 0 0 1 14 0v2"></path>
              </svg>
              <span>Chef Info</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderFallbackCommunityFeed() {
  const container = document.getElementById('community-posts-container');
  if (!container) return;
  container.innerHTML = `
    <div class="community-post">
      <div class="post-header" onclick="openUserProfileModal('sample-1', 'Maria K.', 'images/meal1.jpg')">
        <div class="post-avatar"><img src="images/meal1.jpg" alt="Maria" /></div>
        <div class="post-user-info">
          <span class="post-username">Maria K. <span class="post-user-badge-tag">view profile ↗</span></span>
          <span class="post-time">2 hours ago</span>
        </div>
      </div>
      <div class="post-image"><img src="images/meal1.jpg" alt="" /></div>
      <div class="post-content">
        <p class="post-caption">Made grandma's braised pork recipe — the secret is patience and low heat! 🥢✨</p>
        <div class="post-actions">
          <button class="post-action-btn like-btn liked"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 21C12 21 3 13.5 3 8.5C3 5.4 5.4 3 8.5 3C10.2 3 11.8 3.8 12 5C12.2 3.8 13.8 3 15.5 3C18.6 3 21 5.4 21 8.5C21 13.5 12 21 12 21Z" fill="#F2849E" stroke="#F2849E" stroke-width="1.8"/></svg><span class="like-count">24</span></button>
        </div>
      </div>
    </div>
  `;
}

function seedInitialCommunityPosts() {
  if (!db) return;
  const initialData = [
    {
      userId: 'chef-maria',
      userName: 'Maria K.',
      userEmail: 'maria@kitchen.com',
      userAvatar: 'images/dish_new2.jpg',
      caption: "Made fresh strawberry dumplings with rose petal tea! 🌸 What is everyone cooking today?",
      img: 'images/dish_new1.jpg',
      likes: 24,
      likedBy: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    },
    {
      userId: 'chef-jake',
      userName: 'Jake T.',
      userEmail: 'jake@kitchen.com',
      userAvatar: 'images/meal3.jpg',
      caption: "Steak & mash night! Reverse sear method is a game changer 🥩🔥",
      img: 'images/meal3.jpg',
      likes: 42,
      likedBy: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }
  ];

  initialData.forEach(p => {
    db.collection("community_posts").add(p).catch(() => {});
  });
}

function togglePostLike(postId) {
  if (!currentUser) {
    alert("Please sign in to like community recipes! 🌸");
    handleGoogleSignIn();
    return;
  }
  if (!db) return;

  const postRef = db.collection("community_posts").doc(postId);
  db.runTransaction((transaction) => {
    return transaction.get(postRef).then((doc) => {
      if (!doc.exists) return;
      const data = doc.data();
      let likedBy = data.likedBy || [];
      let likes = data.likes || 0;
      const uid = currentUser.uid;

      if (likedBy.includes(uid)) {
        likedBy = likedBy.filter(id => id !== uid);
        likes = Math.max(0, likes - 1);
      } else {
        likedBy.push(uid);
        likes += 1;
      }
      transaction.update(postRef, { likedBy: likedBy, likes: likes });
    });
  }).catch(err => console.error("Like toggle error:", err));
}

function openUserProfileModal(userId, userName, userAvatar) {
  const modal = document.getElementById('user-modal-backdrop');
  const avatarEl = document.getElementById('user-modal-avatar');
  const nameEl = document.getElementById('user-modal-name');
  const postsCountEl = document.getElementById('user-modal-posts-count');
  const likesCountEl = document.getElementById('user-modal-likes-count');
  const postsListEl = document.getElementById('user-modal-posts-list');

  if (avatarEl) avatarEl.src = userAvatar || 'images/dish_new1.jpg';
  if (nameEl) nameEl.textContent = userName || 'Community Chef';

  const userPosts = communityPosts.filter(p => p.userId === userId);
  let totalLikes = userPosts.reduce((sum, p) => sum + (p.likes || 0), 0);

  if (postsCountEl) postsCountEl.textContent = userPosts.length;
  if (likesCountEl) likesCountEl.textContent = totalLikes;

  if (postsListEl) {
    if (userPosts.length === 0) {
      postsListEl.innerHTML = `
        <div style="text-align:center; padding: 20px; font-family: var(--font-display); font-size: 18px; color: var(--text-light);">
          This chef hasn't shared any additional recipes yet. 🌸
        </div>
      `;
    } else {
      postsListEl.innerHTML = userPosts.map(p => `
        <div style="background: white; border-radius: 16px; border: 1.5px solid var(--cream-dark); overflow: hidden; padding: 12px; display: flex; gap: 12px; align-items: center;">
          ${p.img ? `<img src="${p.img}" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover;" />` : ''}
          <div style="flex: 1;">
            <p style="font-size: 13px; color: var(--text-dark); margin-bottom: 4px; line-height: 1.4;">${escapeHtml(p.caption || 'Delicious dish')}</p>
            <span style="font-size: 11px; color: var(--text-light);">${formatPostTime(p.createdAt)} · ❤️ ${p.likes || 0}</span>
          </div>
        </div>
      `).join('');
    }
  }

  if (modal) modal.classList.add('open');
}

function closeUserProfileModal() {
  const modal = document.getElementById('user-modal-backdrop');
  if (modal) modal.classList.remove('open');
}

function formatPostTime(timestamp) {
  if (!timestamp) return 'Just now';
  let date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffSec = Math.floor((new Date() - date) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// Start realtime community listener
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    preloadAllRecipeImages();
    listenToCommunityPosts();
    applyUserProfileToUI();
    renderProfileRecipes();
    syncProfileFromFirestore();
  });
}
