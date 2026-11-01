import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
export const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
export async function googleCredential() {
  const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true, useCredentialManager: true });
  const token = result.credential?.idToken;
  if (!token) throw { code: 'native/missing-google-id-token' };
  return token;
}
export async function nativeSignOut() { await FirebaseAuthentication.signOut(); }
