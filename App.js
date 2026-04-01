/**
 * ╔═══════════════════════════════════════════╗
 * ║         RECVAULT PRO — CALL RECORDER       ║
 * ║         Developed by Shazab Tariq          ║
 * ╚═══════════════════════════════════════════╝
 *
 * Install before use:
 *   npm install react-native-video
 *   npx react-native run-android
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  PermissionsAndroid, Alert, StatusBar, NativeModules,
  Platform, Animated, Modal, Dimensions,
  TouchableWithoutFeedback, TextInput, Share, NativeEventEmitter, Image, Linking,
} from 'react-native';
import Video from 'react-native-video';
// ./ ka matlab hai isi folder mein dhoondo jahan App.js hai
import iconimage from './ic_app_icon_round.png';

const { CallRecorder } = NativeModules;
const { width: SW } = Dimensions.get('window');

// ═══════════════════════════════════════════
//  DESIGN TOKENS — "Noir Intelligence"
// ═══════════════════════════════════════════
const P = {
  bg: '#04040A',
  surface: '#0A0A16',
  card: '#0D0D1C',
  cardHi: '#111124',
  border: '#1A1A36',
  borderHi: '#2C2C54',
  // Electric blue-cyan accent
  a1: '#4C9EFF',
  a2: '#00E5FF',
  aGlow: 'rgba(76,158,255,0.14)',
  aDim: 'rgba(76,158,255,0.09)',
  // Recording red
  rec: '#FF3D71',
  recGlow: 'rgba(255,61,113,0.16)',
  recDim: 'rgba(255,61,113,0.09)',
  // Gold
  gold: '#FFD600',
  goldDim: 'rgba(255,214,0,0.10)',
  // Text
  white: '#F0F0FF',
  g1: '#9090C0',
  g2: '#525278',
  g3: '#1E1E3C',
  g4: '#0C0C1E',
};

// ═══════════════════════════════════════════
//  APP ICON — Shield + Mic (unique logo icon)
// ═══════════════════════════════════════════
function AppIcon({ size = 44 }) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Image
        source={iconimage} // 👈 'uri' hata kar direct variable ka naam likhein
        style={{ width: size, height: size, resizeMode: 'contain' }}
      />
    </View>
  );
}

// ═══════════════════════════════════════════
//  RADAR RINGS — active while recording
// ═══════════════════════════════════════════
function RadarRings({ active }) {
  const rings = useRef([...Array(4)].map(() => new Animated.Value(0))).current;
  const refs = useRef([]);

  useEffect(() => {
    refs.current.forEach(a => a?.stop());
    refs.current = [];
    if (active) {
      rings.forEach((r, i) => {
        r.setValue(0);
        const a = Animated.loop(Animated.sequence([
          Animated.delay(i * 500),
          Animated.timing(r, { toValue: 1, duration: 2400, useNativeDriver: true }),
          Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]));
        refs.current.push(a);
        a.start();
      });
    } else { rings.forEach(r => r.setValue(0)); }
    return () => refs.current.forEach(a => a?.stop());
  }, [active]);

  if (!active) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {rings.map((r, i) => (
        <Animated.View key={i} style={{
          ...StyleSheet.absoluteFillObject, borderRadius: 999,
          borderWidth: 1.5, borderColor: P.rec,
          opacity: r.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.65, 0] }),
          transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.45, 2.0] }) }],
        }} />
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════
//  WAVEFORM BARS
// ═══════════════════════════════════════════
function WaveBars({ active, color = P.a1, count = 18, barHeight = 44 }) {
  const bars = useRef([...Array(count)].map(() => new Animated.Value(0.07))).current;
  const refs = useRef([]);

  useEffect(() => {
    refs.current.forEach(a => a?.stop());
    refs.current = [];
    if (active) {
      bars.forEach((b, i) => {
        const peak = 0.25 + Math.sin(i * 0.8) * 0.38 + (i % 3) * 0.11;
        const a = Animated.loop(Animated.sequence([
          Animated.timing(b, { toValue: Math.max(0.55, peak), duration: 190 + (i * 43) % 170, useNativeDriver: true }),
          Animated.timing(b, { toValue: Math.max(0.07, peak * 0.18), duration: 210 + (i * 31) % 190, useNativeDriver: true }),
        ]));
        refs.current.push(a);
        a.start();
      });
    } else {
      bars.forEach(b => Animated.spring(b, { toValue: 0.07, useNativeDriver: true, speed: 8 }).start());
    }
    return () => refs.current.forEach(a => a?.stop());
  }, [active]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: barHeight, gap: 2.5 }}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={{
          flex: 1, height: barHeight - 6, borderRadius: 2.5,
          backgroundColor: active ? color : P.g3,
          transform: [{ scaleY: b }],
          opacity: active ? (0.45 + (i % 5) * 0.11) : 0.22,
        }} />
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
const fmtSize = b => {
  if (!b || b < 1) return '—';
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / 1048576).toFixed(1)}MB`;
};
const fmtTime = s => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};
const parseName = (name = '') => {
  const raw = name.replace('.mp4', '').replace('.mp3', '');
  const parts = raw.split('_');
  const d = parts[0] || '', t = parts[1] || '';
  const num = parts.slice(2).join('') || 'unknown';
  const number = num === 'unknown' ? 'Unknown Number' : num;
  const date = d.length >= 8 ? `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6, 8)}` : '—';
  const time = t.length >= 4 ? `${t.slice(0, 2)}:${t.slice(2, 4)}` : '—';
  return { number, date, time };
};
const isToday = dateStr => {
  const now = new Date();
  const td = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  return dateStr === td;
};

// ═══════════════════════════════════════════
//  RECORDING CARD
// ═══════════════════════════════════════════
function RecCard({ item, idx, onPlay, onDel, onStar, starred }) {
  const slideY = useRef(new Animated.Value(18)).current;
  const opac = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opac, { toValue: 1, duration: 320, delay: Math.min(idx * 48, 380), useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 320, delay: Math.min(idx * 48, 380), useNativeDriver: true }),
    ]).start();
  }, []);

  const { number, date, time } = parseName(item.name);
  const today = isToday(date);
  const initials = number === 'Unknown Number' ? '?' : number.slice(-2);

  return (
    <Animated.View style={{ opacity: opac, transform: [{ translateY: slideY }, { scale }] }}>
      <TouchableOpacity
        style={[S.recCard, starred && S.recCardGold]}
        onPress={() => onPlay(item)}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}>

        {/* Avatar */}
        <View style={[S.recAvatar, starred && S.recAvatarGold]}>
          <Text style={[S.recAvatarTxt, starred && { color: P.gold }]}>{initials.toUpperCase()}</Text>
        </View>

        {/* Info */}
        <View style={S.recInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <Text style={S.recNumber} numberOfLines={1}>{number}</Text>
            {today && <View style={S.todayBadge}><Text style={S.todayTxt}>TODAY</Text></View>}
          </View>
          <Text style={S.recMeta}>{date}  ·  {time}  ·  {fmtSize(item.size)}</Text>
        </View>

        {/* Buttons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {/* Star */}
          <TouchableOpacity
            style={[S.actionBtn, starred && { backgroundColor: P.goldDim, borderColor: P.gold + '55' }]}
            onPress={() => onStar(item)}>
            <Text style={{ fontSize: 13, color: starred ? P.gold : P.g2 }}>★</Text>
          </TouchableOpacity>

          {/* Play */}
          <TouchableOpacity style={S.playCircle} onPress={() => onPlay(item)}>
            <View style={S.playTriSmall} />
          </TouchableOpacity>

          {/* Delete */}
          <TouchableOpacity style={S.deleteBtn} onPress={() => onDel(item)}>
            <View style={{ width: 10, height: 2.5, backgroundColor: P.rec, borderRadius: 1, marginBottom: 2 }} />
            <View style={{ width: 8, height: 9, borderWidth: 1.8, borderColor: P.rec, borderRadius: 2, borderTopWidth: 0 }} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════
const SPEEDS = [0.5, 1.0, 1.5, 2.0];
const TABS = ['All', 'Starred', 'Today'];

export default function App() {
  const [on, setOn] = useState(false);
  const [recs, setRecs] = useState([]);
  const [starred, setStarred] = useState(new Set());
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selRec, setSelRec] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [paused, setPaused] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [seekW, setSeekW] = useState(0);
  const [dragging, setDragging] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const searchW = useRef(new Animated.Value(0)).current;
  const videoRef = useRef(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
    init();

    const eventEmitter = new NativeEventEmitter(CallRecorder);
    const sub = eventEmitter.addListener('NewRecording', () => load());
    return () => sub.remove();
  }, []);

  // ── Search ───────────────────────────────
  function toggleSearch() {
    if (searchOpen) {
      setSearch('');
      Animated.timing(searchW, { toValue: 0, duration: 220, useNativeDriver: false })
        .start(() => setSearchOpen(false));
    } else {
      setSearchOpen(true);
      Animated.timing(searchW, { toValue: SW - 118, duration: 260, useNativeDriver: false }).start();
    }
  }

  // ── Init ─────────────────────────────────
  async function init() {
    const ok = await askPerms();
    if (!ok) return;
    try {
      const running = await CallRecorder.isRunning();
      setOn(running);
      if (running) load();
    } catch { }
  }

  async function askPerms() {
    try {
      const list = [
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.PROCESS_OUTGOING_CALLS,
      ];

      // Android 10+ specific permissions
      if (Platform.Version >= 29) {
        list.push(PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS);
        list.push(PermissionsAndroid.PERMISSIONS.ANSWER_PHONE_CALLS);
      }

      // Android 13+ Notification permission
      if (Platform.Version >= 33) {
        list.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      } else {
        list.push(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        list.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
      }

      const res = await PermissionsAndroid.requestMultiple(list);
      const ok = Object.values(res).every(v => v === 'granted');
      
      if (!ok) {
        Alert.alert(
          'Permissions Required',
          'To record calls on Android 10-13, please grant all requested permissions in Settings.',
          [{ text: 'OK' }]
        );
      }
      return ok;
    } catch { return false; }
  }

  async function load() {
    try { setRecs(await CallRecorder.getRecordings() || []); }
    catch { setRecs([]); }
  }

  // ── Toggle service ───────────────────────
  async function toggle() {
    if (on) {
      Alert.alert('Stop Recording?', 'New calls will no longer be captured.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop', style: 'destructive', onPress: async () => {
            await CallRecorder.stopService(); setOn(false);
          }
        },
      ]);
    } else {
      try {
        await CallRecorder.startService();
        Animated.sequence([
          Animated.spring(btnScale, { toValue: 0.86, useNativeDriver: true, speed: 60 }),
          Animated.spring(btnScale, { toValue: 1.08, useNativeDriver: true, speed: 28 }),
          Animated.spring(btnScale, { toValue: 1.0, useNativeDriver: true, speed: 18 }),
        ]).start();
        setOn(true); load();
      } catch (e) { Alert.alert('Error', e.message); }
    }
  }

  function openPlayer(item) {
    setSelRec(item); setProgress(0); setDuration(0);
    setPaused(false); setShowPlayer(true);
  }
  function closePlayer() { setPaused(true); setShowPlayer(false); }

  function toggleStar(item) {
    setStarred(prev => {
      const n = new Set(prev);
      n.has(item.path) ? n.delete(item.path) : n.add(item.path);
      return n;
    });
  }

  async function shareRec(item) {
    try {
      await CallRecorder.shareFile(item.path);
    } catch (e) {
      Alert.alert('Share Error', e.message);
    }
  }

  function confirmDel(item) {
    const { number } = parseName(item.name);
    Alert.alert('Delete Recording?', `"${number}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await CallRecorder.deleteRecording(item.path); load(); }
          catch { Alert.alert('Error', 'Could not delete.'); }
        }
      },
    ]);
  }

  // ── Filtered list ────────────────────────
  const filtered = recs.filter(r => {
    const { number, date } = parseName(r.name);
    const matchS = !search || number.toLowerCase().includes(search.toLowerCase());
    if (tab === 1) return matchS && starred.has(r.path);
    if (tab === 2) return matchS && isToday(date);
    return matchS;
  });

  const totalSize = recs.reduce((a, r) => a + (r.size || 0), 0);
  const todayCount = recs.filter(r => isToday(parseName(r.name).date)).length;
  const pct = duration > 0 ? Math.min(progress / duration, 1) : 0;

  // ── Player info ──────────────────────────
  const playerInfo = selRec ? parseName(selRec.name) : null;

  // ─────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar backgroundColor={P.bg} barStyle="light-content" />

      {/* Audio engine (hidden) */}
      {selRec && (
        <Video
          ref={videoRef}
          source={{ uri: 'file://' + selRec.path }}
          paused={paused}
          rate={SPEEDS[speedIdx]}
          onProgress={d => {
            if (!dragging) setProgress(d.currentTime);
          }}
          onLoad={d => setDuration(d.duration)}
          onEnd={() => { setPaused(true); setProgress(0); videoRef.current?.seek(0); }}
          playInBackground ignoreSilentSwitch="ignore"
          style={{ width: 0, height: 0 }}
        />
      )}

      <FlatList
        data={filtered}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 70 }}

        ListHeaderComponent={
          <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>

            {/* ────────── TOP BAR ────────── */}
            <View style={S.topBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                <AppIcon size={42} />
                <View>
                  <Text style={S.appName}>
                    REC<Text style={{ color: P.a1 }}>VAULT</Text>
                    <Text style={{ color: P.a1, fontSize: 10 }}> PRO</Text>
                  </Text>
                  <Text style={S.appTagline}>CALL RECORDER</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {searchOpen ? (
                  <Animated.View style={[S.searchBox, { width: searchW }]}>
                    <Text style={{ color: P.a1, fontSize: 14, marginRight: 6 }}>⌕</Text>
                    <TextInput
                      style={S.searchInput}
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search number..."
                      placeholderTextColor={P.g2}
                      autoFocus
                    />
                    <TouchableOpacity onPress={toggleSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ color: P.g2, fontSize: 17 }}>✕</Text>
                    </TouchableOpacity>
                  </Animated.View>
                ) : (
                  <TouchableOpacity style={S.headerBtn} onPress={toggleSearch}>
                    <Text style={{ color: P.a1, fontSize: 17 }}>⌕</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={S.headerBtn} onPress={load}>
                  <Text style={{ color: P.a1, fontSize: 17 }}>↻</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ────────── HERO CARD ────────── */}
            <View style={S.heroCard}>
              <View style={[S.heroAccentLine, { backgroundColor: on ? P.rec : P.a1 }]} />

              {/* Live status */}
              <View style={S.statusRow}>
                <View style={[S.statusDot, { backgroundColor: on ? P.rec : P.g3 }]} />
                <Text style={[S.statusLabel, { color: on ? P.rec : P.g2 }]}>
                  {on ? 'RECORDING ACTIVE' : 'SERVICE IDLE'}
                </Text>
                {on && (
                  <View style={S.livePill}>
                    <Text style={S.livePillTxt}>● LIVE</Text>
                  </View>
                )}
              </View>

              {/* Power button */}
              <View style={S.powerWrap}>
                <RadarRings active={on} />
                <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                  <TouchableOpacity
                    style={[S.powerRing, { borderColor: on ? P.rec + '80' : P.border }]}
                    onPress={toggle} activeOpacity={1}>
                    <View style={[S.powerBtn, {
                      backgroundColor: on ? P.recGlow : P.g4,
                      borderColor: on ? P.rec : P.g3,
                      shadowColor: on ? P.rec : P.a1,
                      shadowOpacity: on ? 0.65 : 0.25,
                      shadowRadius: 22, elevation: on ? 14 : 4,
                    }]}>
                      {/* Power arc */}
                      <View style={[S.pwrArc, { borderColor: on ? P.rec : P.g2 }]} />
                      <View style={[S.pwrStem, { backgroundColor: on ? P.rec : P.g2 }]} />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              </View>

              <Text style={[S.powerCTA, { color: on ? P.rec : P.g1 }]}>
                {on ? 'TAP TO STOP' : 'TAP TO START'}
              </Text>
              <Text style={S.powerHint}>
                {on
                  ? 'All calls captured automatically — runs even when app is closed'
                  : 'Start background monitoring · Works silently in the background'}
              </Text>

              {/* Samsung / Android 10+ Accessibility Hint */}
              <View style={S.accHintBox}>
                <Text style={S.accHintTxt}>
                  <Text style={{ color: P.a1, fontWeight: '800' }}>TIP: </Text>
                  On Samsung (Android 10-13), you <Text style={{ fontWeight: '800', color: P.white }}>MUST</Text> enable 
                  <Text style={{ color: P.a1 }}> RECVAULT Call Assistant </Text> 
                  in Accessibility Settings to fix silent recordings.
                </Text>
                <TouchableOpacity 
                   style={S.accBtn} 
                   onPress={() => {
                     Alert.alert(
                       "Enable Accessibility",
                       "1. Look for 'RECVAULT Call Assistant'\n2. Turn it ON\n\nThis is mandatory for Samsung devices to record audio from both sides.",
                       [{ text: "Open Settings", onPress: () => Linking.openSettings() }]
                     );
                   }}>
                  <Text style={S.accBtnTxt}>OPEN ACCESSIBILITY</Text>
                </TouchableOpacity>
              </View>

              {/* Waveform */}
              <View style={S.waveWrap}>
                <WaveBars active={on} color={on ? P.rec : P.a1} count={22} barHeight={42} />
              </View>
            </View>

            {/* ────────── STATS ROW ────────── */}
            <View style={S.statsRow}>
              {[
                { label: 'Total', value: recs.length, sub: 'recorded' },
                { label: 'Today', value: todayCount, sub: 'calls', hi: todayCount > 0 },
                { label: 'Storage', value: fmtSize(totalSize), sub: 'used' },
                { label: 'Starred', value: starred.size, sub: 'saved', gold: starred.size > 0 },
              ].map((s, i) => (
                <View key={i} style={[S.statCard,
                s.hi && { borderColor: P.a1 + '50' },
                s.gold && { borderColor: P.gold + '35' },
                ]}>
                  <Text style={[S.statVal,
                  s.hi && { color: P.a1 },
                  s.gold && { color: P.gold },
                  ]}>{s.value}</Text>
                  <Text style={S.statLabelTxt}>{s.label}</Text>
                  <Text style={S.statSubTxt}>{s.sub}</Text>
                </View>
              ))}
            </View>

            {/* ────────── TABS ────────── */}
            <View style={S.tabBar}>
              {TABS.map((t, i) => (
                <TouchableOpacity key={t} style={[S.tabItem, tab === i && S.tabItemActive]} onPress={() => setTab(i)}>
                  <Text style={[S.tabText, tab === i && S.tabTextActive]}>{t}</Text>
                  {i === 1 && starred.size > 0 && (
                    <View style={S.tabBadgeGold}><Text style={{ color: P.gold, fontSize: 9, fontWeight: '800' }}>{starred.size}</Text></View>
                  )}
                  {i === 2 && todayCount > 0 && (
                    <View style={S.tabBadgeBlue}><Text style={{ color: P.a1, fontSize: 9, fontWeight: '800' }}>{todayCount}</Text></View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Section label */}
            {filtered.length > 0 && (
              <View style={S.secRow}>
                <View style={S.secAccent} />
                <Text style={S.secLabel}>{filtered.length} Recording{filtered.length !== 1 ? 's' : ''}</Text>
              </View>
            )}
          </Animated.View>
        }

        renderItem={({ item, index }) => (
          <RecCard item={item} idx={index}
            onPlay={openPlayer} onDel={confirmDel}
            onStar={toggleStar} starred={starred.has(item.path)} />
        )}

        ListEmptyComponent={
          <View style={S.emptyState}>
            <View style={S.emptyIconWrap}><AppIcon size={64} /></View>
            <Text style={S.emptyTitle}>
              {tab === 1 ? 'No Starred Calls' : tab === 2 ? 'No Calls Today' : 'No Recordings Yet'}
            </Text>
            <Text style={S.emptySub}>
              {on ? 'Make or receive a call — it will appear here' : 'Start the service then make a call'}
            </Text>
          </View>
        }

        ListFooterComponent={
          <View style={S.footer}>
            <View style={S.footerDivider} />
            <View style={{ flexDirection: 'row', gap: 5, marginBottom: 12 }}>
              {[12, 20, 14, 22, 10, 18, 16].map((h, i) => (
                <View key={i} style={{ width: 3.5, height: h, backgroundColor: P.g3, borderRadius: 2 }} />
              ))}
            </View>
            <Text style={S.footerCredit}>This app is developed by</Text>
            <Text style={S.footerName}>Shazab Tariq</Text>
          </View>
        }
      />

      {/* ══════════════════════════════════════
          AUDIO PLAYER BOTTOM SHEET
      ══════════════════════════════════════ */}
      <Modal visible={showPlayer} animationType="slide" transparent statusBarTranslucent>
        <TouchableWithoutFeedback onPress={closePlayer}>
          <View style={S.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={S.playerSheet}>
          {/* Top glow bar */}
          <View style={[S.playerTopGlow, { backgroundColor: P.a1 }]} />
          {/* Handle */}
          <View style={S.playerHandle} />

          {/* Waveform (active while playing) */}
          <View style={{ marginBottom: 10 }}>
            <WaveBars active={!paused} color={P.a1} count={24} barHeight={34} />
          </View>

          {/* Avatar + Track info */}
          <View style={S.playerTrackRow}>
            <View style={S.playerAvatar}>
              <Text style={S.playerAvatarTxt}>
                {playerInfo ? (playerInfo.number === 'Unknown Number' ? '?' : playerInfo.number.slice(-2)).toUpperCase() : '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.playerTrackNum} numberOfLines={1}>
                {playerInfo?.number || '—'}
              </Text>
              <Text style={S.playerTrackDate}>
                {playerInfo?.date}  ·  {playerInfo?.time}
              </Text>
            </View>
            {/* Share button */}
            <TouchableOpacity style={S.shareBtn} onPress={() => selRec && shareRec(selRec)}>
              <Text style={{ color: P.a1, fontSize: 16 }}>⬆</Text>
            </TouchableOpacity>
          </View>

          {/* Seek bar — draggable */}
          <View
            style={S.seekTouchZone}
            onLayout={e => setSeekW(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={e => {
              setDragging(true);
              const x = e.nativeEvent.locationX;
              if (seekW > 0 && duration > 0) {
                const target = Math.max(0, Math.min(1, x / seekW)) * duration;
                setProgress(target);
                videoRef.current?.seek(target);
              }
            }}
            onResponderMove={e => {
              const x = e.nativeEvent.locationX;
              if (seekW > 0 && duration > 0) {
                const target = Math.max(0, Math.min(1, x / seekW)) * duration;
                setProgress(target);
              }
            }}
            onResponderRelease={e => {
              setDragging(false);
              const x = e.nativeEvent.locationX;
              if (seekW > 0 && duration > 0) {
                const target = Math.max(0, Math.min(1, x / seekW)) * duration;
                setProgress(target);
                videoRef.current?.seek(target);
              }
            }}>
            <View style={S.seekTrack} pointerEvents="none">
              <View style={[S.seekFill, { width: `${pct * 100}%` }]} />
            </View>
            <View style={[S.seekThumb, { left: `${Math.max(0, Math.min(100, pct * 100))}%` }]} pointerEvents="none" />
          </View>
          <View style={S.seekTimesRow}>
            <Text style={S.seekTimeText}>{fmtTime(progress)}</Text>
            <Text style={S.seekTimeText}>{fmtTime(duration)}</Text>
          </View>

          {/* Controls */}
          <View style={S.ctrlRow}>
            {/* Speed */}
            <TouchableOpacity style={S.auxBtn} onPress={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)}>
              <Text style={S.auxBtnVal}>{SPEEDS[speedIdx]}×</Text>
              <Text style={S.auxBtnLbl}>Speed</Text>
            </TouchableOpacity>

            {/* -10s */}
            <TouchableOpacity style={S.skipBtnWrap} onPress={() => {
              const t = Math.max(0, progress - 10);
              setProgress(t); videoRef.current?.seek(t);
            }}>
              <Text style={S.skipSymbol}>«</Text>
              <Text style={S.skipLabel}>10s</Text>
            </TouchableOpacity>

            {/* Play / Pause */}
            <TouchableOpacity style={S.playBigBtn} onPress={() => setPaused(p => !p)}>
              {paused
                ? <View style={S.playBigTri} />
                : <View style={{ flexDirection: 'row', gap: 6 }}>
                  <View style={S.pauseBarBig} />
                  <View style={S.pauseBarBig} />
                </View>
              }
            </TouchableOpacity>

            {/* +10s */}
            <TouchableOpacity style={S.skipBtnWrap} onPress={() => {
              const t = Math.min(duration, progress + 10);
              setProgress(t); videoRef.current?.seek(t);
            }}>
              <Text style={S.skipSymbol}>»</Text>
              <Text style={S.skipLabel}>10s</Text>
            </TouchableOpacity>

            {/* Star in player */}
            <TouchableOpacity
              style={S.auxBtn}
              onPress={() => selRec && toggleStar(selRec)}>
              <Text style={[S.auxBtnVal, { fontSize: 18, color: selRec && starred.has(selRec.path) ? P.gold : P.g2 }]}>★</Text>
              <Text style={S.auxBtnLbl}>Star</Text>
            </TouchableOpacity>
          </View>

          {/* Close */}
          <TouchableOpacity style={S.playerCloseBtn} onPress={closePlayer}>
            <Text style={S.playerCloseTxt}>CLOSE PLAYER</Text>
          </TouchableOpacity>

          <Text style={S.playerDevCredit}>Developed by Shazab Tariq</Text>
        </View>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },

  // Top bar
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 18,
    paddingTop: 52, paddingBottom: 14,
  },
  appName: { fontSize: 22, fontWeight: '900', color: P.white, letterSpacing: 1.2 },
  appTagline: { fontSize: 8, color: P.g2, letterSpacing: 3.5, fontWeight: '700' },
  headerBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: P.surface, borderWidth: 1, borderColor: P.border,
    justifyContent: 'center', alignItems: 'center',
  },
  searchBox: {
    height: 38, backgroundColor: P.surface, borderRadius: 11,
    borderWidth: 1, borderColor: P.a1 + '55',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11,
    overflow: 'hidden',
  },
  searchInput: { flex: 1, color: P.white, fontSize: 13, padding: 0, margin: 0 },

  // Hero card
  heroCard: {
    marginHorizontal: 14, marginBottom: 12,
    backgroundColor: P.card, borderRadius: 26,
    paddingBottom: 20, paddingHorizontal: 18,
    borderWidth: 1, borderColor: P.border,
    alignItems: 'center', overflow: 'hidden',
  },
  heroAccentLine: { width: '100%', height: 2, borderRadius: 1, marginBottom: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2.2 },
  livePill: {
    backgroundColor: P.recGlow, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, borderWidth: 1, borderColor: P.rec + '50',
  },
  livePillTxt: { color: P.rec, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },

  // Power
  powerWrap: {
    width: 148, height: 148, borderRadius: 74,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  powerRing: {
    width: 148, height: 148, borderRadius: 74,
    borderWidth: 1.5, justifyContent: 'center', alignItems: 'center',
  },
  powerBtn: {
    width: 122, height: 122, borderRadius: 61,
    borderWidth: 2.5, justifyContent: 'center', alignItems: 'center',
  },
  pwrArc: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 5, borderTopColor: 'transparent',
    position: 'absolute', top: 27,
  },
  pwrStem: {
    width: 4.5, height: 25, borderRadius: 2.5,
    position: 'absolute', top: 16,
  },
  powerCTA: { fontSize: 11, fontWeight: '800', letterSpacing: 3, marginBottom: 7 },
  powerHint: { color: P.g2, fontSize: 11, textAlign: 'center', lineHeight: 17, paddingHorizontal: 4 },
  
  // Accessibility
  accHintBox: {
    backgroundColor: P.cardHi, borderColor: P.a1 + '40', borderWidth: 1,
    borderRadius: 14, padding: 14, marginTop: 18, alignItems: 'center', width: '100%'
  },
  accHintTxt: { color: P.g1, fontSize: 11, textAlign: 'center', lineHeight: 16, marginBottom: 12 },
  accBtn: {
    backgroundColor: P.aDim, borderColor: P.a1 + '55', borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8,
  },
  accBtnTxt: { color: P.a1, fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  waveWrap: { width: '100%', marginTop: 18 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 9, marginHorizontal: 14, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: P.card, borderRadius: 18,
    paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: P.border,
  },
  statVal: { color: P.white, fontSize: 19, fontWeight: '800' },
  statLabelTxt: { color: P.g1, fontSize: 10, fontWeight: '700', marginTop: 3 },
  statSubTxt: { color: P.g3, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 },

  // Tab bar
  tabBar: {
    flexDirection: 'row', marginHorizontal: 14, marginBottom: 14,
    backgroundColor: P.card, borderRadius: 16,
    borderWidth: 1, borderColor: P.border,
    padding: 4, gap: 4,
  },
  tabItem: {
    flex: 1, paddingVertical: 9, borderRadius: 12,
    alignItems: 'center', flexDirection: 'row',
    justifyContent: 'center', gap: 5,
  },
  tabItemActive: {
    backgroundColor: P.g4, borderWidth: 1, borderColor: P.borderHi,
  },
  tabText: { color: P.g2, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: P.white },
  tabBadgeGold: {
    backgroundColor: P.goldDim, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8,
  },
  tabBadgeBlue: {
    backgroundColor: P.aDim, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8,
  },

  // Section row
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, marginBottom: 10 },
  secAccent: { width: 3.5, height: 16, backgroundColor: P.a1, borderRadius: 2 },
  secLabel: { color: P.g1, fontSize: 13, fontWeight: '700' },

  // Recording card
  recCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: P.card, marginHorizontal: 14,
    marginBottom: 9, paddingVertical: 13, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1, borderColor: P.border,
  },
  recCardGold: { borderColor: P.gold + '35', backgroundColor: P.goldDim + '10' },
  recAvatar: {
    width: 50, height: 50, borderRadius: 17,
    backgroundColor: P.aDim, justifyContent: 'center', alignItems: 'center',
    marginRight: 12, borderWidth: 1, borderColor: P.a1 + '30',
  },
  recAvatarGold: { borderColor: P.gold + '60', backgroundColor: P.goldDim },
  recAvatarTxt: { color: P.a1, fontSize: 15, fontWeight: '800' },
  recInfo: { flex: 1 },
  recNumber: { color: P.white, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  recMeta: { color: P.g2, fontSize: 11 },
  todayBadge: {
    backgroundColor: P.aGlow, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1, borderColor: P.a1 + '35',
  },
  todayTxt: { color: P.a1, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  actionBtn: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: P.g4, borderWidth: 1, borderColor: P.border,
    justifyContent: 'center', alignItems: 'center',
  },
  playCircle: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, borderColor: P.a1,
    justifyContent: 'center', alignItems: 'center',
  },
  playTriSmall: {
    width: 0, height: 0,
    borderTopWidth: 5, borderBottomWidth: 5, borderLeftWidth: 9,
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
    borderLeftColor: P.a1, marginLeft: 2,
  },
  deleteBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: P.recDim, borderWidth: 1, borderColor: P.rec + '35',
    justifyContent: 'center', alignItems: 'center', marginLeft: 4,
  },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 44, paddingBottom: 30 },
  emptyIconWrap: {
    width: 104, height: 104, borderRadius: 52,
    backgroundColor: P.card, borderWidth: 1, borderColor: P.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: { color: P.g1, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: {
    color: P.g2, fontSize: 13, textAlign: 'center',
    paddingHorizontal: 52, lineHeight: 20,
  },

  // Footer
  footer: { alignItems: 'center', paddingTop: 36, paddingBottom: 20 },
  footerDivider: { width: 60, height: 1, backgroundColor: P.g3, marginBottom: 14 },
  footerCredit: { color: P.g2, fontSize: 11 },
  footerName: { color: P.a1, fontSize: 16, fontWeight: '900', marginTop: 4, letterSpacing: 1.2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' },

  // Player sheet
  playerSheet: {
    backgroundColor: P.surface,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 22, paddingTop: 10, paddingBottom: 34,
    borderTopWidth: 1, borderColor: P.border,
  },
  playerTopGlow: { width: '100%', height: 1.5, borderRadius: 1, opacity: 0.6, marginBottom: 10 },
  playerHandle: {
    width: 44, height: 5, backgroundColor: P.g3, borderRadius: 3,
    alignSelf: 'center', marginBottom: 16,
  },

  // Player track row
  playerTrackRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22,
  },
  playerAvatar: {
    width: 54, height: 54, borderRadius: 18,
    backgroundColor: P.aDim, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: P.a1 + '40',
  },
  playerAvatarTxt: { color: P.a1, fontSize: 17, fontWeight: '900' },
  playerTrackNum: { color: P.white, fontSize: 17, fontWeight: '800' },
  playerTrackDate: { color: P.g2, fontSize: 12, marginTop: 3 },
  shareBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: P.aDim, borderWidth: 1, borderColor: P.a1 + '50',
    justifyContent: 'center', alignItems: 'center',
  },

  // Seek
  seekTouchZone: { height: 36, justifyContent: 'center', position: 'relative', marginBottom: 6 },
  seekTrack: { height: 6, backgroundColor: P.g3, borderRadius: 3, overflow: 'hidden' },
  seekFill: { height: '100%', backgroundColor: P.a1, borderRadius: 3 },
  seekThumb: {
    position: 'absolute', width: 20, height: 20, borderRadius: 10,
    backgroundColor: P.white, top: 8, marginLeft: -10,
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4,
  },
  seekTimesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  seekTimeText: { color: P.g2, fontSize: 11 },

  // Controls
  ctrlRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 20, marginBottom: 24,
  },
  auxBtn: { alignItems: 'center', minWidth: 40 },
  auxBtnVal: { color: P.a1, fontSize: 15, fontWeight: '900' },
  auxBtnLbl: { color: P.g2, fontSize: 9, marginTop: 3, fontWeight: '700', letterSpacing: 0.5 },
  skipBtnWrap: { alignItems: 'center' },
  skipSymbol: { fontSize: 26, color: P.g1, lineHeight: 30 },
  skipLabel: { color: P.g2, fontSize: 9, marginTop: 2, fontWeight: '600' },
  playBigBtn: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: P.a1, justifyContent: 'center', alignItems: 'center',
    shadowColor: P.a1, shadowOpacity: 0.55, shadowRadius: 18, elevation: 12,
  },
  playBigTri: {
    width: 0, height: 0,
    borderTopWidth: 13, borderBottomWidth: 13, borderLeftWidth: 22,
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
    borderLeftColor: P.bg, marginLeft: 5,
  },
  pauseBarBig: { width: 4.5, height: 24, backgroundColor: P.bg, borderRadius: 2.5 },

  playerCloseBtn: {
    borderWidth: 1, borderColor: P.border, borderRadius: 15,
    paddingVertical: 13, alignItems: 'center', marginBottom: 12,
  },
  playerCloseTxt: { color: P.g2, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  playerDevCredit: { color: P.g3, fontSize: 10, textAlign: 'center', letterSpacing: 0.3 },
});