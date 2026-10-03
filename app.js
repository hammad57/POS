// app.js mukammal code (with new App ID)
const firebaseConfig = {
    apiKey: "AIzaSyCtye3i1vAb1JplxDP-HxTNnmlXWE9onOo",
    authDomain: "earn-platform-76c26.firebaseapp.com",
    databaseURL: "https://earn-platform-76c26-default-rtdb.firebaseio.com",
    projectId: "earn-platform-76c26",
    storageBucket: "earn-platform-76c26.firebasestorage.app",
    messagingSenderId: "1046747453152",
    appId: "1:1046747453152:web:8a3ac7fb3bf1832ad56285", // Updated New App ID
    measurementId: "G-5PGLRWTC4K" // Updated New Measurement ID
};

// Initialize Firebase (Compat Version)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// DOM Elements
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const walletBalanceEl = document.getElementById('wallet-balance');
const uidEl = document.getElementById('user-uid');
const btcPriceEl = document.getElementById('btc-price');

// 1. Auth State Listener
auth.onAuthStateChanged((user) => {
    if (user) {
        authSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        uidEl.innerText = user.uid;
        loadWalletBalance(user.uid);
        startBinanceStream();
    } else {
        authSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
    }
});

// 2. Demo Login Function
function demoLogin() {
    auth.signInAnonymously()
        .then(() => {
            console.log("Demo account logged in successfully!");
        })
        .catch((error) => {
            alert("Error in Demo Login: " + error.message);
        });
}

// 3. Normal Login
function loginUser() {
    const userVal = document.getElementById('username').value;
    const passVal = document.getElementById('password').value;
    const dummyEmail = userVal + "@myapp.com";
    
    auth.signInWithEmailAndPassword(dummyEmail, passVal)
        .catch((error) => alert(error.message));
}

// 4. Logout
function logout() {
    auth.signOut();
}

// 5. Load Wallet Balance
function loadWalletBalance(uid) {
    const balanceRef = db.ref(`wallets/${uid}/availableBalance`);
    balanceRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            walletBalanceEl.innerText = snapshot.val().toLocaleString('en-US');
        } else {
            walletBalanceEl.innerText = "0.00";
        }
    });
}

// 6. Binance WebSocket
let binanceWs;
const USD_TO_PKR_RATE = 280; 

function startBinanceStream() {
    if (binanceWs) binanceWs.close();
    
    binanceWs = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
    
    let lastPrice = 0;

    binanceWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const currentUsdtPrice = parseFloat(data.c); 
        const currentPkrPrice = (currentUsdtPrice * USD_TO_PKR_RATE).toFixed(2);
        
        if (currentUsdtPrice > lastPrice) {
            btcPriceEl.className = "price-up";
        } else if (currentUsdtPrice < lastPrice) {
            btcPriceEl.className = "price-down";
        }
        
        btcPriceEl.innerText = `PKR ${parseFloat(currentPkrPrice).toLocaleString('en-US')}`;
        lastPrice = currentUsdtPrice;
    };
}
