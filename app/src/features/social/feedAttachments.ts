import type { FeedAttachment } from '../../shared/lib/api';

/** A post's attachments are a mix of share cards (open/join an entity) and
 *  uploaded media (photos/GIFs). These split the two for rendering. */
export const isMediaAttachment = (a: FeedAttachment) => a.type === 'image' || a.type === 'gif';
export const shareCardOf = (attachments?: FeedAttachment[]) =>
  attachments?.find((a) => !isMediaAttachment(a)) ?? null;
export const mediaOf = (attachments?: FeedAttachment[]) =>
  (attachments ?? []).filter(isMediaAttachment);
