// components/PomodoroTimer.tsx
import { useEffect, useState, useRef } from "react";

export default function PomodoroTimer() {
  const initialTime = 25 * 60; // 25 minutes en secondes
  const [secondsLeft, setSecondsLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Format le temps (mm:ss)
  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const startTimer = () => {
    if (intervalRef.current) return;
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const pauseTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  };

  const resetTimer = () => {
    pauseTimer();
    setSecondsLeft(initialTime);
  };

  useEffect(() => {
    return () => pauseTimer(); // Cleanup à la destruction
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "40px" }}>
      <h2 style={{ fontSize: "48px", marginBottom: "20px" }}>{formatTime(secondsLeft)}</h2>
      <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
        {!isRunning ? (
          <button onClick={startTimer}>Démarrer</button>
        ) : (
          <button onClick={pauseTimer}>Pause</button>
        )}
        <button onClick={resetTimer}>Réinitialiser</button>
      </div>
    </div>
  );
}
