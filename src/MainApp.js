import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { YouTubeInput } from './YouTubeInput';
import { CustomVideoPlayer } from './CustomVideoPlayer';
import { VideoSidebar } from './VideoSidebar';

export function MainApp() {
  const navigate = useNavigate();
  const [videoId, setVideoId] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState(null);
  const [hotcues, setHotcues] = useState(null);
  const sidebarRef = useRef(null);
  const playerRef = useRef(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingVideo, setPendingVideo] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // 'select' or 'navigate'

  const handleLogout = useCallback(() => {
    // Clear authentication data
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
    // Redirect to login
    navigate('/login', { replace: true });
  }, [navigate]);


  const handleVideoSelect = useCallback((video) => {
    // If no video selected, just clear
    if (!video) {
      // Check for unsaved changes before clearing
      if (playerRef.current && playerRef.current.hasUnsavedChanges && playerRef.current.hasUnsavedChanges()) {
        setPendingVideo(null);
        setPendingAction('select');
        setShowUnsavedModal(true);
        return;
      }
      // No unsaved changes, proceed with clearing
      setVideoId(null);
      setYoutubeUrl(null);
      setHotcues(null);
      return;
    }
    
    // Check if we're switching to a different video
    const isDifferentVideo = video.videoId !== videoId;
    
    // Check for unsaved changes before switching videos
    if (isDifferentVideo && playerRef.current && playerRef.current.hasUnsavedChanges && playerRef.current.hasUnsavedChanges()) {
      console.log('Unsaved changes detected, showing modal before switching video');
      setPendingVideo(video);
      setPendingAction('select');
      setShowUnsavedModal(true);
      return;
    }
    
    // No unsaved changes, proceed with selection
    console.log('Loading video from sidebar:', video);
    setVideoId(video.videoId);
    setYoutubeUrl(video.youtubeUrl);
    setHotcues(video.hotcues || {}); // Load existing hotcues
  }, [videoId]);

  const handleVideoSubmit = useCallback((id, url) => {
    // Check for unsaved changes before loading new video
    if (playerRef.current && playerRef.current.hasUnsavedChanges && playerRef.current.hasUnsavedChanges()) {
      setPendingVideo({ videoId: id, youtubeUrl: url, hotcues: null });
      setPendingAction('navigate');
      setShowUnsavedModal(true);
      return;
    }
    
    // No unsaved changes, proceed
    setVideoId(id);
    setYoutubeUrl(url);
    setHotcues(null);
  }, []);

  const handleUnsavedModalSave = useCallback(async () => {
    if (playerRef.current && playerRef.current.saveChanges) {
      try {
        await playerRef.current.saveChanges();
        // Wait a moment for save to complete
        setTimeout(() => {
          setShowUnsavedModal(false);
          // Proceed with pending action
          if (pendingAction === 'select' && pendingVideo) {
            if (!pendingVideo) {
              setVideoId(null);
              setYoutubeUrl(null);
              setHotcues(null);
            } else {
              setVideoId(pendingVideo.videoId);
              setYoutubeUrl(pendingVideo.youtubeUrl);
              setHotcues(pendingVideo.hotcues || {});
            }
          } else if (pendingAction === 'navigate' && pendingVideo) {
            setVideoId(pendingVideo.videoId);
            setYoutubeUrl(pendingVideo.youtubeUrl);
            setHotcues(pendingVideo.hotcues || null);
          }
          setPendingVideo(null);
          setPendingAction(null);
        }, 500);
      } catch (error) {
        console.error('Error saving changes:', error);
        // Don't proceed if save failed
      }
    }
  }, [pendingVideo, pendingAction]);

  const handleUnsavedModalCancel = useCallback(() => {
    setShowUnsavedModal(false);
    setPendingVideo(null);
    setPendingAction(null);
  }, []);

  // Handle browser navigation (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (playerRef.current && playerRef.current.hasUnsavedChanges && playerRef.current.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes! Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleVideoSaved = useCallback(() => {
    // Refresh sidebar after saving
    if (sidebarRef.current && sidebarRef.current.refresh) {
      sidebarRef.current.refresh();
    }
  }, []);

  // Refresh sidebar when component mounts (after login)
  useEffect(() => {
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', position: 'relative' }}>
        {/* Logout Button */}
        <button
          className="logout-button"
          onClick={handleLogout}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '8px 16px',
            fontSize: '14px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            zIndex: 100
          }}
          title="Logout"
        >
          Logout
        </button>
        
        <div style={{ padding: '20px' }}>
          <h1 className="app-title">🐍 Viper Video Jockey 🎬</h1>
          <YouTubeInput onVideoSubmit={handleVideoSubmit} />
          {videoId && (
            <CustomVideoPlayer 
              ref={playerRef}
              key={videoId} 
              videoId={videoId} 
              youtubeUrl={youtubeUrl}
              initialHotcues={hotcues}
              onVideoSaved={handleVideoSaved}
            />
          )}
          
          {/* Unsaved Changes Confirmation Modal */}
          {showUnsavedModal && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}
            >
              <div 
                style={{
                  backgroundColor: 'white',
                  padding: '30px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                  maxWidth: '400px',
                  textAlign: 'center'
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>
                  Unsaved Changes
                </h3>
                <p style={{ marginBottom: '25px', fontSize: '14px' }}>
                  You've made unsaved changes! Want to save?
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                  <button
                    onClick={handleUnsavedModalSave}
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
                  >
                    Save
                  </button>
                  <button
                    onClick={handleUnsavedModalCancel}
                    style={{
                      padding: '10px 20px',
                      fontSize: '16px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
