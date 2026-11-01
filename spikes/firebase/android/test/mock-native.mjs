export const isAndroid=()=>window.__androidPlatform!==false;
export const googleCredential=()=>window.__nativeCommand('google');
export const nativeSignOut=()=>window.__nativeCommand('signout');
