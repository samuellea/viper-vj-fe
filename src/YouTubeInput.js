import { useState } from 'react';
import { extractYouTubeVideoId, isValidYouTubeUrl } from './YouTubePlayer';

export function YouTubeInput({ onVideoSubmit }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      setError('Invalid YouTube URL. Please enter a valid YouTube video URL.');
      return;
    }

    onVideoSubmit(videoId, url.trim());
  };

  const handleChange = (e) => {
    setUrl(e.target.value);
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  return (
    <form className="youtube-input-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '600px', margin: '20px auto' }}>
      <div className="youtube-input-wrapper" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <input
          className={`youtube-url-input ${error ? 'youtube-url-input-error' : ''}`}
          type="text"
          value={url}
          onChange={handleChange}
          placeholder="Enter YouTube video URL"
          style={{
            flex: 1,
            padding: '10px',
            fontSize: '16px',
            border: error ? '2px solid #ff4444' : '2px solid #ccc',
            borderRadius: '4px',
            outline: 'none'
          }}
        />
        <button
          className="youtube-submit-button"
          type="submit"
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
        >
          Submit
        </button>
      </div>
      {error && (
        <div className="youtube-input-error-message" style={{
          color: '#ff4444',
          fontSize: '14px',
          padding: '8px',
          backgroundColor: '#ffe6e6',
          borderRadius: '4px',
          border: '1px solid #ffcccc'
        }}>
          {error}
        </div>
      )}
    </form>
  );
}
