const SPOKEN_NUMBERS: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, twelve: 12, fifteen: 15, twenty: 20, 'twenty five': 25, thirty: 30, forty: 40, sixty: 60,
  mot: 1, hai: 2, ba: 3, bon: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9,
  muoi: 10, 'muoi hai': 12, 'muoi lam': 15, 'hai muoi': 20, 'hai muoi lam': 25, 'ba muoi': 30, 'sau muoi': 60,
};

export function wholeNumber(text: string): number | undefined {
  if (/^\d{1,4}$/u.test(text)) return Number(text);
  return Object.hasOwn(SPOKEN_NUMBERS, text) ? SPOKEN_NUMBERS[text] : undefined;
}
