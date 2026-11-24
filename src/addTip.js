import { db } from './firebaseConfig.js';
import { onAuthReady } from './authentication.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Remember the logged-in user so we can save their ID with the tip
let currentUser = null;

onAuthReady(function (user) {
  if (!user) {
    location.href = 'index.html'; // Not logged in → go away
    return;
  }
  currentUser = user; // Logged in → remember them
});
// Shrink a photo so its longest side is at most maxSize px,
// then return it as a base64 text string ("data:image/jpeg;base64,....")
function resizeImage(file, maxSize = 600) {
  return new Promise(function (resolve, reject) {
    const img = new Image(); // an invisible <img>
    img.onload = function () {
      // runs once the photo is decoded
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7)); // JPEG at 70% quality, as text
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ---- (1) What to do when the form is submitted ----
async function saveTip(event) {
  event.preventDefault(); // Stop the browser from reloading the page

  const categorySelect = document.getElementById('categoryInput');

  // 1. Collect the form values into ONE object (this becomes the Firestore document)
  const newTip = {
    name: document.getElementById('tipNameInput').value,
    category: document.getElementById('categoryFilter').value,
    type: document.getElementById('typeFilter').value,
    details: document.getElementById('detailsInput').value,
    owner: currentUser.uid, // WHO added it
    ownerName: currentUser.displayName || currentUser.email,
    last_updated: serverTimestamp(), // WHEN it was added
  };

  const file = document.getElementById('imageInput').files[0]; // undefined if no photo chosen
  newTip.image = file ? await resizeImage(file) : ''; // base64 text, or empty string

  // 2. Save it to the "tips" collection
  try {
    await addDoc(collection(db, 'tips'), newTip);
    location.href = 'main.html'; // redirects to main.html when new tip is created
  } catch (error) {
    alert(`Error saving tip:\n${error.code || ''}\n${error.message || error}`);
  }
}

// ---- (2) Connect it: "form, when you are submitted, run saveTip" ----
document.getElementById('addTipForm').addEventListener('submit', saveTip);

// ---- (1) What to do when a file is chosen ----
function showPreview(event) {
  const file = event.target.files[0]; // the chosen file (or undefined)
  const preview = document.getElementById('imagePreview');
  if (file) {
    preview.src = URL.createObjectURL(file); // temporary link to the file on this computer
    preview.classList.remove('d-none');
  }
}

// ---- (2) Connect it: "file picker, when your file changes, run showPreview" ----
document.getElementById('imageInput').addEventListener('change', showPreview);
