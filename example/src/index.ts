/**
 * Example library for testing typedoc-plugin-llms-txt
 *
 * This module exports various types of declarations to test URL generation
 * across different TypeDoc router configurations.
 *
 * @packageDocumentation
 */

/**
 * Configuration options for the greeter
 */
export interface GreeterOptions {
  /**
   * The greeting prefix to use
   *
   * @default 'Hello'
   */
  prefix?: string;

  /**
   * Whether to use exclamation marks
   *
   * @default true
   */
  excited?: boolean;
}

/**
 * A simple greeter class
 *
 * @example
 *
 * ```ts
 * const greeter = new Greeter({ prefix: 'Hi' });
 * console.log(greeter.greet('World')); // "Hi, World!"
 * ```
 */
export class Greeter {
  private readonly options: Required<GreeterOptions>;

  /**
   * Creates a new Greeter instance
   *
   * @param options - Configuration options
   */
  constructor(options: GreeterOptions = {}) {
    this.options = {
      excited: options.excited ?? true,
      prefix: options.prefix ?? 'Hello',
    };
  }

  /**
   * Generates a greeting for the given name
   *
   * @param name - The name to greet
   * @returns The greeting string
   */
  greet(name: string): string {
    const punctuation = this.options.excited ? '!' : '.';
    return `${this.options.prefix}, ${name}${punctuation}`;
  }
}

/**
 * Available log levels
 */
export enum LogLevel {
  Debug = 'debug',
  Error = 'error',
  Info = 'info',
  Warn = 'warn',
}

/**
 * Type alias for a greeting function
 */
export type GreetingFunction = (name: string) => string;

/**
 * Creates a simple greeting function
 *
 * @example
 *
 * ```ts
 * const greet = createGreeter('Hey');
 * console.log(greet('there')); // "Hey, there!"
 * ```
 *
 * @param prefix - The greeting prefix
 * @returns A function that creates greetings
 */
export const createGreeter = (prefix: string): GreetingFunction => {
  return (name: string) => `${prefix}, ${name}!`;
};

/**
 * The default greeter instance
 */
export const defaultGreeter = new Greeter();

/**
 * Library version
 */
export const VERSION = '1.0.0';
