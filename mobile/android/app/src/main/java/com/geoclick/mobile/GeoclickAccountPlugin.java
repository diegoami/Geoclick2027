package com.geoclick.mobile;

import android.util.AtomicFile;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.json.JSONObject;

/** Public configuration and a non-backed-up writer actor. Never handles tokens. */
@CapacitorPlugin(name = "GeoclickAccount")
public class GeoclickAccountPlugin extends Plugin {
    private static final Object ACTOR_LOCK = new Object();
    private static String cachedActor;
    private static final Object AUTH_LOCK = new Object();
    private static String requestId;
    private static String expectedUid;
    private static boolean lastSavedCommit;

    @PluginMethod
    public void configuration(PluginCall call) {
        String project = resource("project_id");
        boolean available = !project.isEmpty() && !resource("google_app_id").isEmpty()
            && !resource("default_web_client_id").isEmpty();
        JSObject value = new JSObject();
        value.put("available", available);
        if (available) {
            try {
                value.put("projectId", project);
                value.put("packageId", getContext().getPackageName());
                value.put("actorId", actor());
                value.put("rememberAvailable", true);
                try { addCached(value, readCached()); value.put("storageWarning", false); }
                catch (Exception invalid) { value.put("cachedUid", JSONObject.NULL); value.put("storageWarning", true); }
            } catch (Exception error) {
                call.reject("Could not open native account storage.", "storage");
                return;
            }
        }
        call.resolve(value);
    }

    @PluginMethod
    public void begin(PluginCall call) {
        String id = call.getString("requestId", "");
        if (!validId(id)) { call.reject("Invalid account request.", "configuration"); return; }
        synchronized (AUTH_LOCK) {
            requestId = id;
            lastSavedCommit = false;
            expectedUid = null;
            JSObject result = new JSObject();
            try {
                JSONObject cached = call.getBoolean("restoring", false) ? readCached() : null;
                if (cached != null) expectedUid = cached.getString("uid");
                addCached(result, cached);
                call.resolve(result);
            } catch (Exception error) { call.reject("Could not read saved account metadata.", "storage"); }
        }
    }

