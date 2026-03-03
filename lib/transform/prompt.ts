import { GeleColor } from "./types";

const COLOR_INSTRUCTION: Record<GeleColor, string> = {
  auto: "Choose a gele color that naturally complements the subject's skin tone and clothing.",
  red: "Use a rich red gele fabric.",
  blue: "Use a royal blue gele fabric.",
  gold: "Use an elegant gold gele fabric.",
  green: "Use a vibrant green gele fabric."
};

export function buildGelePrompt(stylePrompt: string, geleColor: GeleColor): string {
  const style = stylePrompt.trim() || "Classic Nigerian gele, elegant and clean folds.";

  return [
    "Edit this portrait photo.",
    "Add a realistic Nigerian gele head tie on the subject's head.",
    "Preserve identity: face shape, eyes, nose, lips, expression, skin texture.",
    "Align gele to head pose and hairline with accurate perspective.",
    "Match existing lighting and add natural shadows where fabric overlaps the forehead/hair.",
    "Keep the background and clothing unchanged unless naturally occluded by the gele.",
    "Photorealistic output only. No cartoon, painting, or stylized effects.",
    COLOR_INSTRUCTION[geleColor],
    `Style direction: ${style}`
  ].join(" ");
}
