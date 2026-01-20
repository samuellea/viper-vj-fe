import { useState, useCallback, useRef } from 'react';
import './App.css';
import { YouTubeInput } from './YouTubeInput';
import { CustomVideoPlayer } from './CustomVideoPlayer';
import { VideoSidebar } from './VideoSidebar';

function App() {
  const [videoId, setVideoId] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState(null);
  const [hotcues, setHotcues] = useState(null);
  const sidebarRef = useRef(null);

  const handleVideoSubmit = (id, url) => {
    setVideoId(id);
    setYoutubeUrl(url);
    setHotcues(null); // Clear hotcues when loading new video
  };

  const handleVideoSelect = useCallback((video) => {
    if (!video) {
      // Clear selection
      setVideoId(null);
      setYoutubeUrl(null);
      setHotcues(null);
      return;
    }
    console.log('Loading video from sidebar:', video);
    setVideoId(video.videoId);
    setYoutubeUrl(video.youtubeUrl);
    setHotcues(video.hotcues || {}); // Load existing hotcues
  }, []);

  const handleVideoSaved = useCallback(() => {
    // Refresh sidebar after saving
    if (sidebarRef.current && sidebarRef.current.refresh) {
      sidebarRef.current.refresh();
    }
  }, []);

  return (
    <div className="App" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <VideoSidebar 
        ref={sidebarRef}
        onVideoSelect={handleVideoSelect} 
        selectedVideoId={videoId} 
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <div style={{ padding: '20px' }}>
          <h1 className="app-title">YouTube Video Player</h1>
          <YouTubeInput onVideoSubmit={handleVideoSubmit} />
          {videoId && (
            <CustomVideoPlayer 
              key={videoId} 
              videoId={videoId} 
              youtubeUrl={youtubeUrl}
              initialHotcues={hotcues}
              onVideoSaved={handleVideoSaved}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
