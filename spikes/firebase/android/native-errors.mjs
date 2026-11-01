// Map native messages to fixed categories; never display credential-bearing payloads.
export function nativeErrorCode(error) {
  const text=[typeof error==='string'?error:'',error?.code,error?.name,error?.message].filter(v=>typeof v==='string').join(' ');
  if(/cancel|dismiss|user.*abort/i.test(text))return 'native/cancelled';
  if(/28444|DEVELOPER_ERROR|developer.{0,40}console|oauth|client.?id|certificate|sha.?1/i.test(text))return 'native/oauth-configuration';
  if(/NoCredential|no credential|no account|authorized account/i.test(text))return 'native/no-available-account';
  if(/provider.?configuration|play.?services.{0,30}(unavailable|missing|update)|provider.{0,20}unavailable/i.test(text))return 'native/provider-unavailable';
  if(/unimplemented|not implemented|plugin.{0,20}missing/i.test(text))return 'native/bridge-unavailable';
  if(/network|connection|offline/i.test(text))return 'native/network';
  return 'native/google-signin-failed';
}
