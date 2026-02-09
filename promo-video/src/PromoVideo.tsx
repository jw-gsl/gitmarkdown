import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { SceneHero } from "./scenes/SceneHero";
import { SceneEditor } from "./scenes/SceneEditor";
import { SceneFileTree } from "./scenes/SceneFileTree";
import { SceneGitSync } from "./scenes/SceneGitSync";
import { ScenePR } from "./scenes/ScenePR";
import { SceneCollaborate } from "./scenes/SceneCollaborate";
import { SceneAI } from "./scenes/SceneAI";
import { SceneWritingChecks } from "./scenes/SceneWritingChecks";
import { SceneCTA } from "./scenes/SceneCTA";

const T = 15; // transition duration in frames

export const PromoVideo: React.FC = () => {
  return (
    <TransitionSeries>
      {/* Scene 1: Hero / Logo reveal */}
      <TransitionSeries.Sequence durationInFrames={90}>
        <SceneHero />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: T })}
      />

      {/* Scene 2: Rich editor with slash commands */}
      <TransitionSeries.Sequence durationInFrames={110}>
        <SceneEditor />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />

      {/* Scene 3: File tree & code viewer */}
      <TransitionSeries.Sequence durationInFrames={95}>
        <SceneFileTree />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: T })}
      />

      {/* Scene 4: GitHub sync */}
      <TransitionSeries.Sequence durationInFrames={95}>
        <SceneGitSync />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-bottom" })}
        timing={linearTiming({ durationInFrames: T })}
      />

      {/* Scene 5: Pull request creation */}
      <TransitionSeries.Sequence durationInFrames={85}>
        <ScenePR />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: T })}
      />

      {/* Scene 6: Real-time collaboration */}
      <TransitionSeries.Sequence durationInFrames={85}>
        <SceneCollaborate />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: T })}
      />

      {/* Scene 7: AI features with personas */}
      <TransitionSeries.Sequence durationInFrames={105}>
        <SceneAI />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />

      {/* Scene 8: Writing checks */}
      <TransitionSeries.Sequence durationInFrames={90}>
        <SceneWritingChecks />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: T })}
      />

      {/* Scene 9: CTA / Close */}
      <TransitionSeries.Sequence durationInFrames={80}>
        <SceneCTA />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
