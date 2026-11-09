import { useEditor } from "../state/editor";
import { useUI } from "../state/ui";
import { createTestCard, loadMediaFile, loadMediaUrl, loadPhoto, ACCEPTED_MEDIA } from "./media";
import { getPhoto, randomPhoto, type Photo } from "../data/photos";

const toast = (m: string, tone?: "info" | "success" | "error") => useUI.getState().toast(m, tone);

let busy = false;

/** Load a curated Unsplash photo as the source (credited in the source row and status bar). */
export async function loadPhotoSource(photo: Photo) {
  if (busy) return;
  busy = true;
  try {
    const media = await loadPhoto(photo);
    useEditor.getState().setMedia(media);
    toast(`> SOURCE // PHOTO BY ${photo.name.toUpperCase()} ON UNSPLASH`);
  } catch {
    toast("> SOURCE FAILED — network blocked? Loading test card.", "error");
    useEditor.getState().setMedia(await createTestCard());
  } finally {
    busy = false;
  }
}

export function shuffleSource() {
  const cur = useEditor.getState().media?.credit?.key;
  return loadPhotoSource(randomPhoto(cur));
}

export async function sourceFromFile(file: File) {
  try {
    const media = await loadMediaFile(file);
    useEditor.getState().setMedia(media);
    toast(`> LOADED ${file.name.toUpperCase()} (${media.width}×${media.height})`, "success");
  } catch (e) {
    toast(`> ${(e as Error).message}`, "error");
  }
}

export async function sourceFromUrl(url: string) {
  try {
    const media = await loadMediaUrl(url.trim());
    useEditor.getState().setMedia(media);
    toast(`> LOADED URL (${media.width}×${media.height})`, "success");
    return true;
  } catch (e) {
    toast(`> ${(e as Error).message}`, "error");
    return false;
  }
}

export function openFilePicker() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ACCEPTED_MEDIA;
  input.onchange = () => { const f = input.files?.[0]; if (f) void sourceFromFile(f); };
  input.click();
}

/** First load: deep-linked photo, otherwise a random portrait-ish photo. */
export async function bootSource(photoKey?: string | null) {
  const p = (photoKey && getPhoto(photoKey)) || randomPhoto();
  await loadPhotoSource(p);
}
