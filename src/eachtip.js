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
  setDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';

let currentUser = null;
let myRating = 0; // NEW: this user's rating for this tip (0 = none)

// CHANGED: comments and ratings now load only once we know who's logged in
onAuthReady(function (user) {
  if (!user) {
    location.href = 'index.html';
  } else {
    currentUser = user;
    setupFavButton(user);
    setupRating(); // NEW
    displayComments(); // CHANGED: moved here (was a standalone displayReviews() call)
  }
});

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

// ---- NEW: Star ratings ----

// Read-only row of 5 gold stars with full/half/empty stars, e.g. value 3.6
function renderStarRow(container, value) {
  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('i');
    let icon = 'bi-star';
    if (value >= i) icon = 'bi-star-fill';
    else if (value >= i - 0.5) icon = 'bi-star-half';
    star.className = `bi ${icon}`;
    star.style.color = 'gold';
    star.style.fontSize = '1.25rem';
    container.appendChild(star);
  }
}

// Fill the first n clickable stars, empty the rest
function paintRateStars(n) {
  document.querySelectorAll('#rateStars i').forEach((star, index) => {
    const filled = index < n;
    star.classList.toggle('bi-star-fill', filled);
    star.classList.toggle('bi-star', !filled);
  });
}

// Read every rating for this tip, update the average and this user's own rating
async function loadRatings() {
  try {
    const snap = await getDocs(query(collection(db, 'ratings'), where('tipId', '==', tipId)));
    let total = 0;
    let count = 0;
    myRating = 0;
    snap.forEach((ratingDoc) => {
      const r = ratingDoc.data();
      total += r.rating;
      count++;
      if (currentUser && r.userID === currentUser.uid) myRating = r.rating;
    });

    const average = count ? total / count : 0;
    renderStarRow(document.getElementById('avgStars'), average);
    document.getElementById('avgText').textContent = count
      ? `${average.toFixed(1)} (${count} ${count === 1 ? 'rating' : 'ratings'})`
      : 'No ratings yet';
    paintRateStars(myRating);
  } catch (error) {
    console.error('Could not load ratings:', error);
  }
}

// Build the 5 clickable stars next to the heart
async function setupRating() {
  const box = document.getElementById('rateStars');
  if (!box || !tipId) return;

  for (let value = 1; value <= 5; value++) {
    const star = document.createElement('i');
    star.className = 'bi bi-star';
    star.setAttribute('role', 'button');
    star.title = `${value} star${value > 1 ? 's' : ''}`;
    star.style.color = 'gold';
    star.style.fontSize = '1.5rem';
    star.style.cursor = 'pointer';

    star.addEventListener('mouseenter', () => paintRateStars(value)); // hover preview
    star.addEventListener('click', async () => {
      const ratingRef = doc(db, 'ratings', `${tipId}_${currentUser.uid}`);
      try {
        if (value === myRating) {
          await deleteDoc(ratingRef); // clicking your current rating again clears it
        } else {
          await setDoc(ratingRef, {
            tipId: tipId,
            userID: currentUser.uid,
            rating: value,
            timestamp: serverTimestamp(),
          });
        }
        await loadRatings();
      } catch (error) {
        console.error('Error saving rating:', error);
        alert('Could not save your rating.');
      }
    });
    box.appendChild(star);
  }
  box.addEventListener('mouseleave', () => paintRateStars(myRating)); // undo hover preview

  await loadRatings();
}

// Fetch the tip and display its name and image
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

// ---- CHANGED: reviews are now comments (same "reviews" collection) ----
async function displayComments() {
  const container = document.getElementById('comments-go-here');
  const template = document.getElementById('commentTemplate');
  container.innerHTML = '';

  const q = query(collection(db, 'reviews'), where('tipDocID', '==', tipId));

  try {
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      container.innerHTML = "<p class='text-muted'>No comments yet. Be the first!</p>";
      return;
    }

    querySnapshot.forEach((commentDoc) => {
      const comment = commentDoc.data();
      const card = template.content.cloneNode(true);

      // Older reviews had a title; show it if there is one
      const titleEl = card.querySelector('.comment-title');
      if (comment.title) {
        titleEl.textContent = comment.title;
        titleEl.classList.remove('d-none');
      }

      const date = comment.timestamp ? comment.timestamp.toDate().toLocaleDateString() : 'just now';
      card.querySelector('.comment-meta').textContent = `${comment.userName} · ${date}`;
      card.querySelector('.comment-text').textContent = comment.text;

      // Only the author sees the Delete button
      const deleteBtn = card.querySelector('.delete-btn');
      if (deleteBtn && currentUser && comment.userID === currentUser.uid) {
        deleteBtn.classList.remove('d-none');
        deleteBtn.addEventListener('click', async function () {
          if (confirm('Delete this comment?')) {
            await deleteDoc(commentDoc.ref);
            displayComments();
          }
        });
      }
      container.appendChild(card);
    });
  } catch (error) {
    console.error('Error loading comments:', error);
  }
}

async function submitComment(event) {
  event.preventDefault();
  if (!currentUser) {
    alert('Still checking your login, try again.');
    return;
  }

  const text = document.getElementById('commentText').value.trim();
  if (!text) return;

  const newComment = {
    tipDocID: tipId,
    userID: currentUser.uid,
    userName: currentUser.displayName || currentUser.email,
    text: text,
    timestamp: serverTimestamp(),
  };

  try {
    await addDoc(collection(db, 'reviews'), newComment);
    event.target.reset();
    displayComments();
  } catch (error) {
    alert(`Error saving comment:\n${error.code || ''}\n${error.message || error}`);
  }
}

document.getElementById('commentForm').addEventListener('submit', submitComment);
