import { Check, X } from 'lucide-react-native';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { CheckSummary } from '@/lib/github';
import { useColors } from '@/theme';

/** Green ring filling up as checks pass; solid green check when all passed, red X on failure. */
export function CheckRing({ summary, size = 30 }: { summary: CheckSummary; size?: number }) {
  const colors = useColors();
  const { total, passed, failed, running } = summary;

  if (total > 0 && running === 0) {
    const ok = failed === 0;
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: ok ? colors.success : colors.danger,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {ok ? (
          <Check size={size * 0.55} color="#fff" strokeWidth={2.5} />
        ) : (
          <X size={size * 0.55} color="#fff" strokeWidth={2.5} />
        )}
      </View>
    );
  }

  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = total ? passed / total : 0;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.divider} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={failed ? colors.danger : colors.success}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${c * progress} ${c}`}
        strokeLinecap="round"
        rotation={-90}
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}
