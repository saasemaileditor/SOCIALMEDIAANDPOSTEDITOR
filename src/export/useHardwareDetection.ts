import { useState, useEffect } from 'react';

export interface HardwareInfo {
  cpuCores: number;
  estimatedRAM: number;
  supportsHardwareAcceleration: boolean;
  recommendation: 'high' | 'medium' | 'low' | 'unsupported';
}

export const useHardwareDetection = (): HardwareInfo => {
  const [info, setInfo] = useState<HardwareInfo>({
    cpuCores: 0,
    estimatedRAM: 0,
    supportsHardwareAcceleration: false,
    recommendation: 'medium',
  });

  useEffect(() => {
    const detect = async () => {
      // CPU cores
      const cpuCores = navigator.hardwareConcurrency || 2;
      
      // Estimate RAM (not exact, but good enough)
      const estimatedRAM = (navigator as any).deviceMemory || 4;
      
      // Test WebCodecs support
      let supportsHardwareAcceleration = false;
      try {
        const config = {
          codec: 'avc1.42001E', // H.264 baseline
          width: 1280,
          height: 720,
          hardwareAcceleration: 'prefer-hardware',
        };
        // @ts-ignore
        const result = await (window as any).VideoEncoder?.isConfigSupported?.(config);
        supportsHardwareAcceleration = result?.supported || false;
      } catch {
        supportsHardwareAcceleration = false;
      }

      // Determine recommendation
      let recommendation: HardwareInfo['recommendation'] = 'medium';
      if (cpuCores < 4 || estimatedRAM < 4) {
        recommendation = 'low';
      } else if (cpuCores >= 8 && estimatedRAM >= 8 && supportsHardwareAcceleration) {
        recommendation = 'high';
      }

      setInfo({
        cpuCores,
        estimatedRAM,
        supportsHardwareAcceleration,
        recommendation,
      });
    };

    detect();
  }, []);

  return info;
};

export default useHardwareDetection;
