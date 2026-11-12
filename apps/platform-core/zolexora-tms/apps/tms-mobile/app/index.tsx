import { Redirect } from 'expo-router';

// App entry — navigate straight to authenticated tabs (AuthContext handles unauthenticated redirect)
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
