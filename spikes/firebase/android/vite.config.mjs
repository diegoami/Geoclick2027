import { defineConfig } from 'vite';
import path from 'node:path';
export default defineConfig(({command,mode})=>{
  const test=process.env.GEOCLICK_ANDROID_UI_TEST==='1';
  if(test&&(command!=='serve'||mode!=='test'))throw Error('The mocked native bridge is restricted to UI tests; it cannot be packaged.');
  const nativeDir=path.resolve(import.meta.dirname,'android').replaceAll('\\','/');
  return {envDir:'..',resolve:{alias:{'@proof/native':path.resolve(import.meta.dirname,test?'test/mock-native.mjs':'native-bridge.mjs')}},server:{watch:{ignored:file=>{const normalized=file.replaceAll('\\','/');return normalized===nativeDir||normalized.startsWith(nativeDir+'/')}}},build:{outDir:'dist',emptyOutDir:true}};
});
