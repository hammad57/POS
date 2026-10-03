// Apni asli Firebase Config yahan paste karein
const firebaseConfig = {
    apiKey: "AIzaSyCtye3i1vAb1JplxDP-HxTNnmlXWE9onOo",
    authDomain: "earn-platform-76c26.firebaseapp.com",
    databaseURL: "https://earn-platform-76c26-default-rtdb.firebaseio.com",
    projectId: "earn-platform-76c26",
    storageBucket: "earn-platform-76c26.firebasestorage.app",
    messagingSenderId: "1046747453152",
    appId: "1:1046747453152:web:0bc6061ca7905d7ad56285",
    measurementId: "G-X74LBSPHMY"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Baqi ka purana code niche same rahega...
