/** One user-facing action. Every use case exposes a single `execute` method. */
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}
