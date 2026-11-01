import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeErrorCode} from '../native-errors.mjs';
test('native failures expose fixed categories without raw account/token data',()=>{
  assert.equal(nativeErrorCode({message:'[28444] Developer console is not set up correctly; private-payload'}),'native/oauth-configuration');
  assert.equal(nativeErrorCode({message:'NoCredentialException for test@example.invalid; private-token'}),'native/no-available-account');
  assert.equal(nativeErrorCode({message:'GetCredentialCancellationException'}),'native/cancelled');
  assert.equal(nativeErrorCode({message:'GetCredentialProviderConfigurationException'}),'native/provider-unavailable');
  assert.equal(nativeErrorCode({message:'private-payload'}),'native/google-signin-failed');
});
