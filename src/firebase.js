import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDB7hnzaSPQt7EBAku-Xs-qXwni6WXBFCY',
  authDomain: 'storage-guru.firebaseapp.com',
  projectId: 'storage-guru',
  storageBucket: 'storage-guru.firebasestorage.app',
  messagingSenderId: '453609358796',
  appId: '1:453609358796:web:cac761b6a4b491fc4c8969',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
