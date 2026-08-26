import { redirect } from 'next/navigation';

export const metadata = { title: 'Settings · Coach Intel' };

export default function Page() {
  redirect('/settings/profile');
}
