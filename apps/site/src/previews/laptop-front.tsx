import { LaptopFront } from "@vectoys/laptop-front";
import { useState } from "react";
import { Segmented } from "../components/segmented";
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
      <Segmented label="Finish" options={FINISHES} value={finish} onChange={setFinish} />
    </div>
  );
};
