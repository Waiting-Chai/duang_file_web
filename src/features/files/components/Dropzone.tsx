import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
}

export default function Dropzone({ onFilesSelected }: DropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesSelected(acceptedFiles);
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div 
      {...getRootProps()} 
      className={`bg-gray-800 rounded-lg p-6 h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-600 hover:border-gray-500 transition-colors cursor-pointer ${
        isDragActive ? 'border-blue-500 bg-gray-700' : ''
      }`}>
      <input {...getInputProps()} />
      <UploadCloud className="w-16 h-16 text-gray-500 mb-4" />
      {
        isDragActive ?
          <p className="text-blue-400">Drop the files here ...</p> :
          <p className="text-gray-400">Drag & drop files here, or click to select</p>
      }
    </div>
  );
}