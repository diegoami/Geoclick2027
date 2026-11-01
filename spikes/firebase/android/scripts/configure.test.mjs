import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig,RELEASE_SHA1} from './configure.mjs';
const valid=()=>({project_info:{project_id:'test-project'},client:[{client_info:{mobilesdk_app_id:'test-app',android_client_info:{package_name:'com.geoclick.mobile'}},api_key:[{current_key:'synthetic-key'}],oauth_client:[{client_type:3,client_id:'web-client.apps.googleusercontent.com'},{client_type:1,android_info:{certificate_hash:RELEASE_SHA1}}]}]});
test('project/package/web-client validation and public certificate metadata',()=>{
  assert.equal(validateConfig(valid(),'test-project').releaseCertificateInConfig,true);
  assert.throws(()=>validateConfig(valid(),'other-project'));
  const wrong=valid();wrong.client[0].client_info.android_client_info.package_name='another.app';assert.throws(()=>validateConfig(wrong,'test-project'));
  const missing=valid();missing.client[0].oauth_client=[];assert.throws(()=>validateConfig(missing,'test-project'));
  const duplicate=valid();duplicate.client.push(duplicate.client[0]);assert.throws(()=>validateConfig(duplicate,'test-project'));
  const noNativeEntry=valid();noNativeEntry.client[0].oauth_client=noNativeEntry.client[0].oauth_client.slice(0,1);assert.equal(validateConfig(noNativeEntry,'test-project').releaseCertificateInConfig,false);
});
