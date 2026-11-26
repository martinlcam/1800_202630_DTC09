import { db } from './firebaseConfig.js';
import { doc, getDoc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { onAuthReady } from './authentication.js';
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';

let currentUser = null;

onAuthReady(function (user) {
  if (!user) {
    location.href = 'index.html';
  } else {
    currentUser = user;
    setupFavButton(user);
  }
});

// Declare variable: the tip ID from the URL (eachTip.html?docID=abc123)
const params = new URL(window.location.href).searchParams;
const tipId = params.get('docID');

async function setupFavButton(user) {
  const heart = document.getElementById('fav-Btn');
  if (!heart || !tipId) return;

  const userRef = doc(db, 'users', user.uid);

  try {
    const snap = await getDoc(userRef);
    const favourites = snap.data()?.favourites || [];
    if (favourites.includes(tipId)) {
      heart.classList.replace('bi-heart', 'bi-heart-fill');
    }
  } catch (error) {
    console.error('Could not load favourites:', error);
  }

  heart.addEventListener('click', async function () {
    const isFav = heart.classList.contains('bi-heart-fill');
    try {
      await setDoc(
        userRef,
        { favourites: isFav ? arrayRemove(tipId) : arrayUnion(tipId) },
        { merge: true }
      );
      if (isFav) {
        heart.classList.replace('bi-heart-fill', 'bi-heart');
      } else {
        heart.classList.replace('bi-heart', 'bi-heart-fill');
      }
    } catch (error) {
      console.error('Error toggling favourite', error);
    }
  });
}

function renderBadges(container, items) {
  container.innerHTML = "";
  items.filter((item) => item.text).forEach((item) => {
    const badge = document.createElement("span");
    badge.className = `badge rounded-pill ${item.className}`;
    badge.textContent = item.text;
    container.appendChild(badge);
  });
}

// Fetch the tip and display its name and image
async function displayTipInfo() {
  try {
    const tipRef = doc(db, 'tips', tipId);
    const tipSnap = await getDoc(tipRef);

    if (tipSnap.exists()) {
      const tip = tipSnap.data();

      document.getElementById('tipName').textContent = tip.name;
      renderBadges(document.getElementById('tipBadges'), [
        { text: tip.category, className: 'text-bg-info' },
        { text: tip.type, className: 'text-bg-secondary' },
      ]);
      document.getElementById('tipDetails').textContent = tip.details;

      const img = document.getElementById('tipImage');
      if (tip.image) {
        img.src = tip.image;
      } else if (tip.code) {
        img.src = `./images/${tip.code}.jpg`;
      } else {
        img.src = './images/default.jpg';
      }
      img.alt = `${tip.name} image`;

      await updateDoc(tipRef, { views: increment(1) });
      document.getElementById('viewCount').textContent = (tip.views || 0) + 1;
    } else {
      document.getElementById('tipName').textContent = 'Tip not found.';
    }
  } catch (error) {
    console.error('Error loading tip:', error);
    document.getElementById('tipName').textContent = 'Error loading tip.';
  }
}

displayTipInfo();

async function displayReviews() {
  const container = document.getElementById('reviews-go-here');
  const template = document.getElementById('reviewTemplate');
  container.innerHTML = ''; // start empty so we don't show duplicates

  // Build the question we want to ask Firestore
  const q = query(
    collection(db, 'reviews'),
    where('tipDocID', '==', tipId) // only THIS tip
    // orderBy("timestamp", "desc"),         // newest first
    // limit(5)                        // optional: only the latest 5 (try it yourself)
  );

  try {
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      container.innerHTML = "<p class='text-muted'>No reviews yet. Be the first!</p>";
      return;
    }

    querySnapshot.forEach((doc) => {
      const review = doc.data();
      const card = template.content.cloneNode(true);

      card.querySelector('.review-title').innerHTML =
        `${review.title} <span style="color: gold;"> ${'★'.repeat(review.rating)}</span>`;
      const date = review.timestamp ? review.timestamp.toDate().toLocaleDateString() : 'just now';
      card.querySelector('.review-meta').textContent = `${review.userName} · ${date}`;
      card.querySelector('.review-text').textContent = review.text;
      // Only the author sees the Delete button
      const deleteBtn = card.querySelector('.delete-btn');
      if (review.userID === currentUser.uid) {
        deleteBtn.classList.remove('d-none');
        deleteBtn.addEventListener('click', async function () {
          if (confirm('Delete this review?')) {
            await deleteDoc(doc.ref); // doc.ref = the address of THIS review
            displayReviews(); // redraw the list (skip this line if you use onSnapshot)
          }
        });
      }
      container.appendChild(card);
    });
  } catch (error) {
    console.error('Error loading reviews:', error);
  }
}
displayReviews();

// ---- (1) What to do when the review form is submitted ----
async function submitReview(event) {
  event.preventDefault();

  const newReview = {
    tipDocID: tipId, // the PARENT (from the URL)
    userID: currentUser.uid, // who
    userName: currentUser.displayName || currentUser.email,
    title: document.getElementById('reviewTitle').value,
    rating: Number(document.getElementById('reviewRating').value),
    text: document.getElementById('reviewText').value,
    timestamp: serverTimestamp(), // when
  };

  try {
    await addDoc(collection(db, 'reviews'), newReview);
    event.target.reset(); // clear the form
    displayReviews(); // re-read the list so the new review shows (Step 1.3)
  } catch (error) {
    alert(`Error saving review:\n${error.code || ''}\n${error.message || error}`);
  }
}

// ---- (2) Connect it: "form, when you are submitted, run submitReview" ----
document.getElementById('reviewForm').addEventListener('submit', submitReview);
