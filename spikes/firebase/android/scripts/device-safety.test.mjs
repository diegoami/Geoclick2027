import test from 'node:test';
import assert from 'node:assert/strict';
import {assertIsolatedEmulator,parseAvdName,parseInstalledVersion} from './device-safety.mjs';
test('installation requires the owned emulator and never replaces the game',()=>{
  const safe={serial:'emulator-5580',qemu:'1',avdName:'Geoclick_Firebase_API36',versionCode:null};
  assert.doesNotThrow(()=>assertIsolatedEmulator(safe));
  for(const change of [{serial:'physical-phone'},{qemu:'0'},{avdName:'personal-device'},{versionCode:1020199}])assert.throws(()=>assertIsolatedEmulator({...safe,...change}));
});

test('ADB Windows CRCRLF and package output are parsed without weakening guards',()=>{
  assert.equal(parseAvdName('Geoclick_Firebase_API36\r\r\nOK\r\r\n'),'Geoclick_Firebase_API36');
  assert.equal(parseInstalledVersion('  versionCode=1020199 minSdk=24\r\n'),1020199);
  assert.equal(parseInstalledVersion('Unable to find package: com.geoclick.mobile\r\n'),null);
  assert.throws(()=>parseInstalledVersion('Package exists but version unavailable'));
});
