import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import API_URL from './config';

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

export const CustomVideoPlayer = forwardRef(({ videoId, youtubeUrl, initialHotcues, onVideoSaved }, ref) => {
  console.log('CustomVideoPlayer rendered with:', { videoId, youtubeUrl, initialHotcues });
  
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  // Normalize hotcues to always be objects { time: number, name?: string }
  const normalizeHotcues = (hotcues) => {
    if (!hotcues) return {};
    const normalized = {};
    Object.keys(hotcues).forEach(key => {
      const value = hotcues[key];
      if (typeof value === 'number') {
        // Old format: just a number
        normalized[key] = { time: value, name: '' };
      } else if (value && typeof value === 'object' && typeof value.time === 'number') {
        // New format: object with time
        normalized[key] = { time: value.time, name: value.name || '' };
      }
    });
    return normalized;
  };

  const [hotcues, setHotcues] = useState(() => normalizeHotcues(initialHotcues));
  const hotcuesRef = useRef(normalizeHotcues(initialHotcues)); // Keep a ref for latest hotcues value
  const initialHotcuesRef = useRef(normalizeHotcues(initialHotcues)); // Keep track of initial hotcues for comparison
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSettingHotcue, setIsSettingHotcue] = useState(null);
  const [triggeredHotcue, setTriggeredHotcue] = useState(null); // Track which hotcue was just triggered
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const isPlayerReadyRef = useRef(false); // Keep a ref for latest ready state
  const timeUpdateIntervalRef = useRef(null);
  const [editingHotcue, setEditingHotcue] = useState(null); // Track which hotcue label is being edited
  const [editingLabel, setEditingLabel] = useState(''); // Current label being edited
  const [isDragging, setIsDragging] = useState(false); // Track if user is dragging progress bar
  const [dragTime, setDragTime] = useState(0); // Preview time while dragging
  const progressBarRef = useRef(null); // Ref for progress bar element

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
      const normalized = normalizeHotcues(initialHotcues);
      setHotcues(normalized);
      hotcuesRef.current = normalized;
      initialHotcuesRef.current = normalized; // Update initial reference
    } else {
      // Clear hotcues if no initial hotcues provided
      setHotcues({});
      hotcuesRef.current = {};
      initialHotcuesRef.current = {};
    }
  }, [videoId, initialHotcues]);

  // Function to check if hotcues have changed
  const hasUnsavedChanges = useCallback(() => {
    const current = hotcuesRef.current;
    const initial = initialHotcuesRef.current;
    
    // Compare keys
    const currentKeys = Object.keys(current || {});
    const initialKeys = Object.keys(initial || {});
    
    if (currentKeys.length !== initialKeys.length) {
      return true; // Keys added or removed
    }
    
    // Check each key for changes
    for (const key of currentKeys) {
      const currentHotcue = current[key];
      const initialHotcue = initial[key];
      
      if (!initialHotcue) {
        return true; // New hotcue added
      }
      
      // Compare time
      const currentTime = typeof currentHotcue === 'number' ? currentHotcue : currentHotcue.time;
      const initialTime = typeof initialHotcue === 'number' ? initialHotcue : initialHotcue.time;
      
      if (currentTime !== initialTime) {
        return true; // Time changed
      }
      
      // Compare name
      const currentName = typeof currentHotcue === 'object' ? (currentHotcue.name || '') : '';
      const initialName = typeof initialHotcue === 'object' ? (initialHotcue.name || '') : '';
      
      if (currentName !== initialName) {
        return true; // Name changed
      }
    }
    
    // Check for deleted hotcues
    for (const key of initialKeys) {
      if (!current[key]) {
        return true; // Hotcue deleted
      }
    }
    
    return false;
  }, []);

  // Note: handleSave is defined later, so we'll update this in a useEffect after handleSave is defined

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
            controls: 1, // Show YouTube controls (including native progress bar)
            enablejsapi: 1, // Ensure JS API is enabled
            autoplay: 0,
            rel: 0, // Don't show related videos from other channels
            modestbranding: 1, // Reduce YouTube branding
            fs: 0, // Disable fullscreen button
            playsinline: 1, // Play inline on mobile
            origin: window.location.origin // Set origin for better control
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
              // Get initial duration
              try {
                const videoDuration = event.target.getDuration();
                if (typeof videoDuration === 'number' && !isNaN(videoDuration) && videoDuration > 0) {
                  setDuration(videoDuration);
                }
              } catch (e) {
                console.warn('Could not get initial duration:', e);
              }
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
          // Update duration periodically (in case it changes or wasn't available initially)
          if (typeof playerRef.current.getDuration === 'function') {
            const videoDuration = playerRef.current.getDuration();
            if (typeof videoDuration === 'number' && !isNaN(videoDuration) && videoDuration > 0) {
              setDuration(videoDuration);
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
          const hotcue = currentHotcues[key];
          const hotcueTime = typeof hotcue === 'number' ? hotcue : hotcue.time;
          setIsSettingHotcue(null);
          // Trigger flash animation
          setTriggeredHotcue(key);
          setTimeout(() => setTriggeredHotcue(null), 250); // Flash for 0.25s
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
          try {
            const currentTime = currentPlayer.getCurrentTime();
            if (typeof currentTime === 'number' && !isNaN(currentTime)) {
              console.log('Setting hotcue:', key, 'at time:', currentTime);
              // Set the hotcue at the exact current timecode (millisecond precision)
              const newHotcues = { ...currentHotcues, [key]: { time: currentTime, name: '' } };
              setHotcues(newHotcues);
              hotcuesRef.current = newHotcues; // Update ref immediately
              
              // Trigger flash animation when setting - flash white
              setTriggeredHotcue(key);
              setTimeout(() => {
                setTriggeredHotcue(null);
                setIsSettingHotcue(null);
              }, 250); // Flash for 0.25s, then clear both states
              // Note: We do NOT play the video when setting - just set the hotcue
            }
          } catch (error) {
            console.error('Error setting hotcue:', error);
            setIsSettingHotcue(null);
            setTriggeredHotcue(null);
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

    // Add listener to both window and document to catch events even when iframe is focused
    window.addEventListener('keydown', handleKeyPress, true); // Use capture phase
    document.addEventListener('keydown', handleKeyPress, true); // Use capture phase
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress, true);
      document.removeEventListener('keydown', handleKeyPress, true);
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

  const handleSeek = useCallback((hotcueValue) => {
    if (!playerRef.current || !isPlayerReady) return;
    
    try {
      // Handle both old format (number) and new format (object)
      const seconds = typeof hotcueValue === 'number' ? hotcueValue : hotcueValue.time;
      playerRef.current.seekTo(seconds, true);
      playerRef.current.playVideo();
    } catch (e) {
      console.error('Error seeking:', e);
    }
  }, [isPlayerReady]);

  const calculateSeekTime = useCallback((clientX) => {
    if (!progressBarRef.current || !duration) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    return percentage * duration;
  }, [duration]);

  const handleProgressBarMouseDown = useCallback((e) => {
    if (!playerRef.current || !isPlayerReady || !duration) return;
    e.preventDefault();
    setIsDragging(true);
    const seekTime = calculateSeekTime(e.clientX);
    setDragTime(seekTime);
  }, [isPlayerReady, duration, calculateSeekTime]);

  const handleProgressBarMouseMove = useCallback((e) => {
    if (!isDragging || !duration) return;
    const seekTime = calculateSeekTime(e.clientX);
    setDragTime(seekTime);
  }, [isDragging, duration, calculateSeekTime]);

  const handleProgressBarMouseUp = useCallback((e) => {
    if (!isDragging || !playerRef.current || !isPlayerReady) return;
    
    const seekTime = calculateSeekTime(e.clientX);
    setIsDragging(false);
    setDragTime(0);
    
    try {
      playerRef.current.seekTo(seekTime, true);
      setCurrentTime(seekTime);
    } catch (error) {
      console.error('Error seeking via progress bar:', error);
    }
  }, [isDragging, isPlayerReady, calculateSeekTime]);

  const handleProgressBarClick = useCallback((e) => {
    // Only handle click if not dragging (to avoid double-seeking)
    if (isDragging) return;
    if (!playerRef.current || !isPlayerReady || !duration) return;
    
    const seekTime = calculateSeekTime(e.clientX);
    
    try {
      playerRef.current.seekTo(seekTime, true);
      setCurrentTime(seekTime);
    } catch (e) {
      console.error('Error seeking via progress bar:', e);
    }
  }, [isDragging, isPlayerReady, duration, calculateSeekTime]);

  // Handle mouse move and mouse up on document for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      handleProgressBarMouseMove(e);
    };

    const handleMouseUp = (e) => {
      handleProgressBarMouseUp(e);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleProgressBarMouseMove, handleProgressBarMouseUp]);

  const handleHotcueLabelClick = (key, hotcue) => {
    if (!hotcue) return;
    setEditingHotcue(key);
    setEditingLabel(typeof hotcue === 'object' ? (hotcue.name || '') : '');
  };

  const handleHotcueLabelBlur = (key) => {
    setHotcues(prev => {
      const newHotcues = { ...prev };
      if (newHotcues[key]) {
        const currentHotcue = newHotcues[key];
        const time = typeof currentHotcue === 'number' ? currentHotcue : currentHotcue.time;
        newHotcues[key] = { time, name: editingLabel.trim() };
      }
      return newHotcues;
    });
    const currentHotcue = hotcuesRef.current[key];
    if (currentHotcue) {
      const time = typeof currentHotcue === 'number' ? currentHotcue : currentHotcue.time;
      hotcuesRef.current = { ...hotcuesRef.current, [key]: { time, name: editingLabel.trim() } };
    }
    setEditingHotcue(null);
    setEditingLabel('');
  };

  const handleHotcueLabelKeyDown = (e, key) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleHotcueLabelBlur(key);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingHotcue(null);
      setEditingLabel('');
    }
  };

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
      hotcuesRef.current = newHotcues; // Update ref immediately
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

    // Get username from localStorage
    const username = localStorage.getItem('username');
    if (!username) {
      setSaveMessage({ 
        type: 'error', 
        text: 'You must be logged in to save videos'
      });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    const payload = {
      youtubeUrl,
      videoId,
      hotcues: hotcuesRef.current,
      username // Include username in payload
    };

    console.log('Saving video with payload:', payload);

    try {
      const response = await axios.post(`${API_URL}/videos`, payload, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('Save successful:', response.data);
      // Update initial hotcues reference after successful save
      initialHotcuesRef.current = { ...hotcuesRef.current };
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
  }, [youtubeUrl, videoId, onVideoSaved]);

  // Function to discard changes and revert to initial hotcues
  const discardChanges = useCallback(() => {
    // Reset hotcues to initial state
    const initial = initialHotcuesRef.current;
    setHotcues(initial);
    hotcuesRef.current = initial;
    console.log('Discarded changes, reverted to initial hotcues:', initial);
  }, []);

  // Expose methods to parent via ref (after handleSave is defined)
  useImperativeHandle(ref, () => ({
    hasUnsavedChanges,
    saveChanges: handleSave,
    discardChanges
  }), [hasUnsavedChanges, handleSave, discardChanges]);

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
      padding: '0 20px',
      alignItems: 'flex-start'
    }}>
      {/* Video Player */}
      <div 
        className="video-player-wrapper" 
        style={{ flex: '1', minWidth: 0, maxWidth: '100%' }}
        tabIndex={-1}
        onKeyDown={(e) => {
          // Capture keyboard events even when video player wrapper is focused
          // This ensures hotcues work when clicking on the video
          const key = e.key.toLowerCase();
          if (LETTER_KEYS.includes(key) || e.code === 'Space' || e.key === 'k') {
            // Don't stop propagation - let the window-level handler process it
            // This wrapper just ensures focus stays on an element that can receive events
          }
        }}
        onClick={(e) => {
          // When clicking on the video wrapper, ensure it can receive keyboard events
          // by focusing it (but don't interfere with video player clicks)
          if (e.target === e.currentTarget || e.target.closest('.youtube-player-container')) {
            e.currentTarget.focus();
          }
        }}
      >
        <div 
          className="youtube-player-container"
          ref={containerRef} 
          style={{ 
            width: '100%', 
            aspectRatio: '16/9',
            backgroundColor: '#000',
            position: 'relative',
            minHeight: '600px' // Standard YouTube height (increased by 100px from 500px)
          }} 
        />
        
        {/* Instructional text */}
        <p className="hotcue-instruction-text" style={{
          marginTop: '10px',
          fontSize: '14px',
          color: 'white',
          backgroundColor: '#999',
          fontStyle: 'italic',
          textAlign: 'center',
          padding: '8px',
          borderRadius: '4px'
        }}>
          💡 NB: If hotcues <span style={{ color: '#8B0000' }}>not working</span>, click anywhere on the page outside the video player
        </p>
        
        {/* Custom Controls */}
        <div className="custom-controls" style={{
          marginTop: '10px',
          display: 'none', // Hidden for now, but kept in code
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
        </div>
      </div>

      {/* Hotcue Panel and Save Button Container */}
      <div style={{ 
        width: '345px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Hotcue Panel */}
        <div className="hotcue-panel" style={{
          width: '100%',
          backgroundColor: '#f9f9f9',
          padding: '15px',
          borderRadius: '4px',
          border: '1px solid #ddd',
          maxHeight: '600px',
          overflowY: 'auto'
        }}>
        <h3 className="hotcue-panel-title" style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>
        🔥 Hotcues
        </h3>
        <p className="hotcue-panel-description" style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
          <strong>First press:</strong> Sets hotcue at current time<br/>
          <strong>Subsequent presses:</strong> Jumps to hotcue and plays from that exact timecode
        </p>
        
        <div className="hotcue-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {LETTER_KEYS.map(key => {
            const hotcue = hotcues[key];
            const isActive = isSettingHotcue === key;
            const isTriggered = triggeredHotcue === key;
            
            // Determine background color based on state
            // isTriggered takes highest priority for flash animation
            let backgroundColor = 'white';
            let borderColor = '#ddd';
            let boxShadow = 'none';
            
            if (isTriggered) {
              backgroundColor = '#ffffff'; // Bright white flash when triggered or set
              borderColor = '#007bff'; // Blue border during flash
              boxShadow = '0 0 10px rgba(0, 123, 255, 0.5)'; // Glow effect
            } else if (isActive) {
              backgroundColor = '#fff3cd'; // Yellow when setting (fallback, but flash should override)
              borderColor = '#ffc107';
            } else if (hotcue) {
              backgroundColor = '#d4edda'; // Green when set
              borderColor = '#28a745';
            }
            
            return (
              <div
                key={key}
                className={`hotcue-item hotcue-item-${key} ${isActive ? 'hotcue-item-active' : ''} ${hotcue ? 'hotcue-item-set' : 'hotcue-item-unset'} ${isTriggered ? 'hotcue-item-triggered' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px',
                  backgroundColor: backgroundColor,
                  border: `2px solid ${borderColor}`,
                  borderRadius: '4px',
                  boxShadow: boxShadow,
                  transition: 'background-color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease, all 0.2s' // Smooth transition for flash animation
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
                <div className="hotcue-time-display" style={{ flex: 1, fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {hotcue ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="hotcue-time-value" style={{ color: '#28a745', fontWeight: 'bold' }}>
                          {formatTime(typeof hotcue === 'number' ? hotcue : hotcue.time)}
                        </span>
                        {editingHotcue === key ? (
                          <input
                            type="text"
                            value={editingLabel}
                            onChange={(e) => setEditingLabel(e.target.value)}
                            onBlur={() => handleHotcueLabelBlur(key)}
                            onKeyDown={(e) => handleHotcueLabelKeyDown(e, key)}
                            autoFocus
                            className="hotcue-label-input"
                            style={{
                              flex: 1,
                              padding: '4px 8px',
                              fontSize: '12px',
                              border: '1px solid #007bff',
                              borderRadius: '3px',
                              outline: 'none'
                            }}
                            placeholder="Label..."
                          />
                        ) : (
                          <span
                            className="hotcue-label-display"
                            onClick={() => handleHotcueLabelClick(key, hotcue)}
                            style={{
                              flex: 1,
                              color: (typeof hotcue === 'object' && hotcue.name) ? '#333' : '#999',
                              fontStyle: (typeof hotcue === 'object' && hotcue.name) ? 'normal' : 'italic',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              borderRadius: '3px',
                              minHeight: '20px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Click to edit label"
                          >
                            {(typeof hotcue === 'object' && hotcue.name) ? hotcue.name : 'Click to add label'}
                          </span>
                        )}
                      </div>
                    </>
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
        
        {/* Save Button - Directly beneath hotcue panel */}
        <div style={{ 
          width: '100%',
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
    </div>
  );
});
