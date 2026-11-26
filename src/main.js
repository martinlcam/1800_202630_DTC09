import { onAuthReady } from '/src/authentication.js';

import { db } from '/src/firebaseConfig.js';
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
} from 'firebase/firestore';

let currentUser = null;

// Write tips to Firestore
async function addTipData() {
  // add tips to the firestore database
  const tipsRef = collection(db, 'tips');
  const tips = [
    {
      code: 'tip1',
      name: 'Check Image Details',
      category: 'Image',
      details: 'Look for blurry edges, distorted objects, unusual fingers, or unnatural lighting.',
    },
    {
      code: 'tip2',
      name: 'Verify the Image Source',
      category: 'Image',
      details: 'Check whether the image comes from a trusted website or reliable source.',
    },
    {
      code: 'tip3',
      name: 'Caught in an image scam?',
      category: 'Image',
      details:
        'Save evidence, Check images, protect yourself, Stop payments, Report it, Spread awareness.',
    },
    {
      code: 'tip4',
      name: 'Reverse Image Search',
      category: 'Image',
      details:
        'Use reverse image search to find the original image and check where it was published.',
    },
    {
      code: 'tip5',
      name: 'Protect your photos',
      category: 'Image',
      details:
        'Be careful when sharing personal photos onlin. Scammers may copy, edit, or misuse your images without permission. Review your privacy settings and limit who can access your photos.',
    },
    {
      code: 'tip6',
      name: 'Recognize Fake profiles',
      category: 'Image',
      details:
        "Be cautious of accounts with stolen photos, very few posts, suspicious usernames, or inconsistent information. Verify the person's identity before trusting them.",
    },
    {
      code: 'tip7',
      name: 'Report Suspicious images',
      category: 'Image',
      details:
        'If you discover a suspicious image, fake profile, or image scam, report iyt to the platform. Save evidence before blocking the account. Report can help protect other people too',
    },
    {
      code: 'tip8',
      name: 'Do not Trust Images Immediately',
      category: 'Image',
      details: 'Pause and verify before beleiving, sharing, or acting on an image.',
    },
  ];
  // starts the try block to handle possible firestore errors
  try {
    const snapshot = await getDocs(tipsRef);
    
    // create a set containg the codes of tips already existing
    const existingCodes = new Set(
      snapshot.docs.map((tipDoc) => tipDoc.data().code)
    );

    for (const tip of tips) {
      if (!existingCodes.has(tip.code)) {
        await addDoc(tipsRef, tip);
        existingCodes.add(tip.code);
        console.log(`${tip.code} added!`);
      }
    }
  } catch (error) {
    console.error('Error adding tips:', error);
  }
}

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

async function displayCardsDynamically() {
  const cardTemplate = document.getElementById('tipCardTemplate');
  const container = document.getElementById('tips-go-here');

  try {
    const querySnapshot = await getDocs(collection(db, 'tips'));

    // text that shows up if there is an empty collection, otherwise it's just a blank page
    if (querySnapshot.empty) {
      container.innerHTML = `<p class="text-muted">No tips yet. Add the first one!</p>`;
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
      newcard.querySelector('.card-title').textContent = tip.name;
      newcard.querySelector('.card-text').textContent = tip.details;
      newcard.querySelector('.card-category').textContent = tip.category;
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
      setupDelete(newcard, cardColumn, tipDoc.id, tip);

      container.appendChild(newcard);
    });
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
  await addTipData();
  displayCardsDynamically();
});
