interface ExportProgressProps {
  progress: number;
  estimatedTime: string;
  onCancel: () => void;
}

export const ExportProgress = ({ progress, estimatedTime, onCancel }: ExportProgressProps) => {
  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Exporting Video...</h2>
        <span className="text-purple-400">{progress}%</span>
      </div>
      
      {/* Progress bar */}
      <div className="w-full bg-gray-700 rounded-full h-4 mb-4">
        <div 
          className="bg-purple-600 h-4 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Time estimate */}
      {estimatedTime && (
        <p className="text-gray-400 text-sm mb-4">{estimatedTime}</p>
      )}
      
      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="w-full py-3 bg-red-600/20 text-red-400 border border-red-600 rounded-lg hover:bg-red-600/30"
      >
        Cancel Export
      </button>
    </div>
  );
};
