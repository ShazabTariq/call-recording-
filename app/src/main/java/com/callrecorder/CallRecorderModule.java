package com.callrecorder;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.File;
import java.util.Arrays;

import javax.annotation.Nullable;

public class CallRecorderModule extends ReactContextBaseJavaModule {

    private static ReactApplicationContext reactCtx;

    public CallRecorderModule(ReactApplicationContext context) {
        super(context);
        reactCtx = context;
    }

    @Override
    public String getName() {
        return "CallRecorder";
    }

    // ── Static event sender (called from Java service) ─────────
    public static void sendEvent(String eventName, @Nullable WritableMap params) {
        if (reactCtx != null && reactCtx.hasActiveCatalystInstance()) {
            reactCtx
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(eventName, params);
        }
    }

    // ── Start service ──────────────────────────────────────────
    @ReactMethod
    public void startService(Promise p) {
        try {
            Intent i = new Intent(getReactApplicationContext(), CallRecordingService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                getReactApplicationContext().startForegroundService(i);
            else
                getReactApplicationContext().startService(i);
            p.resolve(true);
        } catch (Exception e) {
            p.reject("ERR", e.getMessage());
        }
    }

    // ── Stop service ───────────────────────────────────────────
    @ReactMethod
    public void stopService(Promise p) {
        try {
            getReactApplicationContext().stopService(
                    new Intent(getReactApplicationContext(), CallRecordingService.class));
            p.resolve(true);
        } catch (Exception e) {
            p.reject("ERR", e.getMessage());
        }
    }

    // ── Service running? ───────────────────────────────────────
    @ReactMethod
    public void isRunning(Promise p) {
        p.resolve(CallRecordingService.isRunning);
    }

    // ── Get recordings list ────────────────────────────────────
    @ReactMethod
    public void getRecordings(Promise p) {
        try {
            File dir = new File(
                    getReactApplicationContext().getExternalFilesDir(null), "CallRecordings");
            WritableArray arr = Arguments.createArray();
            if (dir.exists()) {
                File[] files = dir.listFiles();
                if (files != null) {
                    Arrays.sort(files, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
                    for (File f : files) {
                        // Accept both mp4 and amr
                        String name = f.getName();
                        if (name.endsWith(".mp4") || name.endsWith(".amr") || name.endsWith(".mp3")) {
                            WritableMap m = Arguments.createMap();
                            m.putString("name", name);
                            m.putString("path", f.getAbsolutePath());
                            m.putDouble("size", f.length());
                            m.putDouble("date", f.lastModified());
                            arr.pushMap(m);
                        }
                    }
                }
            }
            p.resolve(arr);
        } catch (Exception e) {
            p.reject("ERR", e.getMessage());
        }
    }

    // ── Delete recording ───────────────────────────────────────
    @ReactMethod
    public void deleteRecording(String path, Promise p) {
        File f = new File(path);
        if (f.exists() && f.delete())
            p.resolve(true);
        else
            p.reject("ERR", "Could not delete file");
    }

    // ── Share via FileProvider (safe for Android 7+) ──────────
    @ReactMethod
    public void shareFile(String filePath, Promise p) {
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                p.reject("ERR", "File not found");
                return;
            }

            Uri uri = FileProvider.getUriForFile(
                    getReactApplicationContext(),
                    "com.callrecorder.fileprovider",
                    file);

            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType("audio/*");
            share.putExtra(Intent.EXTRA_STREAM, uri);
            share.putExtra(Intent.EXTRA_SUBJECT, "Call Recording — " + file.getName());
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            share.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            Intent chooser = Intent.createChooser(share, "Share Recording");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(chooser);
            p.resolve(true);
        } catch (Exception e) {
            p.reject("ERR", e.getMessage());
        }
    }
}