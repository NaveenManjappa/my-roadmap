import { Injectable, inject, NgZone } from '@angular/core';
import { Firestore, collection, doc, query, where, addDoc, updateDoc, deleteDoc, onSnapshot } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { ManifestationNode } from '../../shared/models/manifestation.model';
import { AuthService } from './auth.service';
import { concatMap, map, take } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class ManifestationService {
    private firestore = inject(Firestore);
    private authService = inject(AuthService);
    private zone = inject(NgZone);
    private collectionName = 'manifestations';

    constructor() { }

    // Get nodes for the current user at a specific level (often level 1: Roadmaps)
    getNodesByLevel(level: number, parentId: string | null = null): Observable<ManifestationNode[]> {
        return new Observable<ManifestationNode[]>(observer => {
            let unsubscribe: () => void;
            this.authService.user$.pipe(take(1)).subscribe(user => {
                if (!user) {
                    this.zone.run(() => observer.error(new Error('User not authenticated')));
                    return;
                }

                const nodesRef = collection(this.firestore, this.collectionName);
                let q;
                if (parentId) {
                    q = query(nodesRef, where('userId', '==', user.uid), where('level', '==', level), where('parentId', '==', parentId));
                } else {
                    q = query(nodesRef, where('userId', '==', user.uid), where('level', '==', level));
                }

                unsubscribe = onSnapshot(q,
                    (snapshot) => {
                        const nodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManifestationNode));
                        this.zone.run(() => observer.next(nodes));
                    },
                    (error) => this.zone.run(() => observer.error(error))
                );
            });

            return () => {
                if (unsubscribe) unsubscribe();
            };
        });
    }

    // Create a new node
    async createNode(node: ManifestationNode): Promise<string> {
        return new Promise((resolve, reject) => {
            this.authService.user$.pipe(take(1)).subscribe({
                next: async (user) => {
                    if (!user) {
                        reject(new Error('User not authenticated'));
                        return;
                    }
                    try {
                        const nodeWithUser = { ...node, userId: user.uid };
                        const nodesRef = collection(this.firestore, this.collectionName);
                        const docRef = await addDoc(nodesRef, nodeWithUser);
                        resolve(docRef.id);
                    } catch (err: any) {
                        reject(err);
                    }
                },
                error: (err: any) => reject(err)
            });
        });
    }

    // Update a node
    updateNode(id: string, data: Partial<ManifestationNode>): Promise<void> {
        const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
        return updateDoc(docRef, data);
    }

    // Delete a node
    deleteNode(id: string): Promise<void> {
        const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
        return deleteDoc(docRef);
    }

    // Recursively fetch children
    getChildren(parentId: string): Observable<ManifestationNode[]> {
        return new Observable<ManifestationNode[]>(observer => {
            let unsubscribe: () => void;
            this.authService.user$.pipe(take(1)).subscribe(user => {
                if (!user) {
                    this.zone.run(() => observer.error(new Error('User not authenticated')));
                    return;
                }

                const nodesRef = collection(this.firestore, this.collectionName);
                const q = query(nodesRef, where('userId', '==', user.uid), where('parentId', '==', parentId));

                unsubscribe = onSnapshot(q,
                    (snapshot) => {
                        const nodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManifestationNode));
                        this.zone.run(() => observer.next(nodes));
                    },
                    (error) => this.zone.run(() => observer.error(error))
                );
            });

            return () => {
                if (unsubscribe) unsubscribe();
            };
        });
    }
}
