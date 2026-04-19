import { Session } from './types';

export function tokenValid(session: Session, marginMinutes: number = 5): boolean {
  const now = new Date();
  const limit = new Date(session.expiresAt.getTime() - marginMinutes * 60 * 1000);
  return now < limit;
}
