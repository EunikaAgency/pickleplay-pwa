import { Navigate, useParams } from 'react-router-dom';

// Legacy /my/* paths used to be the dashboard root before 2026-05-28.
// Forward them to /dashboard/* so existing bookmarks keep working.
export default function MyRedirect() {
  const params = useParams();
  const sub = params['*'] || '';
  return <Navigate to={`/dashboard${sub ? `/${sub}` : ''}`} replace />;
}
