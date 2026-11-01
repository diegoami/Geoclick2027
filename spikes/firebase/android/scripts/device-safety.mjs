export function assertIsolatedEmulator({serial,qemu,avdName,versionCode}) {
  if(!/^emulator-\d+$/.test(serial)||qemu!=='1'||avdName!=='Geoclick_Firebase_API36')throw Error("Install only on the proof's isolated Android emulator.");
  if(versionCode!=null&&versionCode!==1)throw Error('An existing game is installed; refusing to replace or uninstall it.');
}

export function parseAvdName(output) { return String(output).split(/[\r\n]+/).map(line=>line.trim()).find(Boolean)||''; }
export function parseInstalledVersion(output) {
  const text=String(output).trim();
  const match=/\bversionCode=(\d+)\b/.exec(text);
  if(match)return Number(match[1]);
  if(!text||/Unable to find package:|package .* not found/i.test(text))return null;
  throw Error('Cannot establish installed package version; refusing installation.');
}
