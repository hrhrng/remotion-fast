import { Composition } from 'remotion';
import { VideoComposition } from '@remotion-fast/remotion-components';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoEditor"
        component={VideoComposition}
        durationInFrames={1500}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          tracks: [
            {
              id: 'track-1',
              name: 'Track 1',
              items: [
                {
                  id: 'text-1',
                  type: 'text',
                  text: 'Hello Remotion!',
                  color: '#000000',
                  from: 0,
                  durationInFrames: 90,
                  fontSize: 80,
                },
              ],
            },
            {
              id: 'track-2',
              name: 'Track 2',
              items: [
                {
                  id: 'solid-1',
                  type: 'solid',
                  color: '#4CAF50',
                  from: 30,
                  durationInFrames: 60,
                },
              ],
            },
          ],
        }}
      />
    </>
  );
};
