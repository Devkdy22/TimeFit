export function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`timeout:${ms}`));
    }, ms);
  });
}
