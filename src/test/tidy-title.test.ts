import { describe, expect, it } from "vitest";

import { tidyHeading, tidyTitle } from "@/lib/text";

describe("chapter title capitals", () => {
  it("turns all-caps book titles into title case", () => {
    expect(tidyTitle("LAWS OF MOTION")).toBe("Laws of Motion");
    expect(tidyTitle("CONSTITUTION: WHY AND HOW?")).toBe("Constitution: Why and How?");
    expect(tidyTitle("INDIA – LOCATION")).toBe("India – Location");
    expect(tidyTitle("INDIAN ECONOMY 1950–1990")).toBe("Indian Economy 1950–1990");
  });

  it("fixes all-lowercase titles", () => {
    expect(tidyTitle("structure of atom")).toBe("Structure of Atom");
  });

  it("leaves mixed-case, roman numerals and Hindi titles alone", () => {
    expect(tidyTitle("The Living World")).toBe("The Living World");
    expect(tidyTitle("PART II")).toBe("Part II");
    expect(tidyTitle("दो बैलों की कथा")).toBe("दो बैलों की कथा");
  });
});

describe("NCERT section headings", () => {
  it("joins a capital the PDF split off and tidies the case", () => {
    expect(tidyHeading("DIMENSIONS OF PHYSICAL Q UANTITIES")).toBe("Dimensions of Physical Quantities");
    expect(tidyHeading("MOTION IN A PLANE")).toBe("Motion in a Plane");
    expect(tidyHeading("Rounding off the Uncertain Digits")).toBe("Rounding off the Uncertain Digits");
    expect(tidyHeading("KINEMATIC E U ATIONS FOR UNIFORMLY ACCELERATED MOTION")).toBe(
      "Kinematic Equations for Uniformly Accelerated Motion",
    );
    expect(tidyHeading("P OISSON ’ S R ATIO")).toBe("Poisson’s Ratio");
    expect(tidyHeading("S TRUCTURE OF P ROTEINS")).toBe("Structure of Proteins");
  });

  it("keeps possessives apart from the next word", () => {
    expect(tidyHeading("NEWTON’S FIRST LAW OF MOTION")).toBe("Newton’s First Law of Motion");
  });
});
