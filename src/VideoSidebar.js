import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import axios from 'axios';

export const VideoSidebar = forwardRef(({ onVideoSelect, selectedVideoId }, ref) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { videoId, title }
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('http://localhost:3001/videos');
      setVideos(response.data);
      console.log('Fetched videos:', response.data);
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError(err.response?.data?.error || 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: fetchVideos
  }));

  const handleVideoClick = (video, e) => {
    // Don't trigger if clicking on delete button
    if (e && e.target.closest('.delete-button')) {
      return;
    }
    console.log('Video selected:', video);
    onVideoSelect(video);
  };

  const handleDeleteClick = (video, e) => {
    e.stopPropagation(); // Prevent video selection
    setDeleteConfirm({ videoId: video.videoId, title: video.title || 'Untitled Video' });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      console.log('Deleting video:', deleteConfirm.videoId);
      await axios.delete(`http://localhost:3001/videos/${deleteConfirm.videoId}`);
      console.log('Video deleted successfully');
      
      // Refresh the video list
      await fetchVideos();
      
      // Clear the confirmation
      setDeleteConfirm(null);
      
      // If the deleted video was selected, clear selection
      if (selectedVideoId === deleteConfirm.videoId && onVideoSelect) {
        onVideoSelect(null);
      }
    } catch (err) {
      console.error('Error deleting video:', err);
      alert(err.response?.data?.error || 'Failed to delete video. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  return (
    <div 
      className="video-sidebar"
      style={{
        width: isCollapsed ? '50px' : '300px',
        backgroundColor: '#f5f5f5',
        borderRight: '1px solid #ddd',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
        overflow: 'hidden'
      }}
    >
      {/* Header with collapse button */}
      <div 
        className="sidebar-header"
        style={{
          padding: '15px',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#fff'
        }}
      >
        {!isCollapsed && (
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
            Videos
          </h2>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            padding: '5px 10px',
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            minWidth: '30px'
          }}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </div>

      {/* Video list */}
      {!isCollapsed && (
        <div 
          className="video-list"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px'
          }}
        >
          {loading && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              Loading videos...
            </div>
          )}

          {error && (
            <div style={{ 
              padding: '15px', 
              backgroundColor: '#f8d7da', 
              color: '#721c24',
              borderRadius: '4px',
              marginBottom: '10px'
            }}>
              {error}
            </div>
          )}

          {!loading && !error && videos.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              No videos saved yet
            </div>
          )}

          {!loading && !error && videos.map((video) => (
            <div
              key={video.videoId}
              className={`video-item ${selectedVideoId === video.videoId ? 'video-item-selected' : ''}`}
              onClick={(e) => handleVideoClick(video, e)}
              style={{
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: selectedVideoId === video.videoId ? '#e7f3ff' : 'white',
                border: `2px solid ${selectedVideoId === video.videoId ? '#007bff' : '#ddd'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (selectedVideoId !== video.videoId) {
                  e.currentTarget.style.backgroundColor = '#f9f9f9';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedVideoId !== video.videoId) {
                  e.currentTarget.style.backgroundColor = 'white';
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                    {video.title || 'Untitled Video'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    {Object.keys(video.hotcues || {}).length} hotcue(s)
                  </div>
                </div>
                <button
                  className="delete-button"
                  onClick={(e) => handleDeleteClick(video, e)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '16px',
                    backgroundColor: 'transparent',
                    color: '#dc3545',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginLeft: '8px',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#ffe6e6';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                  }}
                  title="Delete video"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div 
          className="delete-modal-overlay"
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
          onClick={handleDeleteCancel}
        >
          <div 
            className="delete-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>
              Delete Video?
            </h3>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              Are you sure you want to delete <strong>"{deleteConfirm.title}"</strong>?
              <br/>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.6 : 1
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
