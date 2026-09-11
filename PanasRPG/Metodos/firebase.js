// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBl-CQYjX4Hv0wtZVJdwb6r7GG2PAJjNV4",
  authDomain: "panasrpg-ce163.firebaseapp.com",
  projectId: "panasrpg-ce163",
  storageBucket: "panasrpg-ce163.firebasestorage.app",
  messagingSenderId: "1032628714407",
  appId: "1:1032628714407:web:3d4489f3377ebf29b21482",
  measurementId: "G-RP6Z0DHXMB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);