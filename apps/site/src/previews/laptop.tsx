import { DESK, Laptop, type LaptopLook } from "@vectoys/laptop";
import { useState } from "react";
import { Segmented } from "../components/segmented";
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
      <Segmented label="Look" options={LOOKS} value={look} onChange={setLook} />
    </div>
  );
};
