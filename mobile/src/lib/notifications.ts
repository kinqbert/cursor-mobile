import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { hasGithubToken } from './github';
import { queryClient } from './query';
import { kv, secrets } from './storage';

// Remote push does not work inside Expo Go on Android; it needs our own build.
export const pushSupported = () =>
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && Device.isDevice;

const REGISTERED = 'push-registered';

/** Channels + interactive categories. Safe to call on every launch. */
export async function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const kind = n.request.content.data?.kind;
      // The "N Active" summary is only interesting when the app is in the background.
      const foreground = AppState.currentState === 'active';
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      return {
        shouldShowBanner: !(foreground && kind === 'active'),
        shouldShowList: !(foreground && kind === 'active'),
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    },
  });

  await Notifications.setNotificationChannelAsync('agents', {
    name: 'Agent results',
    description: 'When an agent finishes, fails or opens a PR',
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 120, 80, 120],
    lightColor: '#4C79AA',
  });
  await Notifications.setNotificationChannelAsync('active', {
    name: 'Running agents',
    description: 'Silent summary of agents that are currently working',
    importance: AndroidImportance.LOW,
    sound: null,
    vibrationPattern: null,
    enableVibrate: false,
    showBadge: false,
  });

  await Notifications.setNotificationCategoryAsync('agentdone', [
    { identifier: 'open', buttonTitle: 'Review', options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync('agentdonepr', [
    { identifier: 'review', buttonTitle: 'Review PR', options: { opensAppToForeground: true } },
    { identifier: 'open', buttonTitle: 'Open agent', options: { opensAppToForeground: true } },
  ]);
}

export type WorkerConfig = { url: string; secret: string };

export async function getWorkerConfig(): Promise<WorkerConfig | null> {
  const [url, secret] = await Promise.all([secrets.get('workerUrl'), secrets.get('workerSecret')]);
  return url && secret ? { url, secret } : null;
}

async function workerCall(cfg: WorkerConfig, path: string, body?: unknown) {
  const res = await fetch(cfg.url.replace(/\/+$/, '') + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${cfg.secret}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Worker error ${res.status}`);
  return json;
}

async function getPushToken() {
  if (!pushSupported()) throw new Error('Push notifications need the installed app build (not Expo Go).');
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) throw new Error('Notification permission was denied. Enable it in Android settings.');
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Missing EAS projectId — run `npx eas-cli init` in mobile/.');
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

/** Saves the worker config, registers this device's push token with it. */
export async function connectWorker(cfg: WorkerConfig) {
  await workerCall(cfg, '/health'); // validates URL + secret
  const token = await getPushToken();
  await workerCall(cfg, '/register', { token });
  await secrets.set('workerUrl', cfg.url.trim());
  await secrets.set('workerSecret', cfg.secret.trim());
  kv.setJSON(REGISTERED, token);
}

export async function disconnectWorker() {
  const cfg = await getWorkerConfig();
  const token = kv.getJSON<string | null>(REGISTERED, null);
  if (cfg && token) await workerCall(cfg, '/unregister', { token }).catch(() => undefined);
  await secrets.remove('workerUrl');
  await secrets.remove('workerSecret');
  kv.remove(REGISTERED);
}

/**
 * Ask the worker to watch this agent right away, so even runs shorter than a minute
 * (which the per-minute check could miss) get a notification. Fire-and-forget.
 */
export function watchAgent(agentId: string) {
  getWorkerConfig()
    .then((cfg) => (cfg ? workerCall(cfg, '/watch', { agentId }) : null))
    .catch(() => undefined);
}

export async function sendTestNotification() {
  const cfg = await getWorkerConfig();
  if (!cfg) throw new Error('Connect the notification worker first.');
  return workerCall(cfg, '/test', {});
}

/** Re-register on launch in case the push token rotated. */
async function refreshRegistration() {
  const cfg = await getWorkerConfig();
  if (!cfg || !pushSupported()) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  if (kv.getJSON<string | null>(REGISTERED, null) !== token) {
    await workerCall(cfg, '/register', { token });
    kv.setJSON(REGISTERED, token);
  }
}

function route(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as {
    agentId?: string;
    prUrl?: string;
    kind?: string;
  };
  if (response.actionIdentifier === 'review' && data.prUrl && data.agentId) {
    if (hasGithubToken()) router.push({ pathname: '/pr', params: { url: data.prUrl, agentId: data.agentId } });
    else WebBrowser.openBrowserAsync(data.prUrl);
  } else if (data.agentId) {
    router.push({ pathname: '/agent/[id]', params: { id: data.agentId } });
  } else {
    router.navigate('/');
  }
  Notifications.clearLastNotificationResponse();
}

/** Mount once in the signed-in root: channels, token refresh, tap → deep link. */
export function useNotificationRouting(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    setupNotifications().then(refreshRegistration).catch(() => undefined);

    const last = Notifications.getLastNotificationResponse();
    if (last) route(last);
    const sub = Notifications.addNotificationResponseReceivedListener(route);
    return () => sub.remove();
  }, [enabled]);
}
