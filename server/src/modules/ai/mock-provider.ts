import type { AiProvider, StructuredRequest } from "./ai.types.js";

/**
 * Deterministic, offline `AiProvider` for automated tests and local development
 * without a key. The handler decides what "the model" returns for a given
 * request; tests can also assert on the `StructuredRequest` it received.
 */
export class MockAiProvider implements AiProvider {
  readonly name = "mock";
  readonly model: string;

  constructor(
    private readonly handler: (request: StructuredRequest) => unknown,
    model = "mock-model",
  ) {
    this.model = model;
  }

  async generateStructured(request: StructuredRequest): Promise<unknown> {
    return this.handler(request);
  }
}
