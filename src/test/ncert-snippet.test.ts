import { describe, expect, it } from "vitest";

import { ncertSnippet } from "../../scripts/exam/ncert-snippet";

const physics = `3.9 PROJECTILE MOTION
Example 3.6 Galileo, in his book Two new sciences, stated that
Example 3.7 A hiker stands on the edge of a cliff 490 m above the ground
EXERCISES
3.1 State, for each of the following physical quantities, if it is a scalar or a vector :
3.12 The ceiling of a long hall is 25 m high.
3.13 A cricketer can throw a ball to a maximum horizontal distance of 100 m.`;

const maths = `Example 3 Solve 4x + 3 < 6x +7.
 EXERCISE 5.1
 1. Solve 24x < 100, when
 5. –12x > 30 6. 3x – 7 > 5x – 1
 Miscellaneous Exercise on Chapter 5
 1. 2 ≤ 3x – 4 ≤ 5 2. 6 ≤ –3 (2x – 4) < 12`;

describe("finding NCERT examples and exercises in the book text", () => {
  it("finds a worked example by its number, not a longer one", () => {
    expect(ncertSnippet(physics, "example", "3.6")).toMatch(/^Example 3\.6 Galileo/);
    expect(ncertSnippet(physics, "example", "3.67")).toBeNull();
  });

  it("finds physics-style exercise questions after the EXERCISES heading", () => {
    expect(ncertSnippet(physics, "exercise", "3.12")).toMatch(/^3\.12 The ceiling/);
    expect(ncertSnippet(physics, "exercise", "3.1")).toMatch(/^3\.1 State/);
  });

  it("finds maths exercise questions printed two to a line, and miscellaneous ones", () => {
    expect(ncertSnippet(maths, "exercise", "5.1 Q6")).toMatch(/^6\. 3x – 7/);
    expect(ncertSnippet(maths, "exercise", "Misc 2")).toMatch(/^2\. 6 ≤/);
  });

  it("reads chemistry books: worked examples are called Problem, exercises follow an Exercises heading", () => {
    const chemistry = [
      "5.1 Thermodynamic terms the system from the surroundings is called",
      "Intext Questions",
      "5.1 Write the general outer electronic configuration.",
      "Problem 5.1",
      "Express the change in internal energy of a system when no heat is absorbed.",
      " Exercises",
      "",
      " 5.1 Choose the correct answer. A thermodynamic state function is a quantity",
      " 5.2 For the process to occur under adiabatic conditions, the correct condition is:",
    ].join("\n");
    expect(ncertSnippet(chemistry, "example", "5.1")).toMatch(/^Problem 5\.1\nExpress/);
    expect(ncertSnippet(chemistry, "exercise", "5.1")).toMatch(/^5\.1 Choose the correct answer/);
  });

  it("gives nothing when the place is not in the text", () => {
    expect(ncertSnippet(maths, "exercise", "5.2 Q1")).toBeNull();
    expect(ncertSnippet(physics, "section", "3.9")).toBeNull();
  });
});
