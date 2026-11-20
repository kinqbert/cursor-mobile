import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';

export default function AgentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader />
      <Text style={{ padding: 20 }}>{id}</Text>
    </View>
  );
}
