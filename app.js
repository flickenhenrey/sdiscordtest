import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, getDoc, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDPggbx3_-BR-Lf8aBkihufcXFF9stijAc",
  authDomain: "schooldiscord67.firebaseapp.com",
  projectId: "schooldiscord67",
  storageBucket: "schooldiscord67.firebasestorage.app",
  messagingSenderId: "870727141580",
  appId: "1:870727141580:web:26b441254827d647409a69",
  measurementId: "G-2D3E72HNF3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();
const provider = new GoogleAuthProvider();

let activeChatId = null;
let isGroupChat = false;

// Auth State
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        document.getElementById('user-display-name').innerText = user.email.split('@')[0];
        // Ensure user exists in DB so others can find them
        setDoc(doc(db, "users", user.email), { email: user.email, uid: user.uid }, { merge: true });
        loadFriends();
        loadGroups();
    } else {
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
});

document.getElementById('login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logout-btn').onclick = () => signOut(auth);

// --- FRIENDS LOGIC ---

document.getElementById('add-friend-btn').onclick = async () => {
    const email = document.getElementById('friend-search').value.toLowerCase().trim();
    if (!email || email === auth.currentUser.email) return;

    // Check if user exists in the database
    const userRef = doc(db, "users", email);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        await setDoc(doc(db, `users/${auth.currentUser.email}/friends`, email), { email: email });
        document.getElementById('friend-search').value = "";
        alert(`Added ${email}!`);
    } else {
        alert("User not found. They must log in to SchoolDiscord at least once.");
    }
};

function loadFriends() {
    onSnapshot(collection(db, `users/${auth.currentUser.email}/friends`), (snapshot) => {
        const list = document.getElementById('friends-list');
        list.innerHTML = "";
        snapshot.forEach(doc => {
            const email = doc.data().email;
            const div = document.createElement('div');
            div.className = "friend-item";
            div.innerText = `👤 ${email.split('@')[0]}`;
            div.onclick = () => startChat(email, false);
            list.appendChild(div);
        });
    });
}

// --- GROUPS LOGIC ---

document.getElementById('create-group-btn').onclick = async () => {
    const groupName = document.getElementById('group-name-input').value.trim();
    if (groupName) {
        await addDoc(collection(db, "groups"), {
            name: groupName,
            members: [auth.currentUser.email],
            createdAt: serverTimestamp()
        });
        document.getElementById('group-name-input').value = "";
    }
};

function loadGroups() {
    // Show groups where current user is a member
    const q = query(collection(db, "groups"), where("members", "array-contains", auth.currentUser.email));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('groups-list');
        list.innerHTML = "";
        snapshot.forEach(doc => {
            const group = doc.data();
            const div = document.createElement('div');
            div.className = "friend-item"; // Reuse style
            div.innerText = `# ${group.name}`;
            div.onclick = () => startChat(doc.id, true, group.name);
            list.appendChild(div);
        });
    });
}

// --- CHAT SYSTEM ---

function startChat(id, isGroup, displayName = "") {
    isGroupChat = isGroup;
    if (isGroupChat) {
        activeChatId = id;
        document.getElementById('chat-with-title').innerText = `# ${displayName}`;
    } else {
        activeChatId = [auth.currentUser.email, id].sort().join("_");
        document.getElementById('chat-with-title').innerText = `@ ${id}`;
    }
    
    document.getElementById('message-input').disabled = false;
    loadMessages();
}

document.getElementById('message-input').onkeypress = async (e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== "") {
        const path = isGroupChat ? `groups/${activeChatId}/messages` : `chats/${activeChatId}/messages`;
        await addDoc(collection(db, path), {
            text: e.target.value,
            sender: auth.currentUser.email,
            timestamp: serverTimestamp()
        });
        e.target.value = "";
    }
};

let messageUnsubscribe = null;
function loadMessages() {
    if (messageUnsubscribe) messageUnsubscribe(); // Stop listening to old chat

    const path = isGroupChat ? `groups/${activeChatId}/messages` : `chats/${activeChatId}/messages`;
    const q = query(collection(db, path), orderBy("timestamp", "asc"));
    
    messageUnsubscribe = onSnapshot(q, (snapshot) => {
        const container = document.getElementById('messages-container');
        container.innerHTML = "";
        snapshot.forEach(doc => {
            const m = doc.data();
            const isMe = m.sender === auth.currentUser.email;
            const div = document.createElement('div');
            div.className = `msg ${isMe ? 'msg-me' : ''}`;
            div.innerHTML = `<b>${m.sender.split('@')[0]}</b><div class="msg-text">${m.text}</div>`;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    });
}
