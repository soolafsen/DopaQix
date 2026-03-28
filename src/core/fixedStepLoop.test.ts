import { FixedStepLoop } from "./fixedStepLoop";

describe("FixedStepLoop", () => {
  it("runs fixed updates before rendering alpha", () => {
    const updates: number[] = [];
    const renders: number[] = [];
    const loop = new FixedStepLoop({
      stepMs: 10,
      update: (stepMs) => {
        updates.push(stepMs);
      },
      render: (alpha) => {
        renders.push(alpha);
      }
    });

    loop.advance(25);

    expect(updates).toEqual([10, 10]);
    expect(renders).toEqual([0.5]);
  });
});
