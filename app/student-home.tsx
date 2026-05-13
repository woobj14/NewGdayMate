import { Redirect } from 'expo-router';

export default function StudentHomeAlias() {
  return <Redirect href={'/(student)' as any} />;
}
