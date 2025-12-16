import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface User {
  id: number;
  username: string;
  connectorId: string;
  displayName: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}

/**
 * Authentication Service
 * 
 * Handles user authentication using JWT tokens
 * Supports multi-tenant connector system (conn-oeg-demo, conn-edmundo-demo, etc.)
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private httpClient = inject(HttpClient);
  private router = inject(Router);
  
  private readonly AUTH_URL = environment.runtime.managementApiUrl;
  private readonly TOKEN_KEY = 'ml_assets_auth_token';
  private readonly USER_KEY = 'ml_assets_current_user';
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  
  private currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    // Check if stored token is still valid on init
    if (this.hasToken()) {
      this.verifyToken();
    }
  }

  /**
   * Login with username and password
   */
  login(username: string, password: string): Observable<LoginResponse> {
    const url = `${this.AUTH_URL}/auth/login`;
    console.log('[Auth] Attempting login to:', url);
    console.log('[Auth] AUTH_URL:', this.AUTH_URL);
    
    return this.httpClient.post<LoginResponse>(url, { username, password }).pipe(
      tap(response => {
        if (response.success && response.token) {
          this.setToken(response.token);
          this.setUser(response.user);
          this.isAuthenticatedSubject.next(true);
          this.currentUserSubject.next(response.user);
          console.log(`[Auth] User ${username} logged in successfully as ${response.user.connectorId}`);
        }
      }),
      catchError(error => {
        console.error('[Auth] Login failed:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Logout current user
   */
  logout(): void {
    const url = `${this.AUTH_URL}/auth/logout`;
    const token = this.getToken();
    
    if (token) {
      // Call backend logout endpoint (optional)
      this.httpClient.post(url, {}).subscribe({
        next: () => console.log('[Auth] Logout successful'),
        error: (error) => console.error('[Auth] Logout error:', error)
      });
    }
    
    this.clearAuth();
    this.router.navigate(['/login']);
  }

  /**
   * Verify current token is still valid
   */
  verifyToken(): void {
    const url = `${this.AUTH_URL}/auth/me`;
    
    this.httpClient.get<{ success: boolean; user: User }>(url).subscribe({
      next: (response) => {
        if (response.success && response.user) {
          this.setUser(response.user);
          this.currentUserSubject.next(response.user);
          this.isAuthenticatedSubject.next(true);
        } else {
          this.clearAuth();
        }
      },
      error: (error) => {
        console.error('[Auth] Token verification failed:', error);
        this.clearAuth();
      }
    });
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.hasToken();
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Get current user's connector ID
   */
  getConnectorId(): string | null {
    const user = this.getCurrentUser();
    return user ? user.connectorId : null;
  }

  /**
   * Get JWT token
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Check if token exists
   */
  private hasToken(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Store JWT token
   */
  private setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  /**
   * Store user information
   */
  private setUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * Get stored user
   */
  private getStoredUser(): User | null {
    const userJson = localStorage.getItem(this.USER_KEY);
    if (!userJson) return null;
    
    try {
      return JSON.parse(userJson);
    } catch {
      return null;
    }
  }

  /**
   * Clear authentication data
   */
  private clearAuth(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.isAuthenticatedSubject.next(false);
    this.currentUserSubject.next(null);
  }
}
