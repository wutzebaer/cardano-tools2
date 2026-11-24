/**
 * What a server action hands to the browser. A live site replaces the message of an error thrown on the server
 * with a number, so a failure the visitor should read travels as a value instead.
 */
export type Answer<T> = { ok: true; value: T } | { ok: false; error: string };

/** A failure with a message written for the visitor. Any other error could name internals and is not passed on. */
export class UserError extends Error {}

export const SERVER_FAILED = "The server could not answer this request. Please try again in a moment.";

/** On the server: runs an action and turns a failure into an answer. */
export async function answer<T>(run: () => Promise<T>): Promise<Answer<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (error instanceof UserError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: SERVER_FAILED };
  }
}

/** In the browser: the value of an answer, a failure is thrown with the message from the server. */
export async function answered<T>(pending: Promise<Answer<T>>): Promise<T> {
  const result = await pending;
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
