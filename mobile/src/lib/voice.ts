import { useCallback, useEffect, useEffectEvent, useState } from 'react';

// expo-speech-recognition is a native module: it exists in our dev/release builds but
// not in Expo Go. Load it lazily so the rest of the app still runs in Expo Go.
type SpeechModule = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;
let speech: SpeechModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  speech = require('expo-speech-recognition').ExpoSpeechRecognitionModule as SpeechModule;
} catch {
  speech = null;
}

export const voiceSupported = () => !!speech;

/**
 * Dictation using Android's on-device SpeechRecognizer.
 * `onText` receives the full transcript of the current session (interim + final).
 */
export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const emitText = useEffectEvent(onText);

  useEffect(() => {
    if (!speech) return;
    const subs = [
      speech.addListener('result', (e) => {
        const t = e.results[0]?.transcript;
        if (t != null) emitText(t);
      }),
      speech.addListener('end', () => {
        setListening(false);
        setStartedAt(null);
      }),
      speech.addListener('error', (e) => {
        if (e.error !== 'aborted' && e.error !== 'no-speech') setError(e.message);
      }),
      speech.addListener('volumechange', (e) => setLevel(Math.max(0, Math.min(1, (e.value + 2) / 12)))),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  const start = useCallback(async () => {
    if (!speech) {
      setError('Voice input needs the installed app build (not Expo Go).');
      return;
    }
    setError(null);
    const perm = await speech.requestPermissionsAsync();
    if (!perm.granted) {
      setError('Microphone permission denied.');
      return;
    }
    speech.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
    });
    setListening(true);
    setStartedAt(Date.now());
  }, []);

  const stop = useCallback(() => {
    speech?.stop();
  }, []);

  return { listening, startedAt, level, error, start, stop };
}
