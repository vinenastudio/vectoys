import { DESK, Laptop, type LaptopLook } from "@vectoys/laptop";
import { useState } from "react";
import { Wallpaper } from "./wallpaper";

const LOOKS: readonly (readonly [LaptopLook, string])[] = [
  ["simple", "Simple"],
  ["realistic", "Realistic"],
];

export const LaptopPreview = () => {
  const [look, setLook] = useState<LaptopLook>("simple");
  return (
    <div className="preview-laptop">
      <Laptop closed={0.04} eye={DESK} look={look}>
        <Wallpaper />
      </Laptop>
      <div className="segmented" role="radiogroup" aria-label="Look">
        {LOOKS.map(([value, name]) => (
          <button key={value} type="button" role="radio" aria-checked={look === value} onClick={() => setLook(value)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
};
