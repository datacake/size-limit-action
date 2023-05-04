import SizeLimit from "./SizeLimit";

describe("SizeLimit", () => {
  test("should parse size-limit output", () => {
    const limit = new SizeLimit();
    const output = JSON.stringify([
      {
        name: "dist/index.js",
        passed: true,
        size: "110894",
        running: "0.10210999999999999",
        loading: "2.1658984375",
      },
    ]);

    expect(limit.parseResults(output)).toEqual({
      "dist/index.js": {
        name: "dist/index.js",
        loading: 2.1658984375,
        running: 0.10210999999999999,
        size: 110894,
        total: 2.2680084375000003,
      },
    });
  });

  test("should parse size-limit without times output", () => {
    const limit = new SizeLimit();
    const output = JSON.stringify([
      {
        name: "dist/index.js",
        passed: true,
        size: "110894",
      },
    ]);

    expect(limit.parseResults(output)).toEqual({
      "dist/index.js": {
        name: "dist/index.js",
        size: 110894,
      },
    });
  });

  test("should format size-limit results", () => {
    const limit = new SizeLimit();
    const base = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 110894,
        running: 0.10210999999999999,
        loading: 2.1658984375,
        total: 2.2680084375000003,
      },
    };
    const current = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 100894,
        running: 0.20210999999999999,
        loading: 2.5658984375,
        total: 2.7680084375000003,
      },
    };

    expect(limit.formatResults(base, current)).toEqual([
      SizeLimit.TIME_RESULTS_HEADER,
      [
        "dist/index.js",
        "98.53 KB (-9.02% 🔽)",
        "2.6 s (+18.47% 🔺)",
        "203 ms (+97.94% 🔺)",
        "2.8 s",
      ],
    ]);
  });

  test("should format size-limit without times results", () => {
    const limit = new SizeLimit();
    const base = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 110894,
      },
    };
    const current = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 100894,
      },
    };

    expect(limit.formatResults(base, current)).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      ["dist/index.js", "98.53 KB (-9.02% 🔽)"],
    ]);
  });

  test("should format size-limit with new section", () => {
    const limit = new SizeLimit();
    const base = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 110894,
      },
    };
    const current = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 100894,
      },
      "dist/new.js": {
        name: "dist/new.js",
        size: 100894,
      },
    };

    expect(limit.formatResults(base, current)).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      ["dist/index.js", "98.53 KB (-9.02% 🔽)"],
      ["dist/new.js", "98.53 KB (added 🆕)"],
    ]);
  });

  test("should format size-limit with deleted section", () => {
    const limit = new SizeLimit();
    const base = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 110894,
      },
    };
    const current = {
      "dist/new.js": {
        name: "dist/new.js",
        size: 100894,
      },
    };

    expect(limit.formatResults(base, current)).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      ["dist/index.js", "0 B (removed 🚮)"],
      ["dist/new.js", "98.53 KB (added 🆕)"],
    ]);
  });

  test("should format size-limit with change emojis only if change highlight threshold surpassed", () => {
    const limit = new SizeLimit();
    const base = {
      "dist/around-same-size.js": {
        name: "dist/around-same-size.js",
        size: 110894,
      },
      "dist/much-bigger.js": {
        name: "dist/much-bigger.js",
        size: 133742,
      },
      "dist/slightly-smaller.js": {
        name: "dist/slightly-smaller.js",
        size: 1402,
      },
    };
    const current = {
      "dist/around-same-size.js": {
        name: "dist/around-same-size.js",
        size: 110642,
      },
      "dist/much-bigger.js": {
        name: "dist/much-bigger.js",
        size: 153293,
      },
      "dist/slightly-smaller.js": {
        name: "dist/slightly-smaller.js",
        size: 1374,
      },
    };

    expect(limit.formatResults(base, current, 2)).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      [
        "dist/around-same-size.js",
        "108.05 KB (-0.23%)",
      ],
      [
        "dist/much-bigger.js",
        "149.7 KB (+14.62% 🔺)",
      ],
      [
        "dist/slightly-smaller.js",
        "1.34 KB (-2%)",
      ],
    ]);
  });

  test("has size changes", () => {
    const limit = new SizeLimit();
    const base = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 110894,
      },
    };
    const current = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 100894,
      },
    };

    expect(limit.hasSizeChanges(base, current, 0)).toBe(true);
  });

  test("does not have size changes if sizes are the same", () => {
    const limit = new SizeLimit();
    const base = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 110894,
      },
    };
    const current = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 110894,
      },
    };

    expect(limit.hasSizeChanges(base, current, 0)).toBe(false);
  });

  test("always has size changes with times results", () => {
    const limit = new SizeLimit();
    const base = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 110894,
        running: 0.10210999999999999,
        loading: 2.1658984375,
        total: 2.2680084375000003,
      },
    };
    const current = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 110894,
        running: 0.10210999999999999,
        loading: 2.1658984375,
        total: 2.2680084375000003,
      },
    };

    expect(limit.hasSizeChanges(base, current, 0)).toBe(true);
  });
});
