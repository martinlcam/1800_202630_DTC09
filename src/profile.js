import { db } from './firebaseConfig.js';
import { onAuthReady } from './authentication.js';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  collection,
  getDocs,
  query,
  where,
  documentId,
  setDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';

// The fields we store in Firestore (email comes from Auth, not from here)
const fields = ['name', 'country', 'school', 'bio'];
let currentUser = null;
let favourites = []; // used in Part 3

onAuthReady(async function (user) {
  if (!user) {
    location.href = 'index.html';
  } else {
    currentUser = user;

    // 1. Read the document
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const data = userDoc.data() || {};
    favourites = data.favourites || [];

    // 2. Header: avatar initial, name, email
    showHeader(data.name || user.displayName || user.email, user.email);

    showAvatar(data.photoURL || null);

    // 3. Pre-populate each input (empty string if the field doesn't exist yet)
    fields.forEach((field) => {
      document.getElementById(field + 'Input').value = data[field] || '';
    });
    // 4. NOW favourites is filled, so draw the cards
    displayFavourites();
  }
});

// Fill the header: first letter in the circle, name, email
function showHeader(name, email) {
  document.getElementById('avatar').textContent = name.charAt(0).toUpperCase(); //Get the first letter of the name in uppercase (e.g. "elmo" → "E")
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileEmail').textContent = email;
}

function showAvatar(url) {
  const img = document.getElementById('avatarImg');
  const fallback = document.getElementById('avatar');
  if (url) {
    img.src = url;
    img.classList.remove('d-none');
    fallback.classList.add('d-none');
  } else {
    img.classList.add('d-none');
    fallback.classList.remove('d-none');
  }
}

function resizeImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handlePhotoChosen(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Please choose an image file.');
    return;
  }

  try {
    const dataUrl = await resizeImage(file);
    // merge: true so favourites and profile fields are not overwritten
    await setDoc(doc(db, 'users', currentUser.uid), { photoURL: dataUrl }, { merge: true });
    showAvatar(dataUrl);
  } catch (error) {
    console.error('Error saving profile picture:', error);
    alert('Could not save your picture. Please try again.');
  }
  event.target.value = ''; // lets the user pick the same file again
}

const changePhotoBtn = document.getElementById('changePhotoBtn');
const photoInput = document.getElementById('photoInput');
if (changePhotoBtn && photoInput) {
  changePhotoBtn.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', handlePhotoChosen);
}

// ---- (1) What to do when Edit is clicked ----
function enableEdit() {
  fields.forEach((field) => (document.getElementById(field + 'Input').disabled = false));
  document.getElementById('saveBtn').disabled = false;
  document.getElementById('nameInput').focus();
}

// ---- (2) Connect it to the button ----
document.getElementById('editBtn').addEventListener('click', enableEdit);

// ---- (1) What to do when the profile form is submitted ----
async function saveProfile(event) {
  event.preventDefault();

  // Build an object from the inputs: { name: "...", country: "...", school: "...", bio: "..." }
  const updates = {};
  fields.forEach((field) => {
    updates[field] = document.getElementById(field + 'Input').value;
  });

  try {
    await updateDoc(doc(db, 'users', currentUser.uid), updates);
    await updateProfile(currentUser, { displayName: updates.name });

    // Lock the form again, refresh the header, show a confirmation
    fields.forEach((field) => (document.getElementById(field + 'Input').disabled = true));
    document.getElementById('saveBtn').disabled = true;
    showHeader(updates.name, currentUser.email);
    const alertBox = document.getElementById('profileAlert');
    alertBox.textContent = 'Profile saved!';
    alertBox.classList.remove('d-none');
  } catch (error) {
    alert(`Error saving profile:\n${error.code || ''}\n${error.message || error}`);
  }
}

// ---- (2) Connect it to the form ----
document.getElementById('profileForm').addEventListener('submit', saveProfile);

function truncate(text, max =100) {
  if (!text) return "";
  return text.length <= max ? text : text.slice(0, max).trimEnd() + '...';
}

function renderBadges(container, items) {
  container.innerHTML = '';
  items
    .filter((item) => item.text)
    .forEach((item) => {
      const badge = document.createElement('span');
      badge.className = `badge rounded-pill ${item.className}`;
      badge.textContent = item.text;
      container.appendChild(badge);
    });
}

// ---- Favourite tips ----
async function displayFavourites() {
  const container = document.getElementById('tips-go-here');
  const cardTemplate = document.getElementById('tipCardTemplate');

  if (favourites.length === 0) {
    container.innerHTML =
      "<p class='text-muted'>You haven't favourited any tips yet. Go find some!</p>";
    return;
  }

  // Fetch exactly those tips in ONE query
  const q = query(collection(db, 'tips'), where(documentId(), 'in', favourites));
  const querySnapshot = await getDocs(q);

  // Same card loop as main.js
  querySnapshot.forEach((doc) => {
    let newcard = cardTemplate.content.cloneNode(true);
    const tip = doc.data();

    newcard.querySelector('.card-title').textContent = tip.name;
    newcard.querySelector('.card-text').textContent = truncate(tip.details || '', 100);
    renderBadges(newcard.querySelector('.card-badges'), [
      { text: tip.category, className: 'text-bg-info' },
      { text: tip.type, className: 'text-bg-secondary' },
    ]);
    const cardImg = newcard.querySelector('.card-image');
    if (tip.image) {
      cardImg.src = tip.image;
    } else if (tip.code) {
      cardImg.src = `./images/${tip.code}.jpg`;
    } else {
      cardImg.src = './images/default.jpg';
    }
    cardImg.alt = `${tip.name} image`;
    cardImg.onerror = () => {
      cardImg.style.display = 'none';
    };
    newcard.querySelector('.read-more').href = `eachTip.html?docID=${doc.id}`;
    setupHeart(newcard, doc.id); // ← needs (b) below

    container.appendChild(newcard);
  });
}

// Makes one card's heart work: filled if already a favourite, click to add or remove
function setupHeart(card, tipID) {
  const heart = card.querySelector('.fav-btn');
  if (favourites.includes(tipID)) {
    heart.classList.replace('bi-heart', 'bi-heart-fill');
  }
  heart.addEventListener('click', function () {
    toggleFavourite(heart, tipID);
  });
}

// Add or remove this tip from the user's favourites, and swap the icon
async function toggleFavourite(heart, tipID) {
  const userRef = doc(db, 'users', currentUser.uid);
  if (heart.classList.contains('bi-heart-fill')) {
    await setDoc(userRef, { favourites: arrayRemove(tipID) }, { merge: true });
    heart.classList.replace('bi-heart-fill', 'bi-heart');
  } else {
    await setDoc(userRef, { favourites: arrayUnion(tipID) }, { merge: true });
    heart.classList.replace('bi-heart', 'bi-heart-fill');
  }
}
