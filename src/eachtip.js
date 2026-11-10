import { db } from './firebaseConfig.js';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';

const params = new URL(window.location.href).searchParams;
const tipId = params.get('docID');

async function displayTipInfo() {
  try {
    const tipRef = doc(db, 'tips', tipId);
    const tipSnap = await getDoc(tipRef);

    if (tipSnap.exists()) {
      const tip = tipSnap.data();

      document.getElementById('tipName').textContent = tip.name;
      document.getElementById('tipCategory').textContent = tip.category;
      document.getElementById('tipDetails').textContent = tip.details;

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
