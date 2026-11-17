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


// ---- (1) What to do when the form is submitted ----
async function saveTip(event) {
    event.preventDefault();  // Stop the browser from reloading the page

    // 1. Collect the form values into ONE object
    const newTip = {
        name: document.getElementById("TipTitleInput").value,
        info: document.getElementById("infoInput").value,
        category: document.getElementById("CategoryInput").value,
        details: document.getElementById("detailsInput").value,
        owner: currentUser.uid,
        ownerName: currentUser.displayName || currentUser.email,
        last_updated: serverTimestamp()
    };

    // 2. Save it to the "tips" collection
    try {
        await addDoc(collection(db, "tips"), newTip);
        location.href = "tips.html";
    } catch (error) {
        alert(`Error saving tip:\n${error.code || ""}\n${error.message || error}`);
    }
}

// ---- (2) Connect it to the form ----
document.getElementById("addTipForm").addEventListener("submit", saveTip);
