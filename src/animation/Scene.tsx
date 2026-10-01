import { TypographyVortexCanvas } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";

export function Scene() {
  return (
    <div className="shader-frame">
      <TypographyVortexCanvas
        mode="dark"
        speed={1.00}
        ringGrowth={1.21}
        opacity={1.00}
        dissolveRadius={1.00}
        particleAmount={1.00}
        suctionDuration={920}
      />
    </div>
  );
}
