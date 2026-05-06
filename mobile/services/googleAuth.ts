/**
 * Google Sign-In integration.
 * 
 * Flow:
 *   1. Configure once at app startup with our Web Client ID
 *   2. signInWithGoogle() opens native Google account picker
 *   3. User picks account → we get an idToken
 *   4. Send idToken to our backend → receive AgroSense JWT
 *   5. If profile_complete=false, mobile redirects to "Complete profile" screen
 */
import {
  GoogleSignin,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';

import { apiClient } from '@/api/client';

const WEB_CLIENT_ID =
  (Constants.expoConfig?.extra as any)?.googleWebClientId ?? '';

let configured = false;

export function configureGoogleSignIn() {
  if (configured) return;
  if (!WEB_CLIENT_ID) {
    console.warn('[googleAuth] No googleWebClientId set in app.json/extra');
    return;
  }
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    offlineAccess: false, // we don't need refresh tokens — backend issues its own JWT
  });
  configured = true;
}

export interface GoogleSignInResult {
  accessToken: string;       // AgroSense JWT
  profileComplete: boolean;  // false → show CompleteProfile screen
  farmerId: string;
}

export class GoogleSignInError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  configureGoogleSignIn();

  // 1. Check Google Play Services available (Android)
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // 2. Open native Google account picker
  const result = await GoogleSignin.signIn();

  if (!isSuccessResponse(result)) {
    throw new GoogleSignInError('Sign-in cancelled or failed.', 'CANCELLED');
  }

  const idToken = result.data.idToken;
  if (!idToken) {
    throw new GoogleSignInError(
      'No ID token returned from Google. Check your Web Client ID.',
      'NO_ID_TOKEN',
    );
  }

  // 3. Exchange Google ID token for our backend JWT
  try {
    const res = await apiClient.post<{
      access_token: string;
      profile_complete: boolean;
      farmer_id: string;
    }>('/api/auth/google', { id_token: idToken });

    return {
      accessToken: res.data.access_token,
      profileComplete: res.data.profile_complete,
      farmerId: res.data.farmer_id,
    };
  } catch (err: any) {
    const detail = err.response?.data?.detail ?? err.message ?? 'Backend rejected the Google token.';
    throw new GoogleSignInError(detail, 'BACKEND_ERROR');
  }
}

export async function signOutGoogle() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // ignore — user might not have been signed in via Google
  }
}

export function mapGoogleSignInError(err: any): string {
  if (err?.code === statusCodes.SIGN_IN_CANCELLED) return 'Sign-in cancelled.';
  if (err?.code === statusCodes.IN_PROGRESS) return 'Sign-in already in progress.';
  if (err?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Google Play Services unavailable. Update your phone.';
  }
  return err?.message ?? 'Could not sign in with Google.';
}