/**
 * Google Sign-In.
 *
 *   1. configureGoogleSignIn() once at startup
 *   2. signInWithGoogle() opens the native account picker → Google ID token
 *   3. The ID token is exchanged for an AgroSense JWT at /api/auth/google
 *
 * Unavailable in Expo Go (no native module) and on iOS until an iOS client
 * ID is configured — the UI hides the button in those cases.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { apiClient, getErrorMessage } from '@/api/client';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  googleWebClientId?: string;
  googleIosClientId?: string;
};
const WEB_CLIENT_ID = extra.googleWebClientId ?? '';
const IOS_CLIENT_ID = extra.googleIosClientId ?? '';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let native: any = null; // optional native module, typed loosely on purpose
if (!isExpoGo) {
  try {
    // Loaded lazily: the native module doesn't exist in Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    native = require('@react-native-google-signin/google-signin');
  } catch {
    native = null;
  }
}

export function isGoogleSignInAvailable() {
  if (!native || !WEB_CLIENT_ID) return false;
  if (Platform.OS === 'ios' && !IOS_CLIENT_ID) return false;
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

let configured = false;

export function configureGoogleSignIn() {
  if (configured || !isGoogleSignInAvailable()) return;
  native.GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    ...(IOS_CLIENT_ID ? { iosClientId: IOS_CLIENT_ID } : {}),
    offlineAccess: false,
  });
  configured = true;
}

export interface GoogleSignInResult {
  accessToken: string;
  profileComplete: boolean;
  farmerId: string;
}

export class GoogleSignInError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (!isGoogleSignInAvailable()) {
    throw new GoogleSignInError('Google sign-in isn’t available on this device. Use your phone number instead.', 'UNAVAILABLE');
  }
  configureGoogleSignIn();
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = native;

  let idToken: string | null = null;
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const result = await GoogleSignin.signIn();
    if (!isSuccessResponse(result)) {
      throw new GoogleSignInError('Sign-in cancelled.', 'CANCELLED');
    }
    idToken = result.data.idToken;
  } catch (err) {
    if (err instanceof GoogleSignInError) throw err;
    if (isErrorWithCode?.(err)) {
      const code = (err as { code: string }).code;
      if (code === statusCodes.SIGN_IN_CANCELLED) throw new GoogleSignInError('Sign-in cancelled.', 'CANCELLED');
      if (code === statusCodes.IN_PROGRESS) throw new GoogleSignInError('Sign-in is already in progress.', 'IN_PROGRESS');
      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new GoogleSignInError('Google Play Services is missing or out of date on this phone.', 'PLAY_SERVICES');
      }
    }
    throw new GoogleSignInError('Couldn’t sign in with Google. Please try again.', 'UNKNOWN');
  }

  if (!idToken) {
    throw new GoogleSignInError('Google didn’t return a sign-in token. Please try again.', 'NO_ID_TOKEN');
  }

  try {
    const res = await apiClient.post<{ access_token: string; profile_complete: boolean; farmer_id: string }>(
      '/api/auth/google',
      { id_token: idToken },
    );
    return {
      accessToken: res.data.access_token,
      profileComplete: res.data.profile_complete,
      farmerId: res.data.farmer_id,
    };
  } catch (err) {
    await signOutGoogle();
    throw new GoogleSignInError(getErrorMessage(err, 'Google sign-in failed.'), 'BACKEND_ERROR');
  }
}

export async function signOutGoogle() {
  if (!native || !configured) return;
  try {
    await native.GoogleSignin.signOut();
  } catch {
    // not signed in with Google
  }
}
