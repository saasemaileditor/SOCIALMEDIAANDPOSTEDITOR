import { Composition } from 'remotion';
import { VideoComposition } from './VideoComposition';

export const RemotionRoot = () => {
  return (
    <Composition
      id="CliplyVideo"
      component={VideoComposition}
      durationInFrames={300} // 10 seconds at 30fps
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
