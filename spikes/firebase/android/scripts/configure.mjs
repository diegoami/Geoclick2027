import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const PACKAGE='com.geoclick.mobile';
export const RELEASE_SHA1='445a7de73d75a352b8f87ba158317053bf7571fb';
export function validateConfig(value,webProject){
  if(!value||value.project_info?.project_id!==webProject)throw Error('Android and web configurations must select the same Firebase project.');
  const matches=(value.client||[]).filter(c=>c.client_info?.android_client_info?.package_name===PACKAGE);
  if(matches.length!==1)throw Error('Configuration must contain exactly one com.geoclick.mobile client.');
  const client=matches[0];
  if(!client.client_info?.mobilesdk_app_id||!client.api_key?.some(k=>typeof k.current_key==='string'&&k.current_key))throw Error('Android SDK configuration is incomplete.');
  if(!client.oauth_client?.some(c=>c.client_type===3&&typeof c.client_id==='string'))throw Error('A Google web OAuth client is required for native Google sign-in.');
  const nativeFingerprints=(client.oauth_client||[]).filter(c=>c.client_type===1).map(c=>String(c.android_info?.certificate_hash||'').replaceAll(':','').toLowerCase());
  return {projectId:webProject,packageId:PACKAGE,releaseCertificateInConfig:nativeFingerprints.includes(RELEASE_SHA1)};
}
export function configure(file,webProject){
  const source=path.resolve(file);
  if(!fs.existsSync(source))throw Error('The Android Firebase configuration file was not found.');
  let value;try{value=JSON.parse(fs.readFileSync(source,'utf8').replace(/^\uFEFF/,''))}catch{throw Error('The Android Firebase configuration is not valid JSON.')}
  const report=validateConfig(value,webProject);
  fs.copyFileSync(source,path.join(ROOT,'android/app/google-services.json'));
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const file=process.argv[2]||process.env.GEOCLICK_FIREBASE_ANDROID_CONFIG_FILE;
  const project=process.env.GEOCLICK_FIREBASE_PROJECT_ID;
  if(!file||!project)throw Error('Provide the local configuration path and GEOCLICK_FIREBASE_PROJECT_ID.');
  console.log(JSON.stringify(configure(file,project)));
}
