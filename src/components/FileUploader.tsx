import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';

interface FileUploaderProps {
  onFile: (file: File) => void;
  accept?: string;
  label?: string;
  sublabel?: string;
}

export default function FileUploader({
  onFile,
  accept = '.xlsx,.xls,.csv',
  label = 'Arrastrá tu archivo Excel aquí',
  sublabel = 'o hacé clic para seleccionarlo',
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState<File | null>(null);

  const handleFile = (file: File) => {
    setLoaded(file);
    onFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clear = () => {
    setLoaded(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  if (loaded) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-xl p-5 flex items-center gap-4">
        <div className="bg-green-100 p-3 rounded-lg">
          <FileSpreadsheet size={24} className="text-green-700" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-900">{loaded.name}</div>
          <div className="text-sm text-gray-500">
            {(loaded.size / 1024).toFixed(1)} KB
          </div>
        </div>
        <button
          onClick={clear}
          className="p-1.5 hover:bg-green-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
        dragging
          ? 'border-[#003DA5] bg-blue-50'
          : 'border-gray-300 hover:border-[#003DA5] hover:bg-blue-50/30'
      }`}
    >
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />

      <div className="flex justify-center mb-4">
        <div className={`p-4 rounded-full ${dragging ? 'bg-blue-100' : 'bg-gray-100'}`}>
          <Upload size={32} className={dragging ? 'text-[#003DA5]' : 'text-gray-400'} />
        </div>
      </div>

      <p className="font-semibold text-gray-700 text-lg">{label}</p>
      <p className="text-gray-400 text-sm mt-1">{sublabel}</p>
      <p className="text-gray-400 text-xs mt-2">Formatos: .xlsx, .xls, .csv</p>
    </div>
  );
}
