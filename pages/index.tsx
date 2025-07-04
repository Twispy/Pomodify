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
            albumArt: data.track.album.images[0]?.url
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
      // Mettre à jour toutes les 5 secondes
      const interval = setInterval(fetchCurrentTrack, 5000);
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

  // Recherche Spotify
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
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

  // Charger le SDK Spotify Web Playback
  useEffect(() => {
    console.log("[Pododify] useEffect session:", session);
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
  }, [session, player, playerVolume]);

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
              <button
                type="submit"
                className="bg-[#1DB954] hover:bg-[#169943] text-white px-4 py-2 rounded-lg font-semibold font-['Space_Grotesk']"
                disabled={searchLoading}
              >
                {searchLoading ? '...' : 'Rechercher'}
              </button>
            </form>
            {searchError && <div className="text-red-600 text-sm mb-2">{searchError}</div>}
            {searchResults.length > 0 && (
              <div className="bg-gray-50 rounded-xl shadow p-3 max-h-64 overflow-y-auto">
                {searchResults.map((item, idx) => (
                  <div
                    key={item.type + item.id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition hover:bg-[#eebbc320] ${selectedUri === item.uri ? 'ring-2 ring-[#1DB954]' : ''}`}
                    onClick={() => setSelectedUri(item.uri)}
                  >
                    {item.image && <img src={item.image} alt="" className="w-10 h-10 rounded-md object-cover" />}
                    <div className="flex-1">
                      <div className="font-semibold text-[#232946] font-['Space_Grotesk']">{item.name}</div>
                      <div className="text-xs text-gray-500 font-['Space_Grotesk']">
                        {item.type === 'playlist' ? `Playlist${item.owner ? ' • ' + item.owner : ''}` : `Musique • ${item.artist}`}
                      </div>
                    </div>
                    {selectedUri === item.uri && <span className="text-[#1DB954] font-bold">✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timer Display */}
        <div className="text-[4.5em] font-mono text-[#232946] mb-2 font-bold tracking-[3px] font-['JetBrains_Mono']">
          {formatTime(timeLeft)}
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-[340px] h-[10px] bg-[#eaeaea] rounded-[5px] mb-6 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <div
            className="h-full transition-all duration-300 rounded-l-[5px]"
            style={{
              width: `${getProgressPercent()}%`,
              background: `linear-gradient(90deg, ${getProgressColor()} 0%, ${getProgressColor()}dd 100%)`,
            }}
          ></div>
        </div>

        {/* Mode Indicator */}
        <div className="mb-6 text-[1.1rem] text-[#393e46] font-medium font-['Space_Grotesk']">
          Mode : <strong>{getModeText()}</strong>
        </div>

        {/* Time Adjustment Buttons */}
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

        {/* Timer Control Buttons */}
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

        {/* Spotify Integration */}
        {session ? (
          <div className="w-full">
            {/* Current Track Display */}
            <div className="flex flex-col items-center">
              {currentTrack ? (
                <>
                  <img
                    src={currentTrack.albumArt}
                    alt="Pochette album"
                    className="w-20 h-20 rounded-xl shadow-[0_2px_8px_rgba(35,41,70,0.13)] mb-2 object-cover"
                  />
                  <div className="text-[#232946] text-base text-center font-['Space_Grotesk']">
                    🎵 {currentTrack.title} — {currentTrack.artist}
                  </div>
                </>
              ) : (
                <div className="text-center">
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
          </div>
        ) : (
          <button
            onClick={() => signIn('spotify')}
            className="bg-[#1DB954] hover:bg-[#169943] text-white rounded-[1.2rem] text-base py-3 px-6 border-none cursor-pointer font-semibold shadow-[0_2px_8px_rgba(35,41,70,0.13)] transition-all duration-200 font-['Space_Grotesk']"
          >
            Se connecter à Spotify
          </button>
        )}

        {isWebPlaybackReady && (
          <div className="flex items-center gap-4 bg-gray-100 rounded-xl p-3 my-4 shadow">
            <button onClick={handlePlayPause} className="px-3 py-2 rounded bg-[#1DB954] text-white font-bold">
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <input type="range" min="0" max="1" step="0.01" value={playerVolume} onChange={handleVolume} />
            <span className="text-xs text-gray-600">Volume</span>
          </div>
        )}
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
