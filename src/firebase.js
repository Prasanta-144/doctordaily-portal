import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBXqOY8CVcduS7UxadPnoMg8VbuJQRLdKI",
  authDomain: "medislots-142c1.firebaseapp.com",
  projectId: "medislots-142c1",
  storageBucket: "medislots-142c1.firebasestorage.app",
  messagingSenderId: "412081170625",
  appId: "1:412081170625:web:7e6e210cb2d0f60d480c40"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);