# Firebase feasibility spike (#301)

Standalone experiment. It does not replace Geoclick's progress repository, read
existing progress, change the installed apps, or participate in v1.2.1.

## Local experiment

Prerequisites: Node 24, Java 21 or newer, and the root worktree dependencies.
The first run downloads Firebase emulator binaries. No Firebase account, login,
billing account or real cloud project is needed. All hosts bind to loopback;
this harness deliberately uses a `demo-` project ID.

From this worktree's root:

```powershell
cd spikes/firebase
npm ci --workspaces=false
npm test
```

The automated experiment creates synthetic Google-provider identities through
Auth Emulator and uses real Firebase client SDKs against Firestore Emulator.
Its mocked tokens do **not** prove Google's real account picker, consent or MFA.

For the browser demonstration, use two terminals in `spikes/firebase`:

```powershell
npm run emulators
```

```powershell
npm run dev
```

Open <http://localhost:5193>. The page clearly labels simulated Google login.
Use Sign in with Google, select/create an emulator account and save sample
progress. In a second browser profile, use the same emulator account and Read.
Sign out and reload to check the displayed identity. The cloud collection is
`firebaseSpikeUsers/<uid>/cards/demo-target`, with synthetic level/device fields.
The automated tests check account isolation and offline behavior separately.

## Real Google login: owner setup

Use a **dedicated test project**, on Spark with no billing activation.

1. Firebase Console: create/register a Web app in the project (Hosting is not
   required), and copy its Firebase configuration object.
2. Authentication: enable Google, choose the support email, save. In Authorized
   domains add `localhost` for local testing. A Netlify domain is needed only
   when the owner chooses to test a hosted build; this spike triggers no deploy.
3. Create a Firestore database in Native mode. Choose its region deliberately.
   Start with locked rules, then paste the isolated `firestore.rules` into the
   test project's Rules editor and publish them. They allow only the signed-in
   user's synthetic collection, reject malformed writes and deny all other paths.
   Do not replace an existing production project's rules with spike rules.
4. Create an ignored `.env.local` beside this README:

```dotenv
VITE_FIREBASE_MODE=cloud
VITE_FIREBASE_CONFIG='{"apiKey":"YOUR_PUBLIC_WEB_API_KEY","authDomain":"YOUR_PROJECT.firebaseapp.com","projectId":"YOUR_PROJECT","appId":"YOUR_WEB_APP_ID"}'
```

5. Restart `npm run dev`, open <http://localhost:5193>, confirm the REAL GOOGLE
   LOGIN/test-project label and click Sign in with Google. Save/read the sample
   in two independent browser profiles using the same account. Check that another
   Google account sees no sample. Sign out and reload.

Client configuration is public; never paste service-account keys or account
passwords into `.env.local`. Cloud mode contacts the named project and writes
synthetic data only after Save is clicked. Keep this page local for the spike.
Close it and remove `.env.local` when done. Emulator tests never use this file.

## Questions this spike must answer

- Can two clients using one Google-provider identity read the same sample?
- Do rules deny other users and unauthenticated clients?
- Are offline writes sent after reconnect?
- Can an older offline snapshot undo a newer reset? Demonstrate this failure
  explicitly; successful delivery is not a correct progress merge.
- What setup is still needed for a real account and each native shell?

## Native platform findings

**Web:** Firebase's Google popup is the shortest initial path. Auth provides the
UID/session; Firestore provides per-user storage. Neither implements Geoclick's
learning/reset merge policy for us.

**Android/Capacitor:** Google's native account flow needs a registered Android
app and signing fingerprints. A Capacitor native authentication bridge can
supply the Google credential to the Firebase JS client. Evaluate its version
against this project's Capacitor version before choosing it. No native bridge
is installed or device login claimed by this harness.

**Windows/Tauri:** the browser-popup experiment is not a Windows sign-in test.
Google forbids authentication in an app-controlled embedded user agent. A
system-browser flow with a secure callback/credential handoff is needed; this
repo has no such callback/opener integration today. Evaluate external-browser
OAuth versus a hosted one-time pairing/custom-token flow in a follow-up. The
latter requires a trusted backend; never mint custom tokens in the client.
No native executable/login is claimed here.

**Offline/conflicts:** Firestore synchronizes queued document writes using last
write wins. Snapshot syncing can undo mistakes or resets when devices reconnect
out of order. Production sync needs a separately agreed event/revision/reset
policy, account-switch cache boundaries and durable local queuing. This spike
uses memory-backed test clients; reconnect success is not proof of survival
across app closure or browser eviction.

