// Terminal output. Colour only when the terminal asks for it.

const ESC = "\u001b";
const colour = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

const wrap = (code: string) => (text: string) =>
  colour ? `${ESC}[${code}m${text}${ESC}[0m` : text;

export const bold = wrap("1");
export const dim = wrap("2");
export const red = wrap("31");
export const green = wrap("32");
export const amber = wrap("33");
export const blue = wrap("34");

export function heading(text: string): void {
  console.log(`\n${bold(text)}`);
}

export function rule(): void {
  console.log(dim("-".repeat(Math.min(process.stdout.columns ?? 76, 76))));
}
