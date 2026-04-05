/* ===== AMS SHARED UTILITIES (utils.js) ===== */

// Static credentials
const STATIC_USERS = [
  { id: "12345", password: "pass@1" },
  { id: "67890", password: "admin@2" },
  { id: "11111", password: "tcs@456" }
];

// Store / retrieve from sessionStorage (simulates DB for demo)
const AMS = {
  save: (key, val) => sessionStorage.setItem('ams_' + key, JSON.stringify(val)),
  get: (key) => { try { return JSON.parse(sessionStorage.getItem('ams_' + key)); } catch { return null; } },
  remove: (key) => sessionStorage.removeItem('ams_' + key),

  setUser: (u) => AMS.save('user', u),
  getUser: () => AMS.get('user'),
  logout: () => { AMS.remove('user'); window.location.href = 'login.html'; },

  // Generate random 5-digit passenger ID
  genId: () => Math.floor(10000 + Math.random() * 90000).toString(),

  // Auth guard – call on protected pages (allows guests)
  guard: () => {
    if (!AMS.getUser()) { window.location.href = 'login.html'; return false; }
    return true;
  },

  // Booking guard – requires full registration (no guests)
  guardBooking: () => {
    const user = AMS.getUser();
    if (!user || user.isGuest) {
      alert('Please register or login to continue with booking');
      window.location.href = 'register.html';
      return false;
    }
    return true;
  },

  // Admin guard – requires admin login only
  guardAdmin: () => {
    const user = AMS.getUser();
    if (!user || !user.isAdmin) {
      alert('Admin access only. Please login as admin.');
      window.location.href = 'admin-login.html';
      return false;
    }
    return true;
  },

  // Login as guest
  loginGuest: () => {
    const guestUser = {
      firstName: 'Guest',
      lastName: 'User',
      email: 'guest@skywings.com',
      contact: '0000000000',
      passengerId: 'GUEST' + Math.floor(Math.random() * 100000),
      isGuest: true
    };
    AMS.setUser(guestUser);
  },

  // Check if user is guest
  isGuest: () => {
    const user = AMS.getUser();
    return user && user.isGuest === true;
  }
};

// Populate nav welcome message
function loadNavUser() {
  const u = AMS.getUser();
  const el = document.getElementById('nav-welcome');
  if (el && u) el.textContent = `Welcome ${u.firstName} ${u.lastName} !!!`;
}

// Navbar toggle for mobile
function initNavToggle() {
  const btn = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (btn && links) btn.onclick = () => links.classList.toggle('open');
}

// Show inline error/success
function showMsg(id, text, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'msg ' + type;
}
function clearMsg(id) { showMsg(id, ''); }

/*
  Session-backed passenger store + authentication utilities.
  - registrations saved in sessionStorage under "passengers"
  - login accepts passengerId OR email OR contact (digits-only) with the stored password
*/
function getPassengers() {
  const raw = sessionStorage.getItem('passengers');
  try { return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
}
function savePassengers(list) {
  sessionStorage.setItem('passengers', JSON.stringify(list || []));
}

function normalizeContact(v){ return String(v||'').replace(/\D/g,''); }
function normalizeEmail(v){ return String(v||'').trim().toLowerCase(); }
function normalizeId(v){ return String(v||'').trim(); }

function registerPassenger(payload){
  // payload can include firstName, lastName, dob, address, mustResetPassword
  const passengerId = normalizeId(payload.passengerId);
  const email = normalizeEmail(payload.email);
  const contact = normalizeContact(payload.contact);
  const password = String(payload.password || '');

  // basic validation
  if(!passengerId) throw new Error('Passenger ID is required');
  if(!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Valid email required');
  if(!contact || contact.length < 7) throw new Error('Valid contact number required');
  if(!password || password.length < 4) throw new Error('Password must be at least 4 characters');

  const list = getPassengers();
  if(list.some(u => normalizeId(u.passengerId) === passengerId)) throw new Error('Passenger ID already registered');
  if(list.some(u => normalizeEmail(u.email) === email)) throw new Error('Email already registered');
  if(list.some(u => normalizeContact(u.contact) === contact)) throw new Error('Contact already registered');

  const user = {
    passengerId,
    firstName: String(payload.firstName || ''),
    lastName: String(payload.lastName || ''),
    name: String(payload.name || `${payload.firstName || ''} ${payload.lastName || ''}`).trim(),
    email,
    contact,
    dob: payload.dob || '',
    address: payload.address || '',
    password,
    mustResetPassword: payload.mustResetPassword || false,
    isGuest: false,
    isAdmin: payload.isAdmin || false
  };
  list.push(user);
  savePassengers(list);
  return user;
}

function savePassenger(user) {
  const list = getPassengers();
  const idx = list.findIndex(u => normalizeId(u.passengerId) === normalizeId(user.passengerId));
  if (idx === -1) {
    list.push(user);
  } else {
    list[idx] = user;
  }
  savePassengers(list);
}

/**
 * Authenticate by passengerId OR email OR contact (+ exact password)
 * returns user object on success, null on failure
 */
function authenticateUser(identifier, password){
  if(!identifier) return null;
  const idRaw = String(identifier).trim();
  const idDigits = idRaw.replace(/\D/g,'');
  const idLower = idRaw.toLowerCase();

  const passengers = getPassengers();
  const pwd = String(password || '');

  return passengers.find(u => {
    if(String(u.password || '') !== pwd) return false;
    if(normalizeId(u.passengerId) === idRaw) return true;
    if(normalizeEmail(u.email) === idLower) return true;
    if(normalizeContact(u.contact) && idDigits && normalizeContact(u.contact) === idDigits) return true;
    return false;
  }) || null;
}

function initRegisterForm(){
  const form = document.getElementById('register-form');
  const msg = document.getElementById('register-msg');
  if(!form) return;
  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(msg){ msg.textContent = ''; msg.style.color = ''; }
    try {
      const fd = new FormData(form);
      const fullName = String(fd.get('name') || '').trim();
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      const user = {
        passengerId: fd.get('passengerId'),
        name: fullName,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: fd.get('email'),
        contact: fd.get('contact'),
        password: fd.get('password')
      };
      registerPassenger(user);
      AMS.setUser(user);
      if(msg){ msg.style.color = 'green'; msg.textContent = 'Registration successful — you are logged in.'; }
      setTimeout(()=> window.location.href = 'home.html', 700);
    } catch(err) {
      if(msg){ msg.style.color = 'crimson'; msg.textContent = err.message || 'Registration error'; }
    }
  });
}

function initLoginForm(){
  const form = document.getElementById('login-form');
  const msg = document.getElementById('login-msg');
  if(!form) return;
  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(msg){ msg.textContent = ''; msg.style.color = ''; }
    const fd = new FormData(form);
    const identifier = String(fd.get('identifier') || '').trim();
    const password = String(fd.get('password') || '');
    const user = authenticateUser(identifier, password);
    if(!user){
      if(msg){ msg.style.color = 'crimson'; msg.textContent = 'Both ID/password not valid'; }
      return;
    }
    AMS.setUser(user);
    if(msg){ msg.style.color = 'green'; msg.textContent = 'Login successful — redirecting…'; }
    setTimeout(()=> window.location.href = 'home.html', 400);
  });
}

document.addEventListener('DOMContentLoaded', function(){
  try{ initNavToggle && initNavToggle(); }catch(e){}
  initRegisterForm();
  initLoginForm();
});