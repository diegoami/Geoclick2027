import test from 'node:test';
import assert from 'node:assert/strict';
import {assertIsolatedEmulator} from './device-safety.mjs';
test('installation requires the owned emulator and never replaces the game',()=>{
  const safe={serial:'emulator-5580',qemu:'1',avdName:'Geoclick_Firebase_API36',versionCode:null};
  assert.doesNotThrow(()=>assertIsolatedEmulator(safe));
  for(const change of [{serial:'physical-phone'},{qemu:'0'},{avdName:'personal-device'},{versionCode:1020199}])assert.throws(()=>assertIsolatedEmulator({...safe,...change}));
});
