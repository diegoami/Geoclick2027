# Geoclick

A geography game: pick a map, learn where each region or town is, and
drag the names onto the map until you know them all. Spaced repetition
brings back what you're about to forget. It works in English, German and
Italian.

**Play in your browser, nothing to install:**
<https://zesty-centaur-40e7c5.netlify.app/>

This repository only holds the downloadable apps. The game's source code
is kept elsewhere.

## Download

Get the latest version from
**[Releases](https://github.com/diegoami/geoclick-releases/releases/latest)**.

| You have | Download | |
|---|---|---|
| Windows 10/11 | `Geoclick-X.Y.Z-windows-x64-setup.exe` | Recommended installer |
| Windows 10/11 | `Geoclick-X.Y.Z-windows-x64.msi` | Same app, as a Windows Installer package |
| Android 7+ | `Geoclick-X.Y.Z-android.apk` | Install directly on the phone |

Your progress stays on your device. There's no account and nothing is
uploaded.

### Windows: "Windows protected your PC"

The installer isn't code-signed, so SmartScreen warns about an "unknown
publisher". Choose **More info → Run anyway**. You'll only see this when
installing.

### Android: installing an APK

1. Open the `.apk` link on your phone and download it.
2. When Android asks, allow your browser (or file manager) to
   **install unknown apps**.
3. Open the downloaded file and tap **Install**.

If you installed a test build of Geoclick earlier, uninstall it first.
Android only accepts an update signed by the same key.

### Checking a download

Each release includes `SHA256SUMS.txt`. Run
`certutil -hashfile <file> SHA256` on Windows or `sha256sum <file>`
elsewhere, and compare the result with the line for that file.

## Updates

The apps don't update themselves. New versions appear on the
[Releases](https://github.com/diegoami/geoclick-releases/releases) page.
Install the new one over the old one, and your progress is kept.
