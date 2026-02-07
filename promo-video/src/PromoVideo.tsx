import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { SceneHero } from "./scenes/SceneHero";
import { SceneEditor } from "./scenes/SceneEditor";
import { SceneGitSync } from "./scenes/SceneGitSync";
import { SceneCollaborate } from "./scenes/SceneCollaborate";
import { SceneAI } from "./scenes/SceneAI";
import { SceneCTA } from "./scenes/SceneCTA";

const T = 15; // transition duration in frames

export const PromoVideo: React.FC = () => {
  return (
    <TransitionSeries>
      {/* Scene 1: Hero / Logo reveal (0-3.5s = 105 frames) */}
      <TransitionSeries.Sequence durationInFrames={105}>
        <SceneHero />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: T })}
      />

      {/* Scene 2: Editor typing demo (3.5-7.5s = 120 frames) */}
      <TransitionSeries.Sequence durationInFrames={120}>
        <SceneEditor />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />

      {/* Scene 3: Git sync (7.5-11s = 105 frames) */}
      <TransitionSeries.Sequence durationInFrames={105}>
        <SceneGitSync />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-bottom" })}
        timing={linearTiming({ durationInFrames: T })}
      />

      {/* Scene 4: Real-time collaboration (11-14.5s = 105 frames) */}
      <TransitionSeries.Sequence durationInFrames={105}>
        <SceneCollaborate />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: T })}
      />

      {/* Scene 5: AI features (14.5-17.5s = 90 frames) */}
      <TransitionSeries.Sequence durationInFrames={90}>
        <SceneAI />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: T })}
      />

      {/* Scene 6: CTA / Logo (17.5-20s = 75 frames) */}
      <TransitionSeries.Sequence durationInFrames={75}>
        <SceneCTA />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
