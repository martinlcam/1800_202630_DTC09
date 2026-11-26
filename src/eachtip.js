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
      const postedBy = document.getElementById('postedBy');
      if (tip.ownerName) {
        postedBy.textContent = `Posted by ${tip.ownerName}`;
        postedBy.classList.remove('d-none');
      }
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
// Milliseconds for sorting; a just-posted item has no server timestamp yet
function timeValue(data) {
  return data.timestamp ? data.timestamp.toMillis() : Date.now();
}

const MAX_INDENT = 8; // after this many levels, stop indenting so it doesn't squeeze off-screen

// Vote tallies for the current tip: { commentId: { likes, dislikes, mine } }
// mine = 1 (liked), -1 (disliked), 0 (no vote)
let voteState = {};

async function loadVotes() {
  voteState = {};
  try {
    const snap = await getDocs(query(collection(db, 'votes'), where('tipId', '==', tipId)));
    snap.forEach((d) => {
      const v = d.data();
      if (!voteState[v.commentID]) voteState[v.commentID] = { likes: 0, dislikes: 0, mine: 0 };
      const s = voteState[v.commentID];
      if (v.value === 1) s.likes++;
      if (v.value === -1) s.dislikes++;
      if (currentUser && v.userID === currentUser.uid) s.mine = v.value;
    });
  } catch (error) {
    console.error('Could not load votes:', error);
  }
}

// Wire up the like/dislike buttons on one comment or reply
function setupVotes(node, commentId) {
  if (!voteState[commentId]) voteState[commentId] = { likes: 0, dislikes: 0, mine: 0 };
  const s = voteState[commentId];

  const likeBtn = node.querySelector('.like-btn');
  const dislikeBtn = node.querySelector('.dislike-btn');

  // Repaint only this node, so open reply forms are not lost
  function paint() {
    likeBtn.querySelector('.like-count').textContent = s.likes;
    dislikeBtn.querySelector('.dislike-count').textContent = s.dislikes;

    const liked = s.mine === 1;
    const disliked = s.mine === -1;
    likeBtn.classList.toggle('btn-success', liked);
    likeBtn.classList.toggle('btn-outline-success', !liked);
    likeBtn.querySelector('i').className = liked ? 'bi bi-hand-thumbs-up-fill' : 'bi bi-hand-thumbs-up';
    dislikeBtn.classList.toggle('btn-danger', disliked);
    dislikeBtn.classList.toggle('btn-outline-danger', !disliked);
    dislikeBtn.querySelector('i').className = disliked ? 'bi bi-hand-thumbs-down-fill' : 'bi bi-hand-thumbs-down';
  }

  async function vote(value) {
    if (!currentUser) return;
    const ref = doc(db, 'votes', `${commentId}_${currentUser.uid}`);
    const prev = s.mine;
    try {
      if (prev === value) {
        await deleteDoc(ref); // clicking the same vote again removes it
      } else {
        await setDoc(ref, {
          tipId: tipId,
          commentID: commentId,
          userID: currentUser.uid,
          value: value,
          timestamp: serverTimestamp(),
        });
      }
      // Update the counts in memory only after the write succeeded
      if (prev === 1) s.likes--;
      if (prev === -1) s.dislikes--;
      s.mine = prev === value ? 0 : value;
      if (s.mine === 1) s.likes++;
      if (s.mine === -1) s.dislikes++;
      paint();
    } catch (error) {
      console.error('Error saving vote:', error);
      alert('Could not save your vote.');
    }
  }

  likeBtn.addEventListener('click', () => vote(1));
  dislikeBtn.addEventListener('click', () => vote(-1));
  paint();
}

async function displayComments() {
  const container = document.getElementById('comments-go-here');
  const template = document.getElementById('commentTemplate');
  container.innerHTML = '';

  const q = query(collection(db, 'reviews'), where('tipDocID', '==', tipId));

  try {
    const querySnapshot = await getDocs(q);
    await loadVotes();

    // Top-level comments, plus every reply grouped under whatever it answers
    const roots = [];
    const childrenByParent = {};
    querySnapshot.forEach((d) => {
      const item = { id: d.id, ref: d.ref, data: d.data() };
      const parent = item.data.parentID;
      if (parent) {
        if (!childrenByParent[parent]) childrenByParent[parent] = [];
        childrenByParent[parent].push(item);
      } else {
        roots.push(item);
      }
    });

    if (roots.length === 0) {
      container.innerHTML = "<p class='text-muted'>No comments yet. Be the first!</p>";
      return;
    }

    // Builds one comment or reply, then calls itself for each of its replies
    function renderNode(item, depth) {
      const { id, ref, data } = item;
      const node = template.content.cloneNode(true).firstElementChild;

      // Older reviews had a title; show it if there is one
      const titleEl = node.querySelector('.comment-title');
      if (data.title) {
        titleEl.textContent = data.title;
        titleEl.classList.remove('d-none');
      }

      const date = data.timestamp ? data.timestamp.toDate().toLocaleDateString() : 'just now';
      node.querySelector('.comment-meta').textContent = `${data.userName} · ${date}`;
      node.querySelector('.comment-text').textContent = data.text;
      node.querySelector('.comment-text').textContent = data.text;
      setupVotes(node, id); 

      // Delete: author only
      const deleteBtn = node.querySelector('.delete-btn');
      if (currentUser && data.userID === currentUser.uid) {
        deleteBtn.classList.remove('d-none');
        deleteBtn.addEventListener('click', async () => {
          if (confirm('Delete this?')) {
            await deleteDoc(ref);
            displayComments();
          }
        });
      }

      // Reply form
      const replyBtn = node.querySelector('.reply-btn');
      const replyForm = node.querySelector('.reply-form');
      const replyInput = node.querySelector('.reply-input');
      replyBtn.addEventListener('click', () => {
        replyForm.classList.toggle('d-none');
        if (!replyForm.classList.contains('d-none')) replyInput.focus();
      });
      node.querySelector('.reply-cancel').addEventListener('click', () => {
        replyForm.reset();
        replyForm.classList.add('d-none');
      });
      replyForm.addEventListener('submit', (event) => {
        event.preventDefault();
        submitReply(id, replyInput.value); // id of THIS comment or reply
      });

      // Children LAST, so the queries above only match this node's own buttons
      const children = (childrenByParent[id] || []).sort(
        (a, b) => timeValue(a.data) - timeValue(b.data) // oldest first
      );
      if (children.length > 0) {
        const repliesBox = node.querySelector('.replies');
        repliesBox.classList.remove('d-none');
        if (depth >= MAX_INDENT) {
          repliesBox.classList.remove('ms-3', 'ps-3', 'border-start');
        }
        children.forEach((child) => repliesBox.appendChild(renderNode(child, depth + 1)));
      }

      return node;
    }

    roots.sort((a, b) => timeValue(b.data) - timeValue(a.data)); // newest first
    roots.forEach((root) => container.appendChild(renderNode(root, 1)));
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

async function submitReply(parentId, rawText) {
  if (!currentUser) {
    alert('Still checking your login, try again.');
    return;
  }
  const text = rawText.trim();
  if (!text) return;

  try {
    await addDoc(collection(db, 'reviews'), {
      tipDocID: tipId,
      parentID: parentId, // the comment being replied to
      userID: currentUser.uid,
      userName: currentUser.displayName || currentUser.email,
      text: text,
      timestamp: serverTimestamp(),
    });
    displayComments();
  } catch (error) {
    alert(`Error saving reply:\n${error.code || ''}\n${error.message || error}`);
  }
}

document.getElementById('commentForm').addEventListener('submit', submitComment);
