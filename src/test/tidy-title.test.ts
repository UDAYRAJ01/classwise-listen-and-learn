import { describe, expect, it } from "vitest";

import { tidyTitle } from "@/lib/text";

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
