import { db } from './firebaseConfig.js';
import { doc, getDoc } from 'firebase/firestore';

// Get the tip ID from the URL
// Example: eachTip.html?docID=abc123
const params = new URL(window.location.href).searchParams;
const tipId = params.get('docID');

// Fetch the tip and display its information
async function displayTipInfo() {
  try {
    const tipRef = doc(db, 'tips', tipId);
    const tipSnap = await getDoc(tipRef);

    if (tipSnap.exists()) {
      const tip = tipSnap.data();

      const name = tip.name;
      const code = tip.code;

      // Update the page
      document.getElementById('tipName').textContent = name;
      const img = document.getElementById('tipImage');
      img.src = `./images/${code}.png`;
      img.alt = `${name} image`;
    } else {
      document.getElementById('tipName').textContent = 'Tip not found.';
    }
  } catch (error) {
    console.error('Error loading tip:', error);
    document.getElementById('tipName').textContent = 'Error loading tip.';
  }
}

displayTipInfo();
