import { scoreHand } from "../domain/score";
import { loadHandRules } from "./hand-rules";
import { RescorePorts } from "./rescore.ports";

export interface Rescore {
  execute(): Promise<void>;
}

export class RescoreUseCase implements Rescore {
  private readonly ports: RescorePorts;

  constructor({
    hands,
    scores,
    variant,
    cardCatalog,
    variantCatalog,
  }: RescorePorts) {
    this.ports = { hands, scores, variant, cardCatalog, variantCatalog };
  }

  /*
    Scores the current hand under the current variant and saves the score, or null if scoring fails, so a failure shows
    as a missing score rather than a rejection. A result for a hand that has changed in the meantime is dropped, as the
    score for the newer hand is on its way.
  */
  async execute(): Promise<void> {
    const { hands, scores, variant } = this.ports;
    const hand = hands.get();
    const score = await loadHandRules(this.ports, variant.get(), hand.cardIds)
      .then(({ cards, rules }) => scoreHand(cards, hand.choices, rules))
      .catch(() => null);

    if (hands.get() === hand) {
      scores.save(score);
    }
  }
}
