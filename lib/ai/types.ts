import { TransformInput } from "../transform/types";

export type ProviderOutput = {
  imageBase64: string;
  mimeType: string;
  model: string;
};

export interface TransformProvider {
  transformPortrait(input: TransformInput): Promise<ProviderOutput>;
}

export class ProviderError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 502, code = "PROVIDER_ERROR") {
    super(message);
    this.name = "ProviderError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
