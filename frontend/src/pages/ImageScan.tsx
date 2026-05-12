import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, X, ChevronRight } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';

export default function ImageScan() {
  const navigate = useNavigate();
  const [image, setImage] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      alert('카메라에 접근할 수 없어요.');
      setCameraOpen(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    setImage(canvas.toDataURL('image/jpeg', 0.8));
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="이미지 스캔" subtitle="분리수거할 물건을 촬영하거나 업로드해주세요" />

      {cameraOpen ? (
        <div className="relative rounded-2xl overflow-hidden bg-black">
          <video ref={videoRef} autoPlay playsInline className="w-full" />
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-6">
            <button onClick={stopCamera} className="bg-white/20 text-white rounded-full p-3 backdrop-blur-sm">
              <X size={24} />
            </button>
            <button onClick={capture} className="bg-white rounded-full w-16 h-16 border-4 border-emerald-400" />
          </div>
        </div>
      ) : (
        <div
          className={`relative rounded-2xl border-2 border-dashed flex items-center justify-center min-h-56 transition-colors ${
            image ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-100'
          }`}
        >
          {image ? (
            <>
              <img src={image} alt="선택된 이미지" className="max-h-64 rounded-xl object-contain" />
              <button
                onClick={() => setImage(null)}
                className="absolute top-2 right-2 bg-white rounded-full p-1 shadow"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </>
          ) : (
            <p className="text-slate-400 text-sm">이미지를 선택해주세요</p>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {!cameraOpen && (
        <>
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth icon={<Camera size={20} />} onClick={startCamera}>
              사진 찍기
            </Button>
            <Button variant="secondary" fullWidth icon={<Upload size={20} />} onClick={() => fileInputRef.current?.click()}>
              업로드
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </div>

          <Button
            fullWidth
            disabled={!image}
            icon={<ChevronRight size={20} />}
            onClick={() => navigate('/region', { state: { image } })}
          >
            다음
          </Button>
        </>
      )}
    </div>
  );
}
