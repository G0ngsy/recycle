import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, X, ChevronRight } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import { preparePhoto } from '../services/photo';

export default function ImageScan() {
  const navigate = useNavigate();
  const [image, setImage] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const uploadRequestRef = useRef(0);

  useEffect(() => () => {
    cameraRequestRef.current += 1;
    uploadRequestRef.current += 1;
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const startCamera = async () => {
    const request = ++cameraRequestRef.current;
    setError('');
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (request !== cameraRequestRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      if (request !== cameraRequestRef.current) return;
      setError('카메라에 접근할 수 없어요. 사진을 업로드해주세요.');
      setCameraOpen(false);
    }
  };

  const stopCamera = () => {
    cameraRequestRef.current += 1;
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const request = ++uploadRequestRef.current;
    setImage(null);
    setError('');
    setProcessing(true);
    try {
      const photo = await preparePhoto(file);
      if (request === uploadRequestRef.current) setImage(photo);
    } catch (error) {
      if (request === uploadRequestRef.current) {
        setError(error instanceof Error ? error.message : '사진을 읽지 못했습니다. 다른 사진을 선택해주세요.');
      }
    } finally {
      if (request === uploadRequestRef.current) setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="사진으로 확인" subtitle="물체 하나를 화면 중앙에 담아 촬영하거나 업로드해주세요" />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {processing && <p role="status" className="text-sm text-slate-600">사진을 준비하고 있어요…</p>}

      {cameraOpen ? (
        <div className="relative rounded-2xl overflow-hidden bg-black">
          <video ref={node => { videoRef.current = node; if (node && streamRef.current) node.srcObject = streamRef.current; }} autoPlay playsInline className="w-full" />
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-6">
            <button aria-label="카메라 닫기" onClick={stopCamera} className="bg-white/20 text-white rounded-full p-3 backdrop-blur-sm">
              <X size={24} />
            </button>
            <button aria-label="사진 촬영" onClick={capture} className="bg-white rounded-full w-16 h-16 border-4 border-emerald-400" />
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
                aria-label="선택한 사진 삭제"
                onClick={() => setImage(null)}
                className="absolute top-2 right-2 flex h-11 w-11 items-center justify-center bg-white rounded-full shadow"
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
            <Button variant="secondary" fullWidth disabled={processing} icon={<Camera size={20} />} onClick={startCamera}>
              사진 찍기
            </Button>
            <Button variant="secondary" fullWidth icon={<Upload size={20} />} onClick={() => fileInputRef.current?.click()}>
              업로드
            </Button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFileUpload} />
          </div>

          <Button
            fullWidth
            disabled={!image || processing}
            icon={<ChevronRight size={20} />}
            onClick={() => navigate('/confirm', { state: { image, inputKind: 'image' } })}
          >
            사진 분석하기
          </Button>
        </>
      )}
    </div>
  );
}
