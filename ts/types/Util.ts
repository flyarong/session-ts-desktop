import { LocalizerKeys } from './LocalizerKeys';

export type RenderTextCallbackType = (options: {
  text: string;
  key: number;
  isGroup: boolean;
}) => JSX.Element;

export type LocalizerType = (key: LocalizerKeys, values?: Array<string>) => string;

export type FixedLengthArray<T, Length extends number> = Array<T> & { length: Length };
