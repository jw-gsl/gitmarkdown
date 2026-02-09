import { Composition } from "remotion";
import { PromoVideo } from "./PromoVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="GitMarkdownPromo"
      component={PromoVideo}
      durationInFrames={715}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
