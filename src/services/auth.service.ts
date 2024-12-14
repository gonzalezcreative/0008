import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  Auth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';

export class AuthService {
  constructor(private auth: Auth) {
    // Set persistence to LOCAL by default
    this.setPersistence('local').catch(console.error);
  }

  private async setPersistence(type: 'local' | 'session') {
    try {
      await setPersistence(this.auth, 
        type === 'local' ? browserLocalPersistence : browserSessionPersistence
      );
    } catch (error) {
      console.error('Error setting persistence:', error);
      throw error;
    }
  }

  async signIn(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  async signUp(email: string, password: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  }

  async signOut() {
    try {
      await firebaseSignOut(this.auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  onAuthStateChange(callback: (user: any) => void) {
    return onAuthStateChanged(this.auth, callback);
  }
}