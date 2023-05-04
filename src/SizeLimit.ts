// @ts-ignore
import bytes from "bytes";

interface IResult {
  name: string;
  size: number;
  running?: number;
  loading?: number;
  total?: number;
}

const EmptyResult = {
  name: "-",
  size: 0,
  running: 0,
  loading: 0,
  total: 0,
};

class SizeLimit {
  static SIZE_RESULTS_HEADER = ["Path", "Size"];

  static TIME_RESULTS_HEADER = [
    "Path",
    "Size",
    "Loading time (3g)",
    "Running time (snapdragon)",
    "Total time",
  ];

  private formatBytes(size: number): string {
    return bytes.format(size, { unitSeparator: " " });
  }

  private formatTime(seconds: number): string {
    if (seconds >= 1) {
      return `${Math.ceil(seconds * 10) / 10} s`;
    }

    return `${Math.ceil(seconds * 1000)} ms`;
  }

  private formatChange(base: number = 0, current: number = 0, changeHighlightThreshold = 0): string {
    if (base === 0) {
      return "added 🆕";
    }

    if (current === 0) {
      return "removed 🚮";
    }

    const value = ((current - base) / base) * 100;
    const formatted =
      (Math.sign(value) * Math.ceil(Math.abs(value) * 100)) / 100;

    if (value > 0) {
      return value - changeHighlightThreshold > 0 ? `+${formatted}% 🔺` : `+${formatted}%`;
    }

    if (value === 0) {
      return `${formatted}%`;
    }

    return value + changeHighlightThreshold < 0 ? `${formatted}% 🔽` : `${formatted}%`;
  }

  private formatLine(value: string, change: string) {
    return `${value} (${change})`;
  }

  private formatSizeResult(
    name: string,
    base: IResult,
    current: IResult,
    changeHighlightThreshold: number,
  ): Array<string> {
    return [
      name,
      this.formatLine(
        this.formatBytes(current.size),
        this.formatChange(base.size, current.size, changeHighlightThreshold)
      ),
    ];
  }

  private formatTimeResult(
    name: string,
    base: IResult,
    current: IResult,
    changeHighlightThreshold: number,
  ): Array<string> {
    return [
      name,
      this.formatLine(
        this.formatBytes(current.size),
        this.formatChange(base.size, current.size, changeHighlightThreshold)
      ),
      this.formatLine(
        this.formatTime(current.loading),
        this.formatChange(base.loading, current.loading, changeHighlightThreshold)
      ),
      this.formatLine(
        this.formatTime(current.running),
        this.formatChange(base.running, current.running, changeHighlightThreshold)
      ),
      this.formatTime(current.total),
    ];
  }

  parseResults(output: string): { [name: string]: IResult } {
    const results = JSON.parse(output);

    return results.reduce(
      (current: { [name: string]: IResult }, result: any) => {
        let time = {};

        if (result.loading !== undefined && result.running !== undefined) {
          const loading = +result.loading;
          const running = +result.running;

          time = {
            running,
            loading,
            total: loading + running,
          };
        }

        return {
          ...current,
          [result.name]: {
            name: result.name,
            size: +result.size,
            ...time,
          },
        };
      },
      {}
    );
  }

  hasSizeChanges(
    base: { [name: string]: IResult },
    current: { [name: string]: IResult },
    threshold = 0
  ): boolean {
    const names = [
      ...new Set([...(base ? Object.keys(base) : []), ...Object.keys(current)]),
    ];
    const isSize = names.some(
      (name: string) => current[name] && current[name].total === undefined
    );

    // Always return true if time results are present
    if (!isSize) {
      return true;
    }

    return !!names.find((name: string) => {
      const baseResult = base?.[name] || EmptyResult;
      const currentResult = current[name] || EmptyResult;

      if (baseResult.size === 0 && currentResult.size === 0) {
        return true;
      }

      return (
        Math.abs((currentResult.size - baseResult.size) / baseResult.size) *
          100 >
        threshold
      );
    });
  }

  formatResults(
    base: { [name: string]: IResult },
    current: { [name: string]: IResult },
    changeHighlightThreshold: number = 0,
  ): Array<Array<string>> {
    const names = [
      ...new Set([...(base ? Object.keys(base) : []), ...Object.keys(current)]),
    ];
    const isSize = names.some(
      (name: string) => current[name] && current[name].total === undefined
    );
    const header = isSize
      ? SizeLimit.SIZE_RESULTS_HEADER
      : SizeLimit.TIME_RESULTS_HEADER;
    const fields = names.map((name: string) => {
      const baseResult = base?.[name] || EmptyResult;
      const currentResult = current[name] || EmptyResult;

      if (isSize) {
        return this.formatSizeResult(name, baseResult, currentResult, changeHighlightThreshold);
      }
      return this.formatTimeResult(name, baseResult, currentResult, changeHighlightThreshold);
    });

    return [header, ...fields];
  }
}
export default SizeLimit;