    @PluginMethod
    public void confirm(PluginCall call) {
        synchronized (AUTH_LOCK) {
            if (!matches(call)) { call.reject("Account request was cancelled.", "cancelled"); return; }
            String uid = call.getString("uid", "");
            String label = call.getString("label", "");
            boolean remember = call.getBoolean("remember", false);
            if (!validId(uid) || label.length() > 320 || hasControl(label)) { call.reject("Invalid account identity.", "configuration"); return; }
            try {
                if (expectedUid != null && !expectedUid.equals(uid)) {
                    clearCached();
                    call.reject("Saved account identity changed.", "identity-changed"); return;
                }
                if (remember) {
                    JSONObject saved = new JSONObject();
                    saved.put("version", 1); saved.put("project", resource("project_id")); saved.put("uid", uid); saved.put("label", label);
                    AtomicFile file = cacheFile(); FileOutputStream output = null;
                    try { output = file.startWrite(); output.write(saved.toString().getBytes(StandardCharsets.UTF_8)); file.finishWrite(output); }
                    catch (Exception error) { if (output != null) file.failWrite(output); throw error; }
                    lastSavedCommit = true;
                } else { clearCached(); lastSavedCommit = false; }
                JSObject result = new JSObject(); result.put("remembered", remember); call.resolve(result);
            } catch (Exception error) { call.reject("Could not save account metadata.", "storage"); }
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        synchronized (AUTH_LOCK) {
            if (!matches(call)) { call.resolve(); return; }
            try { if (lastSavedCommit) clearCached(); requestId = null; expectedUid = null; lastSavedCommit = false; call.resolve(); }
            catch (Exception error) { call.reject("Could not cancel saved account metadata.", "storage"); }
        }
    }

    @PluginMethod
    public void forget(PluginCall call) {
        synchronized (AUTH_LOCK) {
            // A request-bound cleanup never clears a newer login's metadata.
            if (call.getString("requestId") != null && !matches(call)) { call.resolve(); return; }
            try { clearCached(); requestId = null; expectedUid = null; lastSavedCommit = false; call.resolve(); }
            catch (Exception error) { call.reject("Could not forget saved account metadata.", "storage"); }
        }
    }

    private boolean matches(PluginCall call) { return requestId != null && requestId.equals(call.getString("requestId")); }
    private boolean validId(String value) { return value != null && value.matches("[A-Za-z0-9_-]{1,128}"); }
    private boolean hasControl(String value) { for (int i = 0; i < value.length(); i++) if (Character.isISOControl(value.charAt(i))) return true; return false; }
    private AtomicFile cacheFile() throws Exception {
        String project = resource("project_id");
        if (!project.matches("[a-z][a-z0-9-]{4,28}[a-z0-9]")) throw new Exception("Invalid native project");
        return new AtomicFile(new File(getContext().getNoBackupFilesDir(), "account-remember-v1-" + project));
    }
    private JSONObject readCached() throws Exception {
        AtomicFile file = cacheFile();
        if (!file.getBaseFile().exists() && !new File(file.getBaseFile().getPath() + ".bak").exists()) return null;
        try (FileInputStream input = file.openRead()) {
            byte[] bytes = new byte[4097]; int offset = 0, count;
            while (offset < bytes.length && (count = input.read(bytes, offset, bytes.length - offset)) > 0) offset += count;
            if (offset > 4096) throw new Exception("Invalid metadata size");
            JSONObject value = new JSONObject(new String(bytes, 0, offset, StandardCharsets.UTF_8));
            if (value.getInt("version") != 1 || !resource("project_id").equals(value.getString("project")) || !validId(value.getString("uid")) || value.optString("label", "").length() > 320 || hasControl(value.optString("label", ""))) throw new Exception("Invalid metadata");
            return value;
        }
    }
    private void clearCached() throws Exception {
        AtomicFile file = cacheFile(); file.delete();
        if (file.getBaseFile().exists() || new File(file.getBaseFile().getPath() + ".bak").exists()) throw new Exception("Could not remove metadata");
    }
    private void addCached(JSObject result, JSONObject cached) throws Exception {
        result.put("cachedUid", cached == null ? JSONObject.NULL : cached.getString("uid"));
        result.put("cachedLabel", cached == null ? JSONObject.NULL : cached.optString("label", ""));
    }

    private String resource(String name) {
        int id = getContext().getResources().getIdentifier(name, "string", getContext().getPackageName());
        return id == 0 ? "" : getContext().getString(id);
    }

    private String actor() throws Exception {
        synchronized (ACTOR_LOCK) {
            if (cachedActor != null) return cachedActor;
            AtomicFile file = new AtomicFile(new File(getContext().getNoBackupFilesDir(), "progress-actor-v1"));
            try (FileInputStream input = file.openRead()) {
                byte[] buffer = new byte[129];
                int offset = 0, count;
                while (offset < buffer.length && (count = input.read(buffer, offset, buffer.length - offset)) > 0) offset += count;
                String value = new String(buffer, 0, offset, StandardCharsets.UTF_8);
                if (offset <= 128 && UUID.fromString(value).toString().equals(value)) {
                    cachedActor = value;
                    return value;
                }
            } catch (Exception absentOrInvalid) {
                // Missing/corrupt actor metadata starts a fresh actor, not a copied DB actor.
            }
            String value = UUID.randomUUID().toString();
            FileOutputStream output = null;
            try {
                output = file.startWrite();
                output.write(value.getBytes(StandardCharsets.UTF_8));
                file.finishWrite(output);
            } catch (Exception failure) {
                if (output != null) file.failWrite(output);
                throw failure;
            }
            cachedActor = value;
            return value;
        }
    }
}
