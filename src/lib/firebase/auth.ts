import {
  signInWithPopup,
  GithubAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';

const githubProvider = new GithubAuthProvider();
githubProvider.addScope('repo');
githubProvider.addScope('read:user');
githubProvider.addScope('user:email');

export async function signInWithGitHub() {
  const result = await signInWithPopup(auth, githubProvider);
  const credential = GithubAuthProvider.credentialFromResult(result);
  const githubToken = credential?.accessToken;

  if (result.user && githubToken) {
    const userRef = doc(db, 'users', result.user.uid);
    const userSnap = await getDoc(userRef);

    const additionalInfo = result.user.providerData[0];

    await setDoc(
      userRef,
      {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        githubUsername: additionalInfo?.uid || '',
        updatedAt: serverTimestamp(),
        ...(userSnap.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true }
    );

    // Store token server-side
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: result.user.uid,
        githubToken,
        idToken: await result.user.getIdToken(),
      }),
    });
  }

  return result;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export { auth };