## References

- [Google web sign-in](https://firebase.google.com/docs/auth/web/google-signin)
- [Auth Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth)
- [Firestore offline behavior](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Android registration/sign-in](https://firebase.google.com/docs/auth/android/google-signin)
- [Capacitor authentication bridge](https://capawesome.io/docs/sdks/capacitor/firebase/authentication/)
- [Google embedded-browser policy](https://developers.google.com/identity/protocols/oauth2/policies)
- [Firebase custom tokens require a trusted server](https://firebase.google.com/docs/auth/admin/create-custom-tokens)

## Results

Checked locally on 2026-10-31 with Firebase JS SDK 13.1.0, Firebase CLI 15.34.2,
Node 24 and Java 25. Automated commands target only `demo-geoclick-spike`.

- **PASS:** eight SDK scenario checks (nine Node test entries including their
  parent): stable mocked Google identity across clients, shared synthetic
  progress, another-user denial, unauthenticated denial, invalid/unrelated-path
  denial, offline reconnect, demonstrated last-write-wins reset loss and sign-out.
- **PASS:** real Chromium with the Auth Emulator's Google popup: same identity
  in two browser profiles, save/read, auth persistence after reload, sign-out
  clearing the sample display, and signed-out reload. No page exceptions.
  `npm test` runs both SDK and browser checks under one emulator session. It
  starts a private browser-test server on port 5194 and forces emulator mode,
  even if `.env.local` has a real project's configuration.
  Startup readiness uses HTTP and the expected page content, not Vite terminal
  text. The full suite passes with Vite startup banners suppressed; an occupied
  test port fails immediately without using or stopping its existing listener.
- **PASS:** standalone Vite production build; approximately 554 kB JS / 167 kB
  gzip. This dependency is not added to Geoclick's production bundle.
- **PASS:** Geoclick's check/test/lint/build gates in this isolated worktree.
- **PASS, independent real-provider handoff:** a fresh browser attempt reached
  `accounts.google.com/v3/signin/identifier` after the owner enabled Firebase
  Authentication/Google in `geoclick2027`. The initial setup error is resolved.
- **PASS, owner-reported live browser sharing:** the owner completed Google
  sign-in, created Firestore in Production/locked mode, applied the supplied
  user-isolated rules, and reported the sample save/read and same-account
  second-browser-profile check working. Those authenticated cloud checks are
  owner-tested, not independently observed by the implementing agent. They
  use synthetic level-2 data, not existing Geoclick progress.
- **PASS, independent anonymous cloud denial:** after rule publication, the
  approved unauthenticated read of a synthetic Firestore path still returns
  HTTP 403 `Missing or insufficient permissions.` The earlier disabled-API
  response is resolved. Different-user isolation and malformed writes are
  tested locally against the same rules, not claimed as live multi-account
  checks. The public client configuration stays ignored by Git.
- **NOT RUN:** Windows native sign-in, Android native sign-in/device checks,
  cross-device durable-offline merging and any deployed-site test. No deploy.

**Recommendation:** GO for a production-sync design using Firebase: browser
Google login and shared cloud sample storage are feasible with the owner's
console setup. Do not adopt snapshot synchronization for production: the
reset-loss check proves that successful delivery alone is insufficient.

Before integrating real learning progress, agree the event/revision/reset
merge policy, durable local queue and account-switch/cache boundaries. Prove
Windows system-browser authentication and the Android native bridge on their
actual shells; browser success does not establish either native login path.
The spike has not selected a production backend, migrated real progress or
unpaused the historical Supabase implementation. The investigation is complete;
production implementation is a separate owner decision.

## Windows system-browser proof (#313)

The separate [native experiment](native/README.md) tests a real Tauri shell's
Google authorization-code/PKCE callback and Firebase credential exchange. It
uses its own app identifier and no game progress. See its setup and evidence
limits; adding the harness does not establish real-provider/native success.


## Android native proof (#313)

The separate [Android experiment](android/README.md) uses a compatible Capacitor
bridge and its own SDK dependency set. It builds a release-signed, emulator-only
auth APK with guest/session-only defaults and opt-in remembered sign-in. Its
README separates mocked tests, compiled APK results and pending real native
Google identity checks. It never opens the game's learning stores.
