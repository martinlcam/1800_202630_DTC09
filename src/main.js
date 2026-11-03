// Import the file that has the authentication helper function we want to use.
// The function we want to use is called "onAuthReady" which returns the login state
import { onAuthReady } from "/src/authentication.js";
import { db } from '/src/firebaseConfig.js';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

const showName = () => {
    // Pass a CALLBACK function to run when Firebase finishes checking login status
    onAuthReady((user) => {  // Firebase passes the user object (or null)
        if (user) {
            // User is logged in
            const name = user.displayName || user.email;  // Use email if name is missing
            document.getElementById("name-goes-here").textContent = name + "!";
        } else {
            // User is NOT logged in
            location.href = "index.html";  // Redirect to login page
        }
    });
};

showName();

// Add sample tip documents to Firestore
async function addTipData() {
  const tipsRef = collection(db, 'tips');

  console.log('Adding sample tip data...');

  await addDoc(tipsRef, {
    code: 'tip1',
    name: 'Check Image Details',
    category: 'Fake',
    details: 'Look for blurry edges, distorted objects, unusual fingers, or unnatural lighting.',
  });

  await addDoc(tipsRef, {
    code: 'tip2',
    name: 'Verify the Image Source',
    category: 'Real',
    details: 'Check whether the image comes from a trusted website or reliable source.',
  });

  await addDoc(tipsRef, {
    code: 'tip3',
    name: 'Look for AI Signs',
    category: 'Fake',
    details:
      'AI-generated images may have unusual backgrounds, strange reflections, or inconsistent details.',
  });

  await addDoc(tipsRef, {
    code: 'tip4',
    name: 'Reverse Image Search',
    category: 'Real',
    details:
      'Use reverse image search to find the original image and check where it was published.',
  });

  console.log('Sample tips added successfully!');
}

// Check if tips collection is empty
async function seedTips() {
  const tipsRef = collection(db, 'tips');

  const querySnapshot = await getDocs(tipsRef);

  if (querySnapshot.empty) {
    console.log('Tips collection is empty. Seeding data...');
    await addTipData();
  } else {
    console.log('Tips collection already contains data. Skipping seed.');
  }
}

// Display tips dynamically
async function displayCardsDynamically() {
  const cardTemplate = document.getElementById('tipCardTemplate');
  const tipsContainer = document.getElementById('tips-go-here');

  if (!cardTemplate || !tipsContainer) {
    console.error('Tip template or tips container not found!');
    return;
  }

  try {
    const tipsRef = collection(db, 'tips');
    const querySnapshot = await getDocs(tipsRef);

    tipsContainer.innerHTML = '';

    querySnapshot.forEach((tipDoc) => {
      // Clone the template
      const newcard = cardTemplate.content.cloneNode(true);

      // Get tip information
      const tip = tipDoc.data();

      // Add information to the card
      newcard.querySelector('.card-title').textContent = tip.name;
      newcard.querySelector('.card-text').textContent = tip.details;
      newcard.querySelector('.card-category').textContent = tip.category;

      // Add card to the page
      tipsContainer.appendChild(newcard);
    });

    console.log('Tips displayed successfully!');
  } catch (error) {
    console.error('Error displaying tips:', error);
  }
}

// Initialize tips
async function initializeTips() {
  try {
    await seedTips();
    await displayCardsDynamically();
  } catch (error) {
    console.error('Error initializing tips:', error);
  }
}

// Run when page loads
initializeTips();