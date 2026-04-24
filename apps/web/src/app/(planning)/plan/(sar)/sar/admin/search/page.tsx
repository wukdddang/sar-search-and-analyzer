// Admin reuses the same search UI as users. The screen itself is mock-mode
// (`/plan/...`) so it's identical regardless of role; permissions diverge in
// `current` mode where the API gates results by role.
export { default } from '../../user/search/page';
