import { useColorScheme } from 'react-native';

import { palette, type Colors } from './tokens';

export * from './tokens';

export function useColors(): Colors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palette.dark : palette.light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
