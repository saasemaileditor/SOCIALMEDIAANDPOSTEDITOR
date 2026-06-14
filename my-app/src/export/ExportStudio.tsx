import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { renderMediaOnWeb } from '@remotion/web-renderer';
import { useEditorStore } from '../store/useEditorStore';
import { useHardwareDetection } from './useHardwareDetection';
import { ExportProgress } from './ExportProgress';
import { VideoComposition } from '../remotion/VideoComposition';

type ExportQuality = 'draft' | 'high' | 'ultra';

interface ExportSettings {
  quality: ExportQuality;
  resolution: '720p' | '1080p' | '4K';
  fps: 30 | 60;
}

export const ExportStudio = () => {
  const navigate = useNavigate();
  const { elements } = useEditorStore();
  const hardware = useHardwareDetection();
  
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState<string>('');
  const [settings, setSettings] = useState<ExportSettings>({
    quality: hardware.recommendation === 'low' ? 'draft' : 'high',
    resolution: hardware.recommendation === 'low' ? '720p' : '1080p',
    fps: 30,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);



  const handleExport = useCallback(async () => {
    if (Object.keys(elements).length === 0) {
      alert('Add some elements first!');
      return;
    }

    // Check if too many elements
    if (Object.keys(elements).length > 1000 && hardware.recommendation === 'low') {
      const proceed = window.confirm(
        'You have many elements and a low-end device. ' +
        'Export may crash. Consider reducing elements or using Draft quality. ' +
        'Proceed anyway?'
      );
      if (!proceed) return;
    }

    // Auto-adjust for low-end devices
    let actualSettings = { ...settings };
    
    if (hardware.recommendation === 'low') {
      actualSettings = {
        quality: 'draft',
        resolution: '720p',
        fps: 30,
      };
      console.log('Low-end device detected. Using conservative settings.');
    }

    setIsExporting(true);
    setProgress(0);
    
    abortControllerRef.current = new AbortController();

    try {
      const startTime = Date.now();
      
      const { getBlob } = await renderMediaOnWeb({
        composition: {
          id: 'CliplyVideo',
          component: VideoComposition,
          width: actualSettings.resolution === '4K' ? 3840 : actualSettings.resolution === '1080p' ? 1920 : 1280,
          height: actualSettings.resolution === '4K' ? 2160 : actualSettings.resolution === '1080p' ? 1080 : 720,
          fps: actualSettings.fps,
          durationInFrames: 300, // 10 seconds
        },
        signal: abortControllerRef.current.signal,
        onProgress: ({ progress: p }) => {
          setProgress(Math.round(p * 100));
          
          // Calculate estimated time remaining
          const elapsed = Date.now() - startTime;
          const total = elapsed / p;
          const remaining = total - elapsed;
          const seconds = Math.ceil(remaining / 1000);
          setEstimatedTime(`${seconds}s remaining`);
        },
      });

      const blob = await getBlob();
      
      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cliply-export-${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
      
    } catch (error) {
      if (abortControllerRef.current?.signal.aborted) {
        console.log('Export cancelled by user');
      } else {
        console.error('Export failed:', error);
        alert('Export failed. Try lowering quality settings.');
      }
    } finally {
      setIsExporting(false);
      setProgress(0);
      setEstimatedTime('');
    }
  }, [elements, settings, hardware]);

  const handleCancel = () => {
    abortControllerRef.current?.abort();
  };

  const handleBackToEditor = () => {
    navigate('/editor');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Export Studio</h1>
          <button
            onClick={handleBackToEditor}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
          >
            ← Back to Editor
          </button>
        </div>

        {/* Hardware Warning */}
        {hardware.recommendation === 'low' && (
          <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-4 mb-6">
            <p className="text-yellow-200">
              ⚠️ Your device has limited resources. Export may be slow. 
              Use "Draft" quality for best results.
            </p>
          </div>
        )}

        {/* Preview */}
        <div className="bg-black rounded-lg overflow-hidden mb-6 aspect-video">
          <p className="text-center text-gray-500 pt-20">
            Preview: {Object.keys(elements).length} elements
          </p>
        </div>

        {/* Settings */}
        {!isExporting && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Export Settings</h2>
            
            {/* Quality */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Quality</label>
              <select
                value={settings.quality}
                onChange={(e) => setSettings({ ...settings, quality: e.target.value as ExportQuality })}
                className="w-full bg-gray-700 rounded px-3 py-2"
              >
                <option value="draft">Draft (Fast, smaller file)</option>
                <option value="high">High (Recommended)</option>
                <option value="ultra">Ultra (Slow, best quality)</option>
              </select>
            </div>

            {/* Resolution */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Resolution</label>
              <select
                value={settings.resolution}
                onChange={(e) => setSettings({ ...settings, resolution: e.target.value as ExportSettings['resolution'] })}
                className="w-full bg-gray-700 rounded px-3 py-2"
              >
                <option value="720p">720p (HD)</option>
                <option value="1080p">1080p (Full HD)</option>
                <option value="4K">4K (Ultra HD)</option>
              </select>
            </div>

            {/* FPS */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Frame Rate</label>
              <select
                value={settings.fps}
                onChange={(e) => setSettings({ ...settings, fps: Number(e.target.value) as 30 | 60 })}
                className="w-full bg-gray-700 rounded px-3 py-2"
              >
                <option value={30}>30 fps</option>
                <option value={60}>60 fps (Smoother)</option>
              </select>
            </div>
          </div>
        )}

        {/* Progress */}
        {isExporting && (
          <ExportProgress 
            progress={progress} 
            estimatedTime={estimatedTime}
            onCancel={handleCancel}
          />
        )}

        {/* Export Button */}
        {!isExporting && (
          <button
            onClick={handleExport}
            disabled={Object.keys(elements).length === 0}
            className="w-full py-4 bg-purple-600 rounded-lg font-semibold text-lg hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {Object.keys(elements).length === 0 ? 'Add elements to export' : 'Start Export'}
          </button>
        )}
      </div>
    </div>
  );
};
