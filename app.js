// Apni Firebase Config yahan paste karein
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "https://earn-platform-76c26-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// DOM Elements
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const walletBalanceEl = document.getElementById('wallet-balance');
const uidEl = document.getElementById('user-uid');
const btcPriceEl = document.getElementById('btc-price');

// 1. Auth State Listener (Persistent Login)
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

// 2. Demo Login Function (Anonymous Auth)
function demoLogin() {
    auth.signInAnonymously()
        .then(() => {
            console.log("Demo account logged in successfully!");
            // Cloud function will automatically add Rs 10,000 in background
        })
        .catch((error) => {
            alert("Error in Demo Login: " + error.message);
        });
}

// 3. Normal Login (Username mapped to dummy email)
function loginUser() {
    const userVal = document.getElementById('username').value;
    const passVal = document.getElementById('password').value;
    const dummyEmail = userVal + "@myapp.com"; // Mapping username to email format
    
    auth.signInWithEmailAndPassword(dummyEmail, passVal)
        .catch((error) => alert(error.message));
}

// 4. Logout
function logout() {
    auth.signOut();
}

// 5. Load Realtime Wallet Balance
function loadWalletBalance(uid) {
    const balanceRef = db.ref(`wallets/${uid}/availableBalance`);
    balanceRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            // Format number with commas
            walletBalanceEl.innerText = snapshot.val().toLocaleString('en-US');
        } else {
            walletBalanceEl.innerText = "0.00";
        }
    });
}

// 6. Live Binance WebSocket (Important Baat)
let binanceWs;
const USD_TO_PKR_RATE = 280; // Aap isay bhi database se fetch karwa sakte hain

function startBinanceStream() {
    if (binanceWs) binanceWs.close(); // Close existing if any
    
    binanceWs = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
    
    let lastPrice = 0;

    binanceWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const currentUsdtPrice = parseFloat(data.c); // 'c' = current day close price
        const currentPkrPrice = (currentUsdtPrice * USD_TO_PKR_RATE).toFixed(2);
        
        // Color coding for up/down movement
        if (currentUsdtPrice > lastPrice) {
            btcPriceEl.className = "price-up";
        } else if (currentUsdtPrice < lastPrice) {
            btcPriceEl.className = "price-down";
        }
        
        btcPriceEl.innerText = `PKR ${parseFloat(currentPkrPrice).toLocaleString('en-US')}`;
        lastPrice = currentUsdtPrice;
    };
}