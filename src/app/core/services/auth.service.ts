import { Injectable, inject } from '@angular/core';
import { Auth, authState, signInWithPopup, GoogleAuthProvider, signOut, User } from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private auth = inject(Auth);

    // Observable of the current user state
    public readonly user$: Observable<User | null> = authState(this.auth);

    constructor() { }

    async loginWithGoogle(): Promise<void> {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(this.auth, provider);
    }

    async logout(): Promise<void> {
        await signOut(this.auth);
    }
}
