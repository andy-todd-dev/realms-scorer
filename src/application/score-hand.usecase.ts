import { Hand } from "../domain/hand";
import { HandScore, scoreHand } from "../domain/score";
import { CardCatalog, ScoreHandPorts } from "./score-hand.ports";

export interface ScoreHand {
  execute(hand: Hand): Promise<HandScore>;
}

export class ScoreHandUseCase implements ScoreHand {
  private readonly cardCatalog: CardCatalog;

  constructor({ cardCatalog }: ScoreHandPorts) {
    this.cardCatalog = cardCatalog;
  }

  async execute(hand: Hand): Promise<HandScore> {
    return scoreHand(
      await this.cardCatalog.getByIds(hand.cardIds),
      hand.choices,
    );
  }
}
