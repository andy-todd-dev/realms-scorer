import type { Variant, VariantId } from "../../domain/variant";
import { BASE_VARIANT } from "./variants/base.variant";

export const VARIANTS: readonly Variant[] = [BASE_VARIANT];

export class InMemoryVariantCatalog {
  private readonly variants: readonly Variant[];

  constructor(variants: readonly Variant[] = VARIANTS) {
    this.variants = variants;
  }

  async getById(variantId: VariantId): Promise<Variant> {
    const variant = this.variants.find(({ id }) => id === variantId);

    if (!variant) {
      throw new Error(`Unknown variant: ${variantId}`);
    }

    return variant;
  }
}
