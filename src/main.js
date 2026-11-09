// Import the file that has the authentication helper function we want to use.
// The function we want to use is called "onAuthReady" which returns the login state
import { onAuthReady } from "/src/authentication.js";
import { db } from '/src/firebaseConfig.js';
import { collection, getDocs, addDoc, } from 'firebase/firestore';

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

    // Get a reference to the "tips" collection
    const tipsRef = collection(db, "tips");

    // Retrieve all documents currently in the collection
    const querySnapshot = await getDocs(tipsRef);

    // If no documents exist, the collection is empty
    if (querySnapshot.empty) {

        console.log("Tips collection is empty. Seeding data...");

        // Call function to insert default tip documents
        addTipData();

    } else {

        // If documents already exist, do not reseed
        console.log("Tips collection already contains data. Skipping seed.");
    }
}

// Call the seeding function when the main.html page loads.
seedTips();

async function displayCardsDynamically() {
  let cardTemplate = document.getElementById('tipCardTemplate');
  const tipsCollectionRef = collection(db, 'tips');

  try {
    const querySnapshot = await getDocs(tipsCollectionRef);
    querySnapshot.forEach((tipDoc) => {
      // Clone the template
      let newcard = cardTemplate.content.cloneNode(true);

      // Get tip data once
      const tip = tipDoc.data();

      // Populate the card with tip data
      newcard.querySelector('.card-title').textContent = tip.name;
      newcard.querySelector('.card-text').textContent = tip.details;
      newcard.querySelector('.card-category').textContent = tip.category;
      newcard.querySelector('.card-image').src = `./images/${tip.code}.png`;

      // Attach the document ID to the Read More link
      newcard.querySelector('.read-more').href = `eachTip.html?docID=${tipDoc.id}`;

      // Attach the new card to the container
      document.getElementById('tips-go-here').appendChild(newcard);
    });
  } catch (error) {
    console.error('Error getting documents: ', error);
  }
}

// Call the function to display cards when the page loads
displayCardsDynamically();