import { Text as RNText, type TextProps } from 'react-native';

import { type ColorName, type TextVariant, type as typeScale, useColors } from '@/theme';

type Props = TextProps & {
  variant?: TextVariant;
  color?: ColorName;
};

export function Text({ variant = 'body', color = 'text', style, ...rest }: Props) {
  const colors = useColors();
  return <RNText {...rest} style={[typeScale[variant], { color: colors[color] }, style]} />;
}
