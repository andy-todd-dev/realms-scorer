import { Hand } from "../domain/hand";
import { HandScore, scoreHand } from "../domain/score";
import { VariantId } from "../domain/variant";
import { loadHandRules } from "./hand-rules";
import { ScoreHandPorts } from "./score-hand.ports";

export interface ScoreHand {
  execute(variantId: VariantId, hand: Hand): Promise<HandScore>;
}

export class ScoreHandUseCase implements ScoreHand {
  private readonly ports: ScoreHandPorts;

  constructor({ cardCatalog, variantCatalog }: ScoreHandPorts) {
    this.ports = { cardCatalog, variantCatalog };
  }

  async execute(variantId: VariantId, hand: Hand): Promise<HandScore> {
    const { cards, rules } = await loadHandRules(
      this.ports,
      variantId,
      hand.cardIds,
    );

    return scoreHand(cards, hand.choices, rules);
  }
}
