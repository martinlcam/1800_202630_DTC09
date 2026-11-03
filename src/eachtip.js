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
      const category = tip.category;
      const details = tip.details;

      // Update the page
      document.getElementById('tipName').textContent = name;
      document.getElementById('tipCategory').textContent = category;
      document.getElementById('tipDetails').textContent = details;
    } else {
      document.getElementById('tipName').textContent = 'Tip not found.';
    }
  } catch (error) {
    console.error('Error loading tip:', error);
    document.getElementById('tipName').textContent = 'Error loading tip.';
  }
}

displayTipInfo();
