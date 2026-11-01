import { LaptopFront } from "@vectoys/laptop-front";
import { useState } from "react";
import { Wallpaper } from "./wallpaper";

const FINISHES = [
  ["silver", "Silver"],
  ["black", "Space black"],
] as const;

export const LaptopFrontPreview = () => {
  const [finish, setFinish] = useState<(typeof FINISHES)[number][0]>("silver");
  return (
    <div className="preview-laptop-front">
      <LaptopFront finish={finish}>
        <Wallpaper />
      </LaptopFront>
      <div className="segmented" role="radiogroup" aria-label="Finish">
        {FINISHES.map(([value, name]) => (
          <button key={value} type="button" role="radio" aria-checked={finish === value} onClick={() => setFinish(value)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
};
