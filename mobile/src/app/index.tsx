import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { signedIn, account } = useAuth();
  if (!signedIn) return <Redirect href="/welcome" />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Signed in as {account?.userEmail}</Text>
    </View>
  );
}
