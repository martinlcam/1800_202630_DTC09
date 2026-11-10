import { onAuthReady } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import {
  collection, getDocs, addDoc, serverTimestamp,
  doc, getDoc, setDoc, arrayUnion, arrayRemove
} from "firebase/firestore";

let currentUser = null;
let favourites = [];

function showName(user) {
  const name = user.displayName || user.email;
  const el = document.getElementById("name-goes-here");
  if (el) el.textContent = name + "!";
}

async function addTipData() {
  const tipsRef = collection(db, "tips");
  const tips = [
    { code: "tip1", name: "Check Image Details", category: "Fake",
      details: "Look for blurry edges, distorted objects, unusual fingers, or unnatural lighting." },
    { code: "tip2", name: "Verify the Image Source", category: "Real",
      details: "Check whether the image comes from a trusted website or reliable source." },
    { code: "tip3", name: "Look for AI Signs", category: "Fake",
      details: "AI-generated images may have unusual backgrounds, strange reflections, or inconsistent details." },
    { code: "tip4", name: "Reverse Image Search", category: "Real",
      details: "Use reverse image search to find the original image and check where it was published." },
  ];
  for (const tip of tips) {
    await addDoc(tipsRef, { ...tip, views: 0, last_updated: serverTimestamp() });
  }
}

async function seedTips() {
  const snapshot = await getDocs(collection(db, "tips"));
  if (snapshot.empty) {
    console.log("Tips collection is empty. Seeding data...");
    await addTipData();
  }
}

function setupHeart(card, tipID) {
  const heart = card.querySelector(".fav-btn");
  if (!heart) return; // template has no heart, skip

  if (favourites.includes(tipID)) {
    heart.classList.replace("bi-heart", "bi-heart-fill");
  }

  heart.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    toggleFavourite(heart, tipID);
  });
}

async function toggleFavourite(heart, tipID) {
  const userRef = doc(db, "users", currentUser.uid);
  try {
    if (heart.classList.contains("bi-heart-fill")) {
      await setDoc(userRef, { favourites: arrayRemove(tipID) }, { merge: true });
      favourites = favourites.filter((id) => id !== tipID);
      heart.classList.replace("bi-heart-fill", "bi-heart");
    } else {
      await setDoc(userRef, { favourites: arrayUnion(tipID) }, { merge: true });
      favourites.push(tipID);
      heart.classList.replace("bi-heart", "bi-heart-fill");
    }
  } catch (error) {
    console.error("Error toggling favourite:", error);
  }
}

async function displayCardsDynamically() {
  const cardTemplate = document.getElementById("tipCardTemplate");
  const container = document.getElementById("tips-go-here");

  try {
    const querySnapshot = await getDocs(collection(db, "tips"));
    querySnapshot.forEach((tipDoc) => {
      const tip = tipDoc.data();
      const newcard = cardTemplate.content.cloneNode(true);

      newcard.querySelector(".card-title").textContent = tip.name;
      newcard.querySelector(".card-text").textContent = tip.details;
      newcard.querySelector(".card-category").textContent = tip.category;
      newcard.querySelector(".read-more").href = `eachTip.html?docID=${tipDoc.id}`;

      const viewEl = newcard.querySelector(".view-count");
      if (viewEl) viewEl.textContent = tip.views || 0;

      setupHeart(newcard, tipDoc.id);
      container.appendChild(newcard);
    });
  } catch (error) {
    console.error("Error getting documents: ", error);
  }
}

onAuthReady(async function (user) {
  if (!user) {
    location.href = "index.html";
    return;
  }
  currentUser = user;
  showName(user);

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    favourites = userDoc.data()?.favourites || [];
  } catch (error) {
    console.error("Could not load favourites:", error);
    favourites = [];
  }

  try {
    await seedTips();
  } catch (error) {
    console.error("Seeding failed:", error);
  }

  displayCardsDynamically();
});