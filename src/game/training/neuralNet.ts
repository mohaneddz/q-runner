export interface MLPWeights {
  /** [hidden][input] */
  wIH: number[][];
  bH: number[];
  /** [output][hidden] */
  wHO: number[][];
  bO: number[];
}

function randomWeight(fanIn: number): number {
  // Small random init scaled by fan-in — keeps early activations from
  // saturating before the net has learned anything.
  return (Math.random() * 2 - 1) / Math.sqrt(fanIn);
}

function buildWeights(inputSize: number, hiddenSize: number, outputSize: number): MLPWeights {
  return {
    wIH: Array.from({ length: hiddenSize }, () =>
      Array.from({ length: inputSize }, () => randomWeight(inputSize)),
    ),
    bH: Array.from({ length: hiddenSize }, () => 0),
    wHO: Array.from({ length: outputSize }, () =>
      Array.from({ length: hiddenSize }, () => randomWeight(hiddenSize)),
    ),
    bO: Array.from({ length: outputSize }, () => 0),
  };
}

function cloneWeights(weights: MLPWeights): MLPWeights {
  return {
    wIH: weights.wIH.map((row) => [...row]),
    bH: [...weights.bH],
    wHO: weights.wHO.map((row) => [...row]),
    bO: [...weights.bO],
  };
}

function dot(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function relu(value: number): number {
  return value > 0 ? value : 0;
}

/**
 * A single-hidden-layer MLP with plain-array forward/backward passes — no
 * autodiff or tensor library. The observation space here is a handful of
 * scaled scalars and two actions, so this is plenty of capacity without
 * pulling in a dependency the rest of this hand-built engine doesn't need.
 */
export class MLP {
  private weights: MLPWeights;

  constructor(
    private readonly inputSize: number,
    private readonly hiddenSize: number,
    private readonly outputSize: number,
    weights?: MLPWeights,
  ) {
    this.weights = weights ? cloneWeights(weights) : buildWeights(inputSize, hiddenSize, outputSize);
  }

  predict(input: readonly number[]): number[] {
    return this.forward(input).output;
  }

  private forward(input: readonly number[]): { hiddenPre: number[]; hidden: number[]; output: number[] } {
    const hiddenPre = this.weights.wIH.map((row, h) => dot(row, input) + this.weights.bH[h]);
    const hidden = hiddenPre.map(relu);
    const output = this.weights.wHO.map((row, o) => dot(row, hidden) + this.weights.bO[o]);
    return { hiddenPre, hidden, output };
  }

  /**
   * Averages gradients over the whole batch before applying a single update —
   * plain per-sample SGD here was noisy enough (each of a minibatch's samples
   * updating the weights the next sample trains against) to destabilize
   * training against a small, fast-moving replay buffer.
   *
   * Each sample only has a target for the action actually taken; the other
   * output gets zero gradient, matching the standard DQN loss.
   */
  trainBatch(
    samples: readonly { input: readonly number[]; actionIndex: number; targetValue: number }[],
    learningRate: number,
  ): void {
    if (samples.length === 0) {
      return;
    }

    const gradWIH = this.weights.wIH.map((row) => row.map(() => 0));
    const gradBH = this.weights.bH.map(() => 0);
    const gradWHO = this.weights.wHO.map((row) => row.map(() => 0));
    const gradBO = this.weights.bO.map(() => 0);

    for (const { input, actionIndex, targetValue } of samples) {
      const { hiddenPre, hidden, output } = this.forward(input);
      const outputError = output[actionIndex] - targetValue;

      for (let h = 0; h < this.hiddenSize; h++) {
        gradWHO[actionIndex][h] += outputError * hidden[h];
      }
      gradBO[actionIndex] += outputError;

      for (let h = 0; h < this.hiddenSize; h++) {
        if (hiddenPre[h] <= 0) {
          continue; // dead ReLU unit — zero gradient
        }
        const hiddenError = outputError * this.weights.wHO[actionIndex][h];
        for (let i = 0; i < this.inputSize; i++) {
          gradWIH[h][i] += hiddenError * input[i];
        }
        gradBH[h] += hiddenError;
      }
    }

    const scale = learningRate / samples.length;
    for (let h = 0; h < this.hiddenSize; h++) {
      for (let i = 0; i < this.inputSize; i++) {
        this.weights.wIH[h][i] -= scale * gradWIH[h][i];
      }
      this.weights.bH[h] -= scale * gradBH[h];
    }
    for (let o = 0; o < this.outputSize; o++) {
      for (let h = 0; h < this.hiddenSize; h++) {
        this.weights.wHO[o][h] -= scale * gradWHO[o][h];
      }
      this.weights.bO[o] -= scale * gradBO[o];
    }
  }

  clone(): MLP {
    return new MLP(this.inputSize, this.hiddenSize, this.outputSize, this.weights);
  }

  getWeights(): MLPWeights {
    return cloneWeights(this.weights);
  }

  setWeights(weights: MLPWeights): void {
    this.weights = cloneWeights(weights);
  }
}
