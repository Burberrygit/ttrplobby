// File: frontend/src/app/live/search/page.tsx
// Server wrapper to opt out of prerendering for this route.
export const dynamic = 'force-dynamic';
export const revalidate = false;
export const fetchCache = 'force-no-store';

import Client from './Client';

export default function Page() {
  return <Client />;
}
