import { useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext.jsx';
import { uploadMedia } from '../lib/mediaUpload.js';

// Reusable "Upload" trigger used anywhere a URL field also accepts a real
// file from the user's computer (avatars, post media). The underlying
// state everywhere this is used stays a plain URL string — pasting a
// link and uploading a file both just end up setting the same field.
export default function UploadButton({ accept = 'image/*,video/*', onUploaded, onError, className, children }) {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e) {
    const file = e.target.files[0];
    e.target.value = ''; // lets the same file be picked again later
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadMedia(file, user.id);
      const kind = file.type.startsWith('video/') ? 'video' : 'image';
      onUploaded?.(url, kind);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} style={{ display: 'none' }} />
      <button type="button" className={className} disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? 'Uploading…' : (children ?? 'Upload')}
      </button>
    </>
  );
}
