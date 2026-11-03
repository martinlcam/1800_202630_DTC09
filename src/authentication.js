// src/authentication.js
// ------------------------------------------------------------
// Contains reusable Firebase Authentication functions
// (login, signup, logout, and auth state checks).
// -------------------------------------------------------------

// Import the initialized Firebase Authentication object
// and the Firestore database connection
import { auth, db } from "/src/firebaseConfig.js";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Import specific functions from the Firebase Auth SDK
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

// -------------------------------------------------------------
// loginUser(email, password)
// -------------------------------------------------------------
// Logs an existing user into Firebase Authentication.
//
// Parameters:
//   email (string)    - user's email
//   password (string) - user's password
//
// Returns: Promise resolving to the user credential object.
// Usage:
//   await loginUser("user@example.com", "password123");
// -------------------------------------------------------------
export async function loginUser(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);

  // Make sure this user has a Firestore document. Accounts created before
  // signup wrote documents (or whose signup write failed) would otherwise
  // never get one. Only creates the doc when missing, so existing data is kept.
  await ensureUserDocument(userCredential.user);

  return userCredential;
}

// -------------------------------------------------------------
// ensureUserDocument(user)
// -------------------------------------------------------------
// Creates the Firestore "users" document for the given Auth user
// if it doesn't exist yet. Called on both signup and login so every
// authenticated user always has a matching document.
//
// Parameters:
//   user (object) - the Firebase Auth user object
// -------------------------------------------------------------
async function ensureUserDocument(user) {
  try {
    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) {
      await setDoc(userRef, {
        name: user.displayName || "",
        email: user.email,
        country: "Canada", // Default value
        school: "BCIT"     // Default value
      });
      console.log("Firestore user document created.");
    }
  } catch (error) {
    // Don't block login/signup if the Firestore write fails.
    console.error("Error ensuring user document:", error);
  }
}

// -------------------------------------------------------------
// signupUser(name, email, password)
// -------------------------------------------------------------
// Creates a new user account with Firebase Authentication,
// then updates the user's profile with a display name.
//
// Parameters:
//   name (string)     - user's display name
//   email (string)    - user's email
//   password (string) - user's password
//
// Returns: the created user object.
// Usage:
//   const user = await signupUser("Alice", "alice@email.com", "secret");
// -------------------------------------------------------------
export async function signupUser(name, email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(userCredential.user, { displayName: name });

  // Create the matching Firestore document for the new user.
  // Pass the name explicitly since the local user object may not
  // reflect the displayName set by updateProfile yet.
  await ensureUserDocument({ uid: userCredential.user.uid, email, displayName: name });

  return userCredential.user;
}

// -------------------------------------------------------------
// logoutUser()
// -------------------------------------------------------------
// Signs out the currently logged-in user and redirects them
// back to the login page (index.html).
//
// Usage:
//   await logoutUser();
// -------------------------------------------------------------
export async function logoutUser() {
  await signOut(auth);
  window.location.href = "index.html";
}

// -------------------------------------------------------------
// checkAuthState()
// -------------------------------------------------------------
// Observes changes in the user's authentication state (login/logout)
// and updates the UI or redirects accordingly.
//
// If the user is on "main.html":
//   - If logged in → displays "Hello, [Name]!"
//   - If not logged in → redirects to "index.html"
//
// This function should be called once when the page loads.
//
// Usage:
//   checkAuthState();
// -------------------------------------------------------------
export function checkAuthState() {
  onAuthStateChanged(auth, (user) => {
    if (window.location.pathname.endsWith("main.html")) {
      if (user) {
        const displayName = user.displayName || user.email;
        $("#welcomeMessage").text(`Hello, ${displayName}!`);
      } else {
        window.location.href = "index.html";
      }
    }
  });
}

// -------------------------------------------------------------
// onAuthReady(callback)
// -------------------------------------------------------------
// Wrapper for Firebase's onAuthStateChanged()
// Runs the given callback(user) when Firebase resolves or changes auth state.
// Useful for showing user info or redirecting after login/logout.
export function onAuthReady(callback) {
  return onAuthStateChanged(auth, callback);
}

// -------------------------------------------------------------
// authErrorMessage(error)
// -------------------------------------------------------------
// Maps Firebase Auth error codes to short, user-friendly messages.
// Helps display clean error alerts instead of raw Firebase codes.
export function authErrorMessage(error) {
  const code = (error?.code || "").toLowerCase();

  const map = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/email-already-in-use": "Email is already in use.",
    "auth/weak-password": "Password too weak (min 6 characters).",
    "auth/missing-password": "Password cannot be empty.",
    "auth/network-request-failed": "Network error. Try again.",
  };

  return map[code] || "Something went wrong. Please try again.";
}

