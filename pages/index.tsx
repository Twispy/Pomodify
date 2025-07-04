import { useEffect, useState, useRef } from "react";
import { useSession, signIn } from "next-auth/react";

export default function Home() {
  const { data: session, status } = useSession();
  const FOCUS_PER_CYCLE = 4;
  const [focusDuration, setFocusDuration] = useState(25 * 60);
  const [breakDuration, setBreakDuration] = useState(5 * 60);
  const [longBreakDuration, setLongBreakDuration] = useState(20 * 60);
  const [timeLeft, setTimeLeft] = useState(focusDuration);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [totalFocusThisCycle, setTotalFocusThisCycle] = useState(0);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [player, setPlayer] = useState<any>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isWebPlaybackReady, setIsWebPlaybackReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerVolume, setPlayerVolume] = useState(0.5);
  const [sdkReloadKey, setSdkReloadKey] = useState(0);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fonction pour récupérer la piste actuelle depuis Spotify
  const fetchCurrentTrack = async () => {
    if (!session) {
      console.log('Pas de session, impossible de récupérer la piste');
      return;
    }
    
    console.log('Tentative de récupération de la piste...');
    
    try {
      const response = await fetch('/api/spotify/current-track');
      console.log('Réponse API:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Données reçues:', data);
        
        if (data.track) {
          console.log('Piste trouvée:', data.track.name);
          setCurrentTrack({
            title: data.track.name,
            artist: data.track.artists.map((a: any) => a.name).join(', '),
            albumArt: data.track.album.images[0]?.url,
            progress: data.track.progress,
            duration: data.track.duration
          });
        } else {
          console.log('Aucune piste en cours de lecture');
          setCurrentTrack(null);
        }
      } else {
        console.error('Erreur API:', response.status);
        const errorData = await response.json();
        console.error('Détails erreur:', errorData);
        setCurrentTrack(null);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de la piste:', error);
      setCurrentTrack(null);
    }
  };

  // Récupérer la piste actuelle quand la session change
  useEffect(() => {
    if (session) {
      console.log('Session détectée, récupération de la piste...');
      fetchCurrentTrack();
      // Mettre à jour toutes les 1 seconde pour une progression fluide
      const interval = setInterval(fetchCurrentTrack, 1000);
      return () => clearInterval(interval);
    }
  }, [session]);

  // Test manuel - récupérer la piste au clic
  const testFetchTrack = () => {
    console.log('Test manuel de récupération de piste');
    fetchCurrentTrack();
  };

  useEffect(() => {
    setTimeLeft(focusDuration);
  }, [focusDuration]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleCycleEnd();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current!);
  }, [isRunning]);

  const handleCycleEnd = () => {
    if (!isBreak) {
      const nextCycle = cycleCount + 1;
      setCycleCount(nextCycle);
      const newTotalFocus = totalFocusThisCycle + focusDuration;
      setTotalFocusThisCycle(newTotalFocus);
      
      if (nextCycle === FOCUS_PER_CYCLE) {
        const newLongBreak = Math.round(newTotalFocus / 5);
        setLongBreakDuration(newLongBreak);
        setTimeLeft(newLongBreak);
      } else {
        const newShortBreak = Math.round(focusDuration / 5);
        setBreakDuration(newShortBreak);
        setTimeLeft(newShortBreak);
      }
      setIsBreak(true);
    } else {
      if (cycleCount === FOCUS_PER_CYCLE) {
        resetAll();
      } else {
        setTimeLeft(focusDuration);
        setIsBreak(false);
      }
    }
    setIsRunning(false);
  };

  const resetAll = () => {
    setFocusDuration(25 * 60);
    setBreakDuration(5 * 60);
    setLongBreakDuration(20 * 60);
    setTimeLeft(25 * 60);
    setIsBreak(false);
    setCycleCount(0);
    setTotalFocusThisCycle(0);
    setIsRunning(false);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const addTime = (mins: number) => {
    if (isBreak) return;
    const newFocusDuration = focusDuration + mins * 60;
    setFocusDuration(newFocusDuration);
    setTimeLeft(prev => prev + mins * 60);
    setBreakDuration(Math.round(newFocusDuration / 5));
  };

  const removeTime = (mins: number) => {
    if (isBreak) return;
    if (focusDuration <= 5 * 60) return;
    const newFocusDuration = Math.max(5 * 60, focusDuration - mins * 60);
    setFocusDuration(newFocusDuration);
    setTimeLeft(prev => Math.max(5 * 60, prev - mins * 60));
    setBreakDuration(Math.round(newFocusDuration / 5));
  };

  const getProgressPercent = () => {
    const total = isBreak 
      ? (cycleCount === FOCUS_PER_CYCLE ? longBreakDuration : breakDuration)
      : focusDuration;
    return 100 * (1 - timeLeft / total);
  };

  const getProgressColor = () => {
    if (isBreak) {
      return cycleCount === FOCUS_PER_CYCLE ? '#3182ce' : '#d69e2e';
    }
    return '#38a169';
  };

  const getModeText = () => {
    if (isBreak) {
      return cycleCount === FOCUS_PER_CYCLE ? 'Long Break' : 'Break';
    }
    return 'Focus';
  };

  // Recherche Spotify (appelée par le bouton ou le debounce)
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!search.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(search)}&type=track,playlist&limit=8`);
      if (!res.ok) {
        const err = await res.json();
        setSearchError(err.message || "Erreur Spotify");
        setSearchLoading(false);
        return;
      }
      const data = await res.json();
      // Fusionner playlists et tracks
      const playlists = (data.playlists?.items || [])
        .filter((p: any) => !!p)
        .map((p: any) => ({
          type: "playlist",
          id: p.id,
          name: p.name,
          uri: p.uri,
          image: p.images?.[0]?.url,
          owner: p.owner?.display_name,
        }));
      const tracks = (data.tracks?.items || [])
        .filter((t: any) => !!t)
        .map((t: any) => ({
          type: "track",
          id: t.id,
          name: t.name,
          uri: t.uri,
          image: t.album?.images?.[0]?.url,
          artist: t.artists?.map((a: any) => a.name).join(", "),
        }));
      setSearchResults([...playlists, ...tracks]);
    } catch (e) {
      setSearchError("Erreur réseau ou serveur");
    }
    setSearchLoading(false);
  };

  // Recherche automatique (debounce) à chaque modification du champ texte
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      handleSearch();
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  // Fonction pour réinitialiser le lecteur Spotify
  const resetSpotifyPlayer = () => {
    console.log('[Pododify] Réinitialisation manuelle du lecteur Spotify...');
    // Supprimer le script SDK si présent
    const sdkScript = document.getElementById('spotify-sdk');
    if (sdkScript) {
      sdkScript.remove();
      console.log('[Pododify] Script SDK supprimé du DOM');
    }
    // Réinitialiser le state player
    setPlayer(null);
    setDeviceId(null);
    setIsWebPlaybackReady(false);
    // Supprimer la callback globale
    delete (window as any).onSpotifyWebPlaybackSDKReady;
    // Incrémenter la clé pour forcer le useEffect
    setSdkReloadKey(prev => prev + 1);
    setTimeout(() => {
      console.log('[Pododify] Prêt à réinjecter le SDK Spotify');
    }, 100);
  };

  // Charger le SDK Spotify Web Playback
  useEffect(() => {
    console.log("[Pododify] useEffect session:", session, "sdkReloadKey:", sdkReloadKey);
    if (!session) return;
    if (player) {
      console.log("[Pododify] Player déjà initialisé");
      return;
    }
    const token = session.accessToken;
    if (!token) {
      console.log("[Pododify] Token d'accès manquant");
      return;
    }

    // Vérifier si le script est déjà injecté
    if (!document.getElementById('spotify-sdk')) {
      console.log("[Pododify] Injection du script Spotify Web Playback SDK...");
      const script = document.createElement('script');
      script.id = 'spotify-sdk';
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);
    } else {
      console.log("[Pododify] Script SDK déjà présent dans le DOM");
    }

    // Attendre que le SDK soit prêt
    (window as any).onSpotifyWebPlaybackSDKReady = () => {
      console.log("[Pododify] SDK Spotify prêt, initialisation du player...");
      const _player = new (window as any).Spotify.Player({
        name: 'Pododify Web Player',
        getOAuthToken: (cb: any) => { cb(token); },
        volume: playerVolume,
      });
      setPlayer(_player);

      _player.addListener('ready', ({ device_id }: any) => {
        setDeviceId(device_id);
        setIsWebPlaybackReady(true);
        console.log('[Pododify] Web Playback SDK prêt, device_id:', device_id);
      });
      _player.addListener('not_ready', () => {
        setIsWebPlaybackReady(false);
        setDeviceId(null);
        console.log('[Pododify] Player non prêt');
      });
      _player.addListener('player_state_changed', (state: any) => {
        setIsPlaying(!!state && !state.paused);
        console.log('[Pododify] Changement d\'état du player', state);
      });
      _player.connect();
    };
  }, [session, player, playerVolume, sdkReloadKey]);

  // Transférer la lecture sur le player web lors du Play
  const handleStart = async () => {
    setIsRunning(true);
    if (session && deviceId) {
      try {
        await fetch('/api/spotify/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uri: selectedUri, deviceId }),
        });
      } catch (e) {
        console.error('Erreur lors du lancement de la musique Spotify', e);
      }
    }
  };

  // Contrôles du mini-lecteur
  const handlePlayPause = () => {
    if (player) player.togglePlay();
  };
  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setPlayerVolume(vol);
    if (player) player.setVolume(vol);
  };

  // Fonction pour lancer la lecture d'une URI instantanément (comportement simple)
  const handlePlayUri = async (uri: string, type?: string, albumUri?: string) => {
    if (!session || !deviceId) {
      alert("Le lecteur Spotify n'est pas prêt ou vous n'êtes pas connecté.");
      return;
    }
    try {
      await fetch('/api/spotify/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri, deviceId }),
      });
      setSelectedUri(uri);
    } catch (e) {
      alert("Erreur lors du lancement de la lecture Spotify.");
    }
  };

  // Ajout d'un formatteur de temps pour la progression Spotify
  const formatTrackTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#232946] to-[#eebbc3] bg-[length:200%_200%] animate-gradient-move flex items-center justify-center p-4 font-['Space_Grotesk']">
      <div className="bg-white rounded-[2rem] shadow-[0_8px_32px_rgba(35,41,70,0.13)] p-10 flex flex-col items-center min-w-[320px] max-w-[90vw]">
        {/* Header */}
        <h1 className="text-[2.2em] font-bold text-[#232946] mb-5 tracking-[2px] font-['Space_Grotesk']">
          🎧 Pododify
        </h1>

        {/* Recherche Spotify */}
        {session && (
          <div className="w-full max-w-md mb-6">
            <form onSubmit={handleSearch} className="flex gap-2 mb-2">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une playlist ou une musique..."
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1DB954] font-['Space_Grotesk']"
              />
            </form>
            {searchError && <div className="text-red-600 text-sm mb-2">{searchError}</div>}
            {searchResults.length > 0 && (
              <div className="bg-gray-50 rounded-xl shadow p-3 max-h-64 overflow-y-auto">
                {/* Séparation musiques et playlists */}
                {searchResults.some(item => item.type === 'track') && (
                  <div className="mb-1">
                    <div className="text-xs font-bold text-[#232946] mb-1">Musiques</div>
                    {searchResults.filter(item => item.type === 'track').map((item, idx) => (
                      <div
                        key={item.type + item.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition hover:bg-[#eebbc320] ${selectedUri === item.uri ? 'ring-2 ring-[#1DB954]' : ''}`}
                        onClick={() => setSelectedUri(item.uri)}
                      >
                        {item.image && <img src={item.image} alt="" className="w-10 h-10 rounded-md object-cover" />}
                        <div className="flex-1">
                          <div className="font-semibold text-[#232946] font-['Space_Grotesk']">{item.name}</div>
                          <div className="text-xs text-gray-500 font-['Space_Grotesk']">
                            Musique • {item.artist}
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handlePlayUri(item.uri, item.type, item.album?.uri); }}
                          className="ml-2 px-2 py-1 bg-[#1DB954] hover:bg-[#169943] text-white rounded-full flex items-center justify-center"
                          title="Lire instantanément"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {searchResults.some(item => item.type === 'playlist') && (
                  <div>
                    <div className="text-xs font-bold text-[#232946] mb-1 mt-2">Playlists</div>
                    {searchResults.filter(item => item.type === 'playlist').map((item, idx) => (
                      <div
                        key={item.type + item.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition hover:bg-[#eebbc320] ${selectedUri === item.uri ? 'ring-2 ring-[#1DB954]' : ''}`}
                        onClick={() => setSelectedUri(item.uri)}
                      >
                        {item.image && <img src={item.image} alt="" className="w-10 h-10 rounded-md object-cover" />}
                        <div className="flex-1">
                          <div className="font-semibold text-[#232946] font-['Space_Grotesk']">{item.name}</div>
                          <div className="text-xs text-gray-500 font-['Space_Grotesk']">
                            Playlist{item.owner ? ' • ' + item.owner : ''}
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handlePlayUri(item.uri, item.type, item.album?.uri); }}
                          className="ml-2 px-2 py-1 bg-[#1DB954] hover:bg-[#169943] text-white rounded-full flex items-center justify-center"
                          title="Lire instantanément"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Timer Card */}
        <div className="w-full max-w-[340px] bg-gray-50 rounded-2xl shadow p-6 flex flex-col items-center mb-8 mt-2">
          <div className="text-[4.5em] font-mono text-[#232946] mb-2 font-bold tracking-[3px] font-['JetBrains_Mono']">
            {formatTime(timeLeft)}
          </div>
          {/* Affichage graphique du cycle Pomodoro */}
          <div className="flex flex-col items-center mb-4">
            <div className="flex gap-2 mb-1">
              {[...Array(FOCUS_PER_CYCLE)].map((_, i) => (
                <span key={i} className={`text-2xl ${i < cycleCount ? 'text-[#1DB954]' : 'text-gray-300'}`}>●</span>
              ))}
            </div>
            <div className="text-xs text-gray-500 font-semibold">Cycle {Math.min(cycleCount + 1, FOCUS_PER_CYCLE)}/{FOCUS_PER_CYCLE}</div>
          </div>
          <div className="w-full h-[10px] bg-[#eaeaea] rounded-[5px] mb-6 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <div
              className="h-full transition-all duration-300 rounded-l-[5px]"
              style={{
                width: `${getProgressPercent()}%`,
                background: `linear-gradient(90deg, ${getProgressColor()} 0%, ${getProgressColor()}dd 100%)`,
              }}
            ></div>
          </div>
          <div className="mb-6 text-[1.1rem] text-[#393e46] font-medium font-['Space_Grotesk']">
            Mode : <strong>{getModeText()}</strong>
          </div>
          <div className="flex gap-5 mb-5">
            <button
              onClick={() => addTime(1)}
              title="Ajouter 1 minute"
              aria-label="Ajouter 1 minute"
              className="bg-transparent text-[#232946] rounded-lg text-[1.5rem] w-[2.7rem] h-[2.7rem] border-none cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-[#eebbc320] hover:shadow-[0_2px_8px_rgba(238,187,195,0.27)]"
              disabled={isBreak}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <button
              onClick={() => removeTime(1)}
              title="Retirer 1 minute"
              aria-label="Retirer 1 minute"
              className="bg-transparent text-[#232946] rounded-lg text-[1.5rem] w-[2.7rem] h-[2.7rem] border-none cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-[#eebbc320] hover:shadow-[0_2px_8px_rgba(238,187,195,0.27)]"
              disabled={isBreak || focusDuration <= 5 * 60}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
          <div className="flex gap-5 mb-5">
            <button
              onClick={handleStart}
              title="Démarrer"
              aria-label="Démarrer"
              disabled={isRunning}
              className="bg-transparent text-[#232946] rounded-lg text-[1.5rem] w-[3.2rem] h-[3.2rem] border-none cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-[#eebbc320] hover:shadow-[0_2px_8px_rgba(238,187,195,0.27)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </button>
            <button
              onClick={() => setIsRunning(false)}
              title="Pause"
              aria-label="Pause"
              disabled={!isRunning}
              className="bg-transparent text-[#232946] rounded-lg text-[1.5rem] w-[3.2rem] h-[3.2rem] border-none cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-[#eebbc320] hover:shadow-[0_2px_8px_rgba(238,187,195,0.27)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
            </button>
            <button
              onClick={resetAll}
              title="Réinitialiser"
              aria-label="Réinitialiser"
              className="bg-transparent text-[#232946] rounded-lg text-[1.5rem] w-[3.2rem] h-[3.2rem] border-none cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-[#eebbc320] hover:shadow-[0_2px_8px_rgba(238,187,195,0.27)]"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Mini-lecteur Spotify Card */}
        <div className="w-full max-w-[340px] bg-gray-50 rounded-2xl shadow p-6 flex flex-col items-center mb-4">
          {isWebPlaybackReady && (
            <div className="flex items-center gap-4 bg-gray-100 rounded-xl p-3 my-2 shadow w-full justify-center">
              <button
                onClick={() => player && player.previousTrack()}
                className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                title="Musique précédente"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
              </button>
              <button onClick={handlePlayPause} className="px-3 py-2 rounded bg-[#1DB954] text-white font-bold" title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                )}
              </button>
              <button
                onClick={() => player && player.nextTrack()}
                className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                title="Musique suivante"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
              </button>
              <div className="flex items-center gap-2 ml-4">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                <input type="range" min="0" max="1" step="0.01" value={playerVolume} onChange={handleVolume} className="accent-[#1DB954] w-24" />
              </div>
            </div>
          )}
          {/* Current Track Display */}
          <div className="flex flex-col items-center w-full">
            {currentTrack ? (
              <>
                <div className="flex items-center w-full mb-2">
                  <img
                    src={currentTrack.albumArt}
                    alt="Pochette album"
                    className="w-16 h-16 rounded-xl shadow mr-4 object-cover"
                  />
                  <div className="flex-1">
                    <div className="text-[#232946] text-base font-['Space_Grotesk'] font-semibold">
                      {currentTrack.title}
                    </div>
                    <div className="text-xs text-gray-500 font-['Space_Grotesk']">
                      {currentTrack.artist}
                    </div>
                  </div>
                </div>
                {/* Barre de progression Spotify */}
                {typeof currentTrack.progress === 'number' && typeof currentTrack.duration === 'number' && (
                  <div className="w-full mt-1">
                    <div className="flex items-center justify-between text-xs text-gray-500 font-mono mb-1">
                      <span>{formatTrackTime(currentTrack.progress)}</span>
                      <span>{formatTrackTime(currentTrack.duration)}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1DB954] transition-all duration-300"
                        style={{ width: `${Math.min(100, 100 * currentTrack.progress / currentTrack.duration)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center w-full">
                <div className="text-[#232946] text-base font-['Space_Grotesk'] mb-2">
                  Aucune musique en cours
                </div>
                <button
                  onClick={testFetchTrack}
                  className="text-sm text-[#1DB954] hover:text-[#169943] font-medium transition-colors"
                >
                  Actualiser
                </button>
              </div>
            )}
          </div>
          {/* Bouton de réinitialisation centré */}
          <div className="flex justify-center w-full mt-4">
            <button
              onClick={resetSpotifyPlayer}
              className="px-4 py-2 bg-[#1DB954] text-white rounded font-semibold hover:bg-[#169943] transition"
            >
              Réinitialiser le lecteur Spotify
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes gradientMove {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 100% 50%;
          }
        }
        .animate-gradient-move {
          animation: gradientMove 8s ease-in-out infinite alternate;
        }
        
        @media (max-width: 500px) {
          .card {
            padding: 1.2rem 0.5rem;
            min-width: unset;
          }
          #timer {
            font-size: 2.5em;
          }
          #progress-bar-container {
            max-width: 90vw;
          }
        }
      `}</style>
    </div>
  );
}
