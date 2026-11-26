import { onAuthReady } from '/src/authentication.js';

import { db } from '/src/firebaseConfig.js';
import {
  collection, getDocs,
  doc, getDoc, setDoc, arrayUnion, arrayRemove, deleteDoc
} from "firebase/firestore";

let currentUser = null;

// Write tips to Firestore
function addTipData() {
  const tipsRef = collection(db, 'tips');
  addDoc(tipsRef, {
    code: 'tip1',
    name: 'Check Image Details',
    category: 'Image',
    type: 'AI',
    details: 'Look for blurry edges, distorted objects, unusual fingers, or unnatural lighting.',
  });
  addDoc(tipsRef, {
    code: 'tip2',
    name: 'Verify the Image Source',
    category: 'Image',
    type: 'AI',
    details: 'Check whether the image comes from a trusted website or reliable source.',
  });
  addDoc(tipsRef, {
    code: 'tip3',
    name: 'Caught in an image scam?',
    category: 'Image',
    type: 'AI',
    details:
      'Save evidence, Check images, protect yourself, Stop payments, Report it, Spread awareness.',
  });
  addDoc(tipsRef, {
    code: 'tip4',
    name: 'Reverse Image Search',
    category: 'Image',
    type: 'AI',
    details:
      'Use reverse image search to find the original image and check where it was published.',
  });
  addDoc(tipsRef, {
    code: 'tip5',
    name: 'Protect your photos',
    category: 'Image',
    type: 'Phishing/Scams',
    details:
      'Be careful when sharing personal photos online. Scammers may copy, edit, or misuse your images without permission. Review your privacy settings and limit who can access your photos.',
  });
  addDoc(tipsRef, {
    code: 'tip6',
    name: 'Recognize Fake profiles',
    category: 'Image',
    type: 'Social Media',
    details:
      "Be cautious of accounts with stolen photos, very few posts, suspicious usernames, or inconsistent information. Verify the person's identity before trusting them.",
  });
  addDoc(tipsRef, {
    code: 'tip7',
    name: 'Report Suspicious images',
    category: 'Image',
    type: 'Social Media',
    details:
      'If you discover a suspicious image, fake profile, or image scam, report iyt to the platform. Save evidence before blocking the account. Report can help protect other people too',
  });
  addDoc(tipsRef, {
    code: 'tip8',
    name: 'Do not Trust Images Immediately',
    category: 'Image',
    type: 'Phishing/Scams',
    details: 'Pause and verify before believing, sharing, or acting on an image.',
  });
}

// Seeds the "tips" collection with initial data if it is empty
async function seedHikes() {

    // Get a reference to the "tips" collection
    const tipsRef = collection(db, "tips");

    // Retrieve all documents currently in the collection
    const querySnapshot = await getDocs(tipsRef);

    // If no documents exist, the collection is empty
    if (querySnapshot.empty) {

        console.log("Tips collection is empty. Seeding data...");

        // Call function to insert default hike documents
        addTipData();

    } else {

        // If documents already exist, do not reseed
        console.log("Tips collection already contains data. Skipping seed.");
    }
}

// Call the seeding function when the main.html page loads.
seedHikes();

let favourites = [];

function showName(name) {
  const el = document.getElementById('name-goes-here');
  if (el) el.textContent = name + '!';
}

function setupHeart(card, tipID) {
  const heart = card.querySelector('.fav-btn');
  if (!heart) return; // template has no heart, skip

  if (favourites.includes(tipID)) {
    heart.classList.replace('bi-heart', 'bi-heart-fill');
  }

  heart.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    toggleFavourite(heart, tipID);
  });
}

async function toggleFavourite(heart, tipID) {
  const userRef = doc(db, 'users', currentUser.uid);
  try {
    if (heart.classList.contains('bi-heart-fill')) {
      await setDoc(userRef, { favourites: arrayRemove(tipID) }, { merge: true });
      favourites = favourites.filter((id) => id !== tipID);
      heart.classList.replace('bi-heart-fill', 'bi-heart');
    } else {
      await setDoc(userRef, { favourites: arrayUnion(tipID) }, { merge: true });
      favourites.push(tipID);
      heart.classList.replace('bi-heart', 'bi-heart-fill');
    }
  } catch (error) {
    console.error('Error toggling favourite:', error);
  }
}

function setupDelete(card, cardColumn, tipID, tip) {
  const deleteBtn = card.querySelector('.delete-tip');
  if (!deleteBtn) return;

  if (!currentUser || tip.owner !== currentUser.uid) return;

  deleteBtn.classList.remove('d-none');
  deleteBtn.addEventListener('click', async function (event) {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm(`Delete "${tip.name}"?`)) return;

    try {
      await deleteDoc(doc(db, 'tips', tipID));
      cardColumn.remove();
    } catch (error) {
      console.error('Error deleting tip:', error);
      alert('Could not delete this tip.');
    }
  });
}

const searchTerm = (new URL(window.location.href).searchParams.get('search') || '')
  .trim()
  .toLowerCase();
let shown = 0;

function renderBadges(container, items) {
  container.innerHTML = "";
  items.filter((item) => item.text).forEach((item) => {
    const badge = document.createElement("span");
    badge.className = `badge rounded-pill ${item.className}`;
    badge.textContent = item.text;
    container.appendChild(badge);
  });
}

function truncate(text, max = 100) {
  if (!text) return "";
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "...";
}

const activeFilters = new Set();
const allTags = new Set();

function applyFilters() {
  let visible = 0;
  document.querySelectorAll("#tips-go-here > [data-tags]").forEach((col) => {
    const tags = JSON.parse(col.dataset.tags);
    const show = activeFilters.size === 0 || tags.some((t) => activeFilters.has(t));
    col.classList.toggle("d-none", !show);
    if (show) visible++;
  });
  document.getElementById("no-filter-results").classList.toggle("d-none", visible > 0);
  document.querySelectorAll("#filter-buttons button").forEach((btn) => {
    const isAll = btn.dataset.tag === "";
    const on = isAll ? activeFilters.size === 0 : activeFilters.has(btn.dataset.tag);
    btn.classList.toggle("btn-secondary", on);
    btn.classList.toggle("btn-outline-secondary", !on);
  });
}

function buildFilterButtons() {
  const bar = document.getElementById("filter-buttons");
  bar.innerHTML = "";
  if (allTags.size === 0) return;

  const makeButton = (label, tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm btn-outline-secondary";
    btn.textContent = label;
    btn.dataset.tag = tag;
    btn.addEventListener("click", () => {
      if (tag === "") {
        activeFilters.clear();
      } else if (activeFilters.has(tag)) {
        activeFilters.delete(tag);
      } else {
        activeFilters.add(tag);
      }
      applyFilters();
    });
    bar.appendChild(btn);
  };
  
  makeButton("All", "");
  [...allTags].sort().forEach((tag) => makeButton(tag, tag));
  applyFilters();
}

async function displayCardsDynamically() {
  const cardTemplate = document.getElementById('tipCardTemplate');
  const container = document.getElementById('tips-go-here');

  try {
    const querySnapshot = await getDocs(collection(db, 'tips'));

    // text that shows up if there is an empty collection, otherwise it's just a blank page
    if (querySnapshot.empty) {
      container.innerHTML = `<p class="text-muted">No tips yet. Add the first one!</p>`;
      return;
    }
    querySnapshot.forEach((tipDoc) => {
      const tip = tipDoc.data();
      if (searchTerm) {
        const haystack =
          `${tip.name || ''} ${tip.details || ''} ${tip.category || ''} ${tip.type || ''}`.toLowerCase();
        if (!haystack.includes(searchTerm)) return; // skip this tip
      }
      shown++;
      const newcard = cardTemplate.content.cloneNode(true);
      newcard.querySelector(".card-title").textContent = tip.name;
      newcard.querySelector('.card-text').textContent = truncate(tip.details || '', 100);
      renderBadges(newcard.querySelector(".card-badges"), [
        { text: tip.category, className: "text-bg-info" },
        { text: tip.type, className: "text-bg-secondary" },
      ]);
      const cardImage = newcard.querySelector('.card-image');
      if (tip.image) {
        cardImage.src = tip.image; // uploaded photo (base64 text)
      } else if (tip.code) {
        cardImage.src = `./images/${tip.code}.jpg`; // seeded hike
      } else {
        cardImage.src = './images/default.jpg'; // no photo → placeholder
      }
      newcard.querySelector('.read-more').href = `eachTip.html?docID=${tipDoc.id}`;

      const viewEl = newcard.querySelector('.view-count');
      if (viewEl) viewEl.textContent = tip.views || 0;

      setupHeart(newcard, tipDoc.id);

      const cardColumn = newcard.firstElementChild;
      const tags = [tip.category, tip.type].filter(Boolean);
      cardColumn.dataset.tags = JSON.stringify(tags);
      tags.forEach((t) => allTags.add(t));

      setupDelete(newcard, cardColumn, tipDoc.id, tip);

      container.appendChild(newcard);
    });
    buildFilterButtons();
    if (searchTerm && shown === 0) {
      container.innerHTML = `<p class="text-muted">No tips found for "${searchTerm.replace(/</g, '&lt;')}".</p>`;
    }
  } catch (error) {
    console.error('Error getting documents: ', error);
    container.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
  }
}

onAuthReady(async function (user) {
  if (!user) {
    location.href = 'index.html';
    return;
  }
  currentUser = user;
  let displayName = user.displayName || user.email;

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const data = userDoc.data() || {};
    favourites = data.favourites || [];
    if (data.name) displayName = data.name;
  } catch (error) {
    console.error('Could not load user data:', error);
    favourites = [];
  }

  showName(displayName);
  displayCardsDynamically();
});
