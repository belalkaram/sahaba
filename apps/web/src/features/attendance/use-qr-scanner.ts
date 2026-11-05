'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseQrScannerOptions {
  onScan: (decodedText: string) => void;
  enabled?: boolean;
  facingMode?: 'environment' | 'user';
  throttleMs?: number; // default 120ms (~8-10 fps)
  duplicateCooldownMs?: number; // default 3000ms (3 seconds)
}

export interface UseQrScannerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isScanning: boolean;
  hasCamera: boolean;
  hasTorch: boolean;
  isTorchOn: boolean;
  cameraFacing: 'environment' | 'user';
  error: string | null;
  engine: 'native' | 'zxing' | null;
  startScanner: () => Promise<void>;
  stopScanner: () => void;
  toggleTorch: () => Promise<void>;
  flipCamera: () => void;
}

export function useQrScanner({
  onScan,
  enabled = true,
  facingMode = 'environment',
  throttleMs = 120,
  duplicateCooldownMs = 3000,
}: UseQrScannerOptions): UseQrScannerReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>(facingMode);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<'native' | 'zxing' | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);

  const lastCodeRef = useRef<string | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Debounced scan handler (ignores exact duplicate within duplicateCooldownMs)
  const handleRawCode = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      const now = Date.now();
      if (lastCodeRef.current === trimmed && now - lastTimeRef.current < duplicateCooldownMs) {
        return;
      }

      lastCodeRef.current = trimmed;
      lastTimeRef.current = now;
      onScan(trimmed);
    },
    [duplicateCooldownMs, onScan]
  );

  // Stop camera stream & detectors
  const stopScanner = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {
        // Ignored
      }
      zxingControlsRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
    setIsTorchOn(false);
  }, []);

  // Start camera stream & appropriate detector (BarcodeDetector or ZXing fallback)
  const startScanner = useCallback(async () => {
    stopScanner();
    setError(null);

    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      setHasCamera(false);
      setError('الكاميرا غير مدعومة على هذا المتصفح أو تتطلب اتصالاً آمناً (HTTPS).');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: cameraFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setIsScanning(true);
      setHasCamera(true);

      // Check torch capability
      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities
        ? (track.getCapabilities() as { torch?: boolean })
        : undefined;
      setHasTorch(Boolean(capabilities?.torch));

      // 1. Native BarcodeDetector (Chrome / Edge / Android)
      const hasNativeDetector =
        typeof window !== 'undefined' &&
        'BarcodeDetector' in window &&
        typeof (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector === 'function';

      if (hasNativeDetector) {
        setEngine('native');
        const BarcodeDetectorClass = (
          window as unknown as {
            BarcodeDetector: new (opts: { formats: string[] }) => {
              detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
            };
          }
        ).BarcodeDetector;

        const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });

        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              handleRawCode(barcodes[0].rawValue);
            }
          } catch {
            // Frame skip
          }
        }, throttleMs);
      } else {
        // 2. OD-29 Fallback: Lazy load @zxing/browser (iOS Safari, Firefox)
        setEngine('zxing');
        try {
          const { BrowserQRCodeReader } = await import('@zxing/browser');
          const reader = new BrowserQRCodeReader();

          if (videoRef.current) {
            const controls = await reader.decodeFromVideoElement(
              videoRef.current,
              (result, _error, innerControls) => {
                if (result) {
                  const text = result.getText();
                  if (text) {
                    handleRawCode(text);
                  }
                }
                if (innerControls && !zxingControlsRef.current) {
                  zxingControlsRef.current = innerControls;
                }
              }
            );
            zxingControlsRef.current = controls;
          }
        } catch (zxingErr: unknown) {
          setError(
            zxingErr instanceof Error
              ? zxingErr.message
              : 'فشل تحميل مكتبة مسح رمز الـ QR البديلة.'
          );
        }
      }
    } catch (err: unknown) {
      setIsScanning(false);
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('تم رفض إذن الوصول إلى الكاميرا. يرجى السماح بالوصول من إعدادات المتصفح.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setHasCamera(false);
        setError('لم يتم العثور على كاميرا في هذا الجهاز.');
      } else {
        setError('تعذر تشغيل الكاميرا. يرجى التحقق من الأذونات وإعادة المحاولة.');
      }
    }
  }, [cameraFacing, handleRawCode, stopScanner, throttleMs]);

  // Flip camera (environment <-> user)
  const flipCamera = useCallback(() => {
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  // Toggle Torch / Flashlight
  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !isTorchOn;
      const trackWithTorch = track as MediaStreamTrack & {
        applyConstraints: (c: unknown) => Promise<void>;
      };
      await trackWithTorch.applyConstraints({
        advanced: [{ torch: next }],
      });
      setIsTorchOn(next);
    } catch {
      // Ignored
    }
  }, [isTorchOn]);

  // Manage visibility change (pause video tracks when app is in background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => (t.enabled = false));
        }
      } else if (document.visibilityState === 'visible') {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => (t.enabled = true));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Cleanup on unmount or facingMode change
  useEffect(() => {
    if (enabled) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [enabled, cameraFacing, startScanner, stopScanner]);

  return {
    videoRef,
    isScanning,
    hasCamera,
    hasTorch,
    isTorchOn,
    cameraFacing,
    error,
    engine,
    startScanner,
    stopScanner,
    toggleTorch,
    flipCamera,
  };
}
