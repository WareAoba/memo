import { LocalizedError } from '../i18n/errors';
import { record, requestJson } from './client';
export type Photo = { id: string; filename: string; mime_type: string; size_bytes: number };
export type PhotoTarget = { type: 'schedule' | 'task'; id: string };
function parse(value: unknown): Photo {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    typeof value.filename !== 'string' ||
    typeof value.mime_type !== 'string' ||
    typeof value.size_bytes !== 'number'
  )
    throw new LocalizedError('photos.couldNotReadThePhotoResponse');
  return value as Photo;
}
const query = (target: PhotoTarget) =>
  new URLSearchParams({ target_type: target.type, target_id: target.id });
export const photoUrl = (id: string) => '/api/photos/' + encodeURIComponent(id);
export async function listPhotos(target: PhotoTarget, signal?: AbortSignal) {
  const data = await requestJson('/api/photos?' + query(target), 'GET', undefined, signal);
  if (!Array.isArray(data)) throw new LocalizedError('photos.couldNotLoadThePhotoList');
  return data.map(parse);
}
export async function uploadPhoto(target: PhotoTarget, file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new LocalizedError('photos.onlyJpegPngAndWebpPhotosAreSupported');
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new LocalizedError('photos.chooseAPhotoLargerThan0BytesAndNo');
  const params = query(target);
  params.set('filename', file.name);
  const response = await fetch('/api/photos?' + params, {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': file.type },
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(60000),
  }).catch(() => {
    throw new LocalizedError('photos.couldNotSaveThePhotoCheckYourConnectionAnd');
  });
  if (!response.ok)
    throw new LocalizedError(
      response.status === 401
        ? 'Auth.signInRequired'
        : response.status === 409
          ? 'photos.photosCannotBeAddedToArchivedOrCancelledSchedules'
          : response.status === 429
            ? 'photos.uploadBusy'
            : response.status === 507
              ? 'photos.storageFull'
              : response.status === 400 || response.status === 413
                ? 'photos.checkForADamagedPhotoFileSizeOrResolution'
                : 'photos.couldNotSaveThePhotoTryAgain',
    );
  return parse(await response.json());
}
export async function deletePhoto(id: string) {
  await requestJson(photoUrl(id), 'DELETE');
}
