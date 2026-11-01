import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { nativeErrorCode } from './native-errors.mjs';
export const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
export async function googleCredential() {
  let result;
  try { result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true, useCredentialManager: true }); }
  catch (error) { throw { code: nativeErrorCode(error) }; }
  const token = result.credential?.idToken;
  if (!token) throw { code: 'native/missing-google-id-token' };
  return token;
}
export async function nativeSignOut() { await FirebaseAuthentication.signOut(); }
