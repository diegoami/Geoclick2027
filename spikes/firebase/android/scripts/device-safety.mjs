export function assertIsolatedEmulator({serial,qemu,avdName,versionCode}) {
  if(!/^emulator-\d+$/.test(serial)||qemu!=='1'||avdName!=='Geoclick_Firebase_API36')throw Error("Install only on the proof's isolated Android emulator.");
  if(versionCode!=null&&versionCode!==1)throw Error('An existing game is installed; refusing to replace or uninstall it.');
}
