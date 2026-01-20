import { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';

// YouTube Player States
const PlayerStates = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5
};

const LETTER_KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'z', 'x', 'c', 'v', 'b', 'n', 'm'];

export function CustomVideoPlayer({ videoId, youtubeUrl, initialHotcues, onVideoSaved }) {
  console.log('CustomVideoPlayer rendered with:', { videoId, youtubeUrl, initialHotcues });
  
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [hotcues, setHotcues] = useState(initialHotcues || {});
  const hotcuesRef = useRef(initialHotcues || {}); // Keep a ref for latest hotcues value
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSettingHotcue, setIsSettingHotcue] = useState(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const isPlayerReadyRef = useRef(false); // Keep a ref for latest ready state
  const timeUpdateIntervalRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => {
    hotcuesRef.current = hotcues;
  }, [hotcues]);

  useEffect(() => {
    isPlayerReadyRef.current = isPlayerReady;
  }, [isPlayerReady]);

  // Load initial hotcues when video changes
  useEffect(() => {
    if (initialHotcues) {
      console.log('Loading initial hotcues:', initialHotcues);
      setHotcues(initialHotcues);
      hotcuesRef.current = initialHotcues;
    } else {
      // Clear hotcues if no initial hotcues provided
      setHotcues({});
      hotcuesRef.current = {};
    }
  }, [videoId, initialHotcues]);

  // Load YouTube IFrame API script
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Initialize YouTube player using IFrame API directly
  useEffect(() => {
    if (!videoId || !containerRef.current) {
      setIsPlayerReady(false);
      return;
    }

    // Reset ready state
    setIsPlayerReady(false);
    setCurrentTime(0);
    setIsPlaying(false);

    // Destroy existing player if any
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        // Ignore errors
      }
      playerRef.current = null;
    }

    const initPlayer = () => {
      if (!containerRef.current || !window.YT || !window.YT.Player) {
        return;
      }

      try {
        // Create player using YouTube IFrame API directly
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId: videoId,
          playerVars: {
            controls: 0, // Hide YouTube controls
            enablejsapi: 1, // Ensure JS API is enabled
            autoplay: 0,
            rel: 0,
            modestbranding: 1
          },
          events: {
            onReady: (event) => {
              console.log('YouTube player ready');
              console.log('Player object:', event.target);
              console.log('Player methods:', {
                getCurrentTime: typeof event.target.getCurrentTime,
                playVideo: typeof event.target.playVideo,
                pauseVideo: typeof event.target.pauseVideo,
                getPlayerState: typeof event.target.getPlayerState
              });
              // Ensure playerRef is set to the event target
              playerRef.current = event.target;
              setIsPlayerReady(true);
            },
            onStateChange: (event) => {
              const state = event.data;
              setIsPlaying(state === PlayerStates.PLAYING);
            },
            onError: (error) => {
              console.error('YouTube player error:', error);
            }
          }
        });
      } catch (error) {
        console.error('Error creating YouTube player:', error);
      }
    };

    // Wait for YouTube API to be ready
    if (window.YT && window.YT.Player) {
      // API already loaded
      requestAnimationFrame(() => {
        initPlayer();
      });
    } else {
      // Wait for API to load
      window.onYouTubeIframeAPIReady = () => {
        requestAnimationFrame(() => {
          initPlayer();
        });
      };

      // Also check periodically in case callback already fired
      const checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval);
          requestAnimationFrame(() => {
            initPlayer();
          });
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
      }, 10000);
    }

    return () => {
      setIsPlayerReady(false);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore errors during cleanup
        }
        playerRef.current = null;
      }
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, [videoId]);

  // Update current time periodically
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) {
      return;
    }

    timeUpdateIntervalRef.current = setInterval(() => {
      if (playerRef.current && isPlayerReady) {
        try {
          // Check if getCurrentTime method exists
          if (typeof playerRef.current.getCurrentTime === 'function') {
            const time = playerRef.current.getCurrentTime();
            if (typeof time === 'number' && !isNaN(time)) {
              setCurrentTime(time);
            }
          }
        } catch (e) {
          // Silently ignore errors - player might not be ready yet
        }
      }
    }, 100); // Update every 100ms for millisecond precision

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, [isPlayerReady]);

  // Handle keyboard events for hotcues
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();
      
      // Use refs to get latest values (not closure values)
      const currentPlayer = playerRef.current;
      const currentReady = isPlayerReadyRef.current;
      const currentHotcues = hotcuesRef.current;
      
      if (LETTER_KEYS.includes(key) && currentPlayer && currentReady) {
        e.preventDefault();
        
        if (currentHotcues[key] !== undefined) {
          // Hotcue already exists - jump to that exact timecode and play from there
          const hotcueTime = currentHotcues[key];
          setIsSettingHotcue(null);
          try {
            console.log('Jumping to hotcue:', key, 'at time:', hotcueTime);
            // Seek to the exact millisecond timecode
            currentPlayer.seekTo(hotcueTime, true);
            // Play from that point
            currentPlayer.playVideo();
          } catch (error) {
            console.error('Error jumping to hotcue:', error);
          }
        } else {
          // Hotcue doesn't exist - SET it at the current time (don't play)
          setIsSettingHotcue(key);
          try {
            const currentTime = currentPlayer.getCurrentTime();
            if (typeof currentTime === 'number' && !isNaN(currentTime)) {
              console.log('Setting hotcue:', key, 'at time:', currentTime);
              // Set the hotcue at the exact current timecode (millisecond precision)
              const newHotcues = { ...currentHotcues, [key]: currentTime };
              setHotcues(newHotcues);
              hotcuesRef.current = newHotcues; // Update ref immediately
              // Visual feedback flash
              setTimeout(() => setIsSettingHotcue(null), 300);
              // Note: We do NOT play the video when setting - just set the hotcue
            }
          } catch (error) {
            console.error('Error setting hotcue:', error);
            setIsSettingHotcue(null);
          }
        }
      } else if (e.code === 'Space' || e.key === 'k') {
        // Play/pause toggle
        e.preventDefault();
        if (currentPlayer && currentReady) {
          try {
            const state = currentPlayer.getPlayerState();
            if (state === PlayerStates.PLAYING) {
              currentPlayer.pauseVideo();
            } else {
              currentPlayer.playVideo();
            }
          } catch (err) {
            console.error('Error toggling play/pause:', err);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []); // Empty dependency array - we use refs for latest values

  const handlePlayPause = useCallback(() => {
    console.log('handlePlayPause called');
    console.log('playerRef.current:', playerRef.current);
    console.log('isPlayerReadyRef.current:', isPlayerReadyRef.current);
    console.log('isPlayerReady state:', isPlayerReady);
    
    // Use refs to get latest values
    const currentPlayer = playerRef.current;
    const currentReady = isPlayerReadyRef.current;
    
    if (!currentPlayer) {
      console.error('Player ref is null');
      return;
    }
    
    if (!currentReady) {
      console.error('Player not ready (ref says false)');
      return;
    }
    
    try {
      console.log('Getting player state...');
      const state = currentPlayer.getPlayerState();
      console.log('Current player state:', state);
      console.log('PlayerStates.PLAYING:', PlayerStates.PLAYING);
      
      if (state === PlayerStates.PLAYING) {
        console.log('Pausing video...');
        currentPlayer.pauseVideo();
      } else {
        console.log('Playing video...');
        currentPlayer.playVideo();
      }
    } catch (e) {
      console.error('Error toggling play/pause:', e);
      console.error('Error details:', e.message, e.stack);
    }
  }, [isPlayerReady]); // Include isPlayerReady for debugging

  const handleSeek = useCallback((seconds) => {
    if (!playerRef.current || !isPlayerReady) return;
    
    try {
      playerRef.current.seekTo(seconds, true);
      playerRef.current.playVideo();
    } catch (e) {
      console.error('Error seeking:', e);
    }
  }, [isPlayerReady]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const clearHotcue = (key) => {
    setHotcues(prev => {
      const newHotcues = { ...prev };
      delete newHotcues[key];
      return newHotcues;
    });
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  const handleSave = useCallback(async () => {
    if (!youtubeUrl || !videoId) {
      setSaveMessage({ 
        type: 'error', 
        text: `Missing required data: ${!youtubeUrl ? 'YouTube URL' : ''} ${!videoId ? 'Video ID' : ''}`.trim()
      });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    const payload = {
      youtubeUrl,
      videoId,
      hotcues: hotcuesRef.current
    };

    console.log('Saving video with payload:', payload);

    try {
      const response = await axios.post('http://localhost:3001/videos', payload, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('Save successful:', response.data);
      setSaveMessage({ 
        type: 'success', 
        text: response.data.message || 'Video and hotcues saved successfully!' 
      });
      setTimeout(() => setSaveMessage(null), 5000);
      
      // Notify parent to refresh sidebar
      if (onVideoSaved) {
        onVideoSaved();
      }
    } catch (error) {
      console.error('Error saving video:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        code: error.code
      });

      let errorMessage = 'Failed to save video. ';
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        errorMessage += 'Cannot connect to backend server. Is it running on port 3001?';
      } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorMessage += 'Request timed out. Please try again.';
      } else if (error.response) {
        // Server responded with error
        const errorData = error.response.data;
        errorMessage += errorData.error || errorData.details || error.response.statusText;
        
        if (errorData.missingFields) {
          errorMessage += ` Missing: ${errorData.missingFields.join(', ')}`;
        }
        
        if (errorData.type) {
          errorMessage += ` (${errorData.type})`;
        }
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }

      setSaveMessage({ 
        type: 'error', 
        text: errorMessage
      });
    } finally {
      setIsSaving(false);
    }
  }, [youtubeUrl, videoId]);

  if (!videoId) {
    return null;
  }

  return (
    <div className="custom-video-player-container" style={{ 
      display: 'flex', 
      gap: '20px', 
      marginTop: '20px',
      maxWidth: '1400px',
      margin: '20px auto',
      padding: '0 20px'
    }}>
      {/* Video Player */}
      <div className="video-player-wrapper" style={{ flex: '1', minWidth: 0 }}>
        <div 
          className="youtube-player-container"
          ref={containerRef} 
          style={{ 
            width: '100%', 
            aspectRatio: '16/9',
            backgroundColor: '#000',
            position: 'relative',
            minHeight: '400px'
          }} 
        />
        
        {/* Custom Controls */}
        <div className="custom-controls" style={{
          marginTop: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px'
        }}>
          <button
            className="play-pause-button"
            onClick={handlePlayPause}
            disabled={!isPlayerReady}
            style={{
              padding: '8px 16px',
              fontSize: '16px',
              backgroundColor: isPlayerReady ? '#007bff' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isPlayerReady ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              opacity: isPlayerReady ? 1 : 0.6
            }}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <div className="current-time-display" style={{ flex: 1, fontSize: '14px', color: '#666' }}>
            {isPlayerReady ? formatTime(currentTime) : 'Loading...'}
          </div>
        </div>
      </div>

      {/* Hotcue Panel */}
      <div className="hotcue-panel" style={{
        width: '300px',
        backgroundColor: '#f9f9f9',
        padding: '15px',
        borderRadius: '4px',
        border: '1px solid #ddd',
        maxHeight: '600px',
        overflowY: 'auto'
      }}>
        <h3 className="hotcue-panel-title" style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>
          Hotcues
        </h3>
        <p className="hotcue-panel-description" style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
          <strong>First press:</strong> Sets hotcue at current time<br/>
          <strong>Subsequent presses:</strong> Jumps to hotcue and plays from that exact timecode
        </p>
        
        <div className="hotcue-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {LETTER_KEYS.map(key => {
            const hotcue = hotcues[key];
            const isActive = isSettingHotcue === key;
            
            return (
              <div
                key={key}
                className={`hotcue-item hotcue-item-${key} ${isActive ? 'hotcue-item-active' : ''} ${hotcue ? 'hotcue-item-set' : 'hotcue-item-unset'}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px',
                  backgroundColor: isActive ? '#fff3cd' : hotcue ? '#d4edda' : 'white',
                  border: `2px solid ${isActive ? '#ffc107' : hotcue ? '#28a745' : '#ddd'}`,
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
              >
                <div className={`hotcue-key-badge hotcue-key-${key}`} style={{
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#007bff',
                  color: 'white',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}>
                  {key.toUpperCase()}
                </div>
                <div className="hotcue-time-display" style={{ flex: 1, fontSize: '14px' }}>
                  {hotcue ? (
                    <span className="hotcue-time-value" style={{ color: '#28a745', fontWeight: 'bold' }}>
                      {formatTime(hotcue)}
                    </span>
                  ) : (
                    <span className="hotcue-time-unset" style={{ color: '#999', fontStyle: 'italic' }}>
                      Not set
                    </span>
                  )}
                </div>
                {hotcue && (
                  <button
                    className={`hotcue-jump-button hotcue-jump-${key}`}
                    onClick={() => handleSeek(hotcue)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                    title="Jump to hotcue"
                  >
                    ▶
                  </button>
                )}
                {hotcue && (
                  <button
                    className={`hotcue-clear-button hotcue-clear-${key}`}
                    onClick={() => clearHotcue(key)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                    title="Clear hotcue"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Save Button - Outside hotcue panel */}
      <div style={{ 
        width: '300px',
        marginTop: '10px'
      }}>
        <button
          className="save-button"
          onClick={handleSave}
          disabled={isSaving || !youtubeUrl}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            backgroundColor: isSaving || !youtubeUrl ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSaving || !youtubeUrl ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            opacity: isSaving || !youtubeUrl ? 0.6 : 1,
            display: 'block'
          }}
        >
          {isSaving ? 'Saving...' : '💾 Save'}
        </button>
        {!youtubeUrl && (
          <p style={{ marginTop: '8px', fontSize: '11px', color: '#999', textAlign: 'center' }}>
            Enter a YouTube URL to enable save
          </p>
        )}
        {/* Debug info - remove later */}
        <p style={{ marginTop: '4px', fontSize: '10px', color: '#bbb', textAlign: 'center' }}>
          Debug: youtubeUrl = {youtubeUrl ? 'SET' : 'NOT SET'}
        </p>
        
        {/* Save Message */}
        {saveMessage && (
          <div 
            className="save-message"
            style={{
              marginTop: '10px',
              padding: '8px',
              borderRadius: '4px',
              backgroundColor: saveMessage.type === 'success' ? '#d4edda' : '#f8d7da',
              color: saveMessage.type === 'success' ? '#155724' : '#721c24',
              border: `1px solid ${saveMessage.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
              fontSize: '14px'
            }}
          >
            {saveMessage.text}
          </div>
        )}
      </div>
    </div>
  );
}
