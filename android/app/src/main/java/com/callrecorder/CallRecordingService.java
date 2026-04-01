package com.callrecorder;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class CallRecordingService extends Service {

    private static final String TAG = "RecVault";
    private static final String CHANNEL_ID = "RecVaultCh";
    private static final int NOTIF_ID = 201;

    public static boolean isRunning = false;

    private MediaRecorder recorder;
    private TelephonyManager telMgr;
    private AudioManager audioMgr;
    private PhoneStateListener psListener;
    private Handler handler = new Handler(Looper.getMainLooper());

    private boolean recording = false;
    private String filePath = null;
    private boolean wasSpeakerOn = false;
    private int prevCallVol = -1;
    private int prevMusicVol = -1;
    private int prevMode = AudioManager.MODE_NORMAL;

    // ─── Sources to try in order ──────────────────────────────
    // Samsung Android 10+: VOICE_RECOGNITION with speakerphone = best chance
    private static final int[] SOURCES_NEW = {
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,
            MediaRecorder.AudioSource.MIC,
            6, // VOICE_UPLINK — try unconventional source
            MediaRecorder.AudioSource.CAMCORDER,
    };
    private static final int[] SOURCES_OLD = {
            MediaRecorder.AudioSource.VOICE_CALL,
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            MediaRecorder.AudioSource.MIC,
    };

    @Override
    public void onCreate() {
        super.onCreate();
        makeChannel();
        startForeground(NOTIF_ID, buildNotif("RecVault monitoring calls..."));
        audioMgr = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        listenCalls();
        isRunning = true;
        Log.d(TAG, "Service started | " + Build.MANUFACTURER + " API " + Build.VERSION.SDK_INT);
    }

    private void listenCalls() {
        telMgr = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
        psListener = new PhoneStateListener() {
            @Override
            public void onCallStateChanged(int state, String num) {
                if (state == TelephonyManager.CALL_STATE_OFFHOOK && !recording) {
                    // Samsung needs longer delay — audio stream opens slowly
                    handler.postDelayed(() -> startRec(num),
                            isSamsung() ? 2000 : 1200);

                } else if (state == TelephonyManager.CALL_STATE_IDLE && recording) {
                    handler.removeCallbacksAndMessages(null);
                    stopRec();
                }
            }
        };
        telMgr.listen(psListener, PhoneStateListener.LISTEN_CALL_STATE);
    }

    // ─── Start recording ──────────────────────────────────────
    private void startRec(String num) {
        // Build file path
        File dir = new File(getExternalFilesDir(null), "CallRecordings");
        if (!dir.exists())
            dir.mkdirs();

        String ts = new SimpleDateFormat("yyyyMMdd_HHmmss",
                Locale.getDefault()).format(new Date());
        String n = (num != null && !num.isEmpty())
                ? num.replaceAll("[^0-9+]", "")
                : "Unknown";
        filePath = dir.getAbsolutePath() + "/" + ts + "_" + n + ".mp4";

        Log.d(TAG, "Attempting recording → " + filePath);

        // Android 8 & 9 — VOICE_CALL works directly
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            for (int src : SOURCES_OLD) {
                if (trySource(src, false)) {
                    updateNotif("🔴 Recording call...");
                    Log.d(TAG, "✅ Started (old Android) source=" + src);
                    return;
                }
            }
        }

        // Android 10+ — speakerphone trick required
        applySamsungFix();

        // Extra delay after speakerphone ON (Samsung audio routing takes time)
        handler.postDelayed(() -> {
            boolean ok = false;
            for (int src : SOURCES_NEW) {
                if (trySource(src, true)) {
                    ok = true;
                    updateNotif("🔴 Recording call...");
                    Log.d(TAG, "✅ Started source=" + src);
                    break;
                }
            }
            if (!ok) {
                Log.e(TAG, "❌ All sources failed");
                restoreAudio();
                recording = false;
                // Retry once after 2 more seconds
                handler.postDelayed(() -> {
                    if (!recording) {
                        applySamsungFix();
                        handler.postDelayed(() -> {
                            for (int src : SOURCES_NEW) {
                                if (trySource(src, true)) {
                                    updateNotif("🔴 Recording call...");
                                    break;
                                }
                            }
                        }, 800);
                    }
                }, 2000);
            }
        }, isSamsung() ? 1000 : 500);
    }

    // ─── Try one audio source ──────────────────────────────────
    private boolean trySource(int source, boolean useAccessCtx) {
        try {
            releaseRecorder();

            Context ctx = this;
            // Use Accessibility Service context if available (unlocks audio)
            if (useAccessCtx
                    && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                    && CallAccessibilityService.getInstance() != null) {
                ctx = CallAccessibilityService.getInstance();
                Log.d(TAG, "Using Accessibility context");
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                recorder = new MediaRecorder(ctx);
            } else {
                recorder = new MediaRecorder();
            }

            recorder.setAudioSource(source);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioSamplingRate(44100);
            recorder.setAudioEncodingBitRate(128000);
            recorder.setAudioChannels(2);
            recorder.setOutputFile(filePath);
            recorder.prepare();
            recorder.start();
            recording = true;
            return true;

        } catch (Exception e) {
            Log.w(TAG, "Source " + source + " failed: " + e.getMessage());
            releaseRecorder();
            return false;
        }
    }

    // ─── Samsung audio routing fix ────────────────────────────
    private void applySamsungFix() {
        try {
            // Save current state
            wasSpeakerOn = audioMgr.isSpeakerphoneOn();
            prevCallVol = audioMgr.getStreamVolume(AudioManager.STREAM_VOICE_CALL);
            prevMusicVol = audioMgr.getStreamVolume(AudioManager.STREAM_MUSIC);
            prevMode = audioMgr.getMode();

            // Step 1: Set mode BEFORE enabling speakerphone (Samsung order matters)
            audioMgr.setMode(AudioManager.MODE_IN_COMMUNICATION);

            // Step 2: Enable speakerphone
            // This routes audio to speaker → MIC captures BOTH sides
            audioMgr.setSpeakerphoneOn(true);

            // Step 3: Max out call volume
            int maxCall = audioMgr.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL);
            audioMgr.setStreamVolume(AudioManager.STREAM_VOICE_CALL, maxCall, 0);

            // Step 4: Max out music stream (some Samsung models route here)
            int maxMusic = audioMgr.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            audioMgr.setStreamVolume(AudioManager.STREAM_MUSIC, maxMusic, 0);

            // Step 5: Stop Bluetooth if active (blocks MIC on Samsung)
            if (audioMgr.isBluetoothScoOn()) {
                audioMgr.setBluetoothScoOn(false);
                audioMgr.stopBluetoothSco();
            }

            // Step 6: Samsung-specific audio parameters
            if (isSamsung()) {
                try {
                    audioMgr.setParameters("sec_audio_call_recording=true");
                    audioMgr.setParameters("call_mic_mute=false");
                } catch (Exception ignored) {
                }
            }

            Log.d(TAG, "Samsung fix applied: Speaker=ON, Volume=MAX, Mode=IN_COMMUNICATION");

        } catch (Exception e) {
            Log.w(TAG, "applySamsungFix error: " + e.getMessage());
        }
    }

    // ─── Stop recording ───────────────────────────────────────
    private void stopRec() {
        try {
            if (recorder != null) {
                try {
                    recorder.stop();
                } catch (Exception ignored) {
                }
                recorder.reset();
                recorder.release();
                recorder = null;
            }

            if (filePath != null) {
                File f = new File(filePath);
                if (f.exists() && f.length() > 1024) {
                    Log.d(TAG, "✅ Saved: " + f.getName()
                            + " (" + f.length() + " bytes)");
                    CallRecorderModule.sendEvent("NewRecording", null);
                } else {
                    Log.w(TAG, "❌ File empty, deleting");
                    if (f.exists())
                        f.delete();
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "stopRec: " + e.getMessage());
        }

        restoreAudio();
        recording = false;
        updateNotif("RecVault monitoring calls...");
    }

    // ─── Restore audio ────────────────────────────────────────
    private void restoreAudio() {
        try {
            if (!wasSpeakerOn)
                audioMgr.setSpeakerphoneOn(false);
            if (prevCallVol >= 0)
                audioMgr.setStreamVolume(
                        AudioManager.STREAM_VOICE_CALL, prevCallVol, 0);
            if (prevMusicVol >= 0)
                audioMgr.setStreamVolume(
                        AudioManager.STREAM_MUSIC, prevMusicVol, 0);
            audioMgr.setMode(prevMode);
            if (isSamsung()) {
                try {
                    audioMgr.setParameters("sec_audio_call_recording=false");
                } catch (Exception ignored) {
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "restoreAudio: " + e.getMessage());
        }
    }

    private boolean isSamsung() {
        return "samsung".equalsIgnoreCase(Build.MANUFACTURER);
    }

    private void releaseRecorder() {
        if (recorder != null) {
            try {
                recorder.release();
            } catch (Exception ignored) {
            }
            recorder = null;
        }
    }

    // ─── Notification ─────────────────────────────────────────
    private void makeChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "RecVault", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(ch);
        }
    }

    private Notification buildNotif(String text) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("RecVault").setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_call)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true).build();
    }

    private void updateNotif(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null)
            nm.notify(NOTIF_ID, buildNotif(text));
    }

    // ─── Lifecycle ────────────────────────────────────────────
    @Override
    public int onStartCommand(Intent i, int f, int s) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent i) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
        handler.removeCallbacksAndMessages(null);
        if (telMgr != null)
            telMgr.listen(psListener, PhoneStateListener.LISTEN_NONE);
        if (recording)
            stopRec();
    }
}