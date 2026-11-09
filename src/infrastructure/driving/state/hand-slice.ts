import { createSlice } from "@reduxjs/toolkit";
import type { CardId, Suit } from "../../../domain/card";
import type { Hand } from "../../../domain/hand";
import { createAppAsyncThunk } from "./create-app-async-thunk";

const initialState: Hand = {
  cardIds: [],
  choices: {},
};

export const addCardToHand = createAppAsyncThunk(
  "hand/addCard",
  (cardId: CardId, { extra, getState }) =>
    extra.addCardToHand.execute(getState().variant.id, getState().hand, cardId),
);

export const removeCardFromHand = createAppAsyncThunk(
  "hand/removeCard",
  (cardId: CardId, { extra, getState }) =>
    extra.removeCardFromHand.execute(
      getState().variant.id,
      getState().hand,
      cardId,
    ),
);

export const clearHand = createAppAsyncThunk(
  "hand/clear",
  (_: void, { extra }) => extra.clearHand.execute(),
);

// Replaces the whole hand, as when confirming a scan.
export const replaceHand = createAppAsyncThunk(
  "hand/replace",
  (cardIds: readonly CardId[], { extra, getState }) =>
    extra.replaceHand.execute(getState().variant.id, cardIds),
);

export const chooseCard = createAppAsyncThunk(
  "hand/chooseCard",
  (
    {
      chooserId,
      targetId,
      suit,
    }: { chooserId: CardId; targetId: CardId; suit?: Suit },
    { extra, getState },
  ) =>
    extra.chooseCard.execute(
      getState().variant.id,
      getState().hand,
      chooserId,
      targetId,
      suit,
    ),
);

// Each use case returns the whole new hand, which replaces the old one.
const handSlice = createSlice({
  name: "hand",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(addCardToHand.fulfilled, (_, action) => action.payload)
      .addCase(removeCardFromHand.fulfilled, (_, action) => action.payload)
      .addCase(clearHand.fulfilled, (_, action) => action.payload)
      .addCase(replaceHand.fulfilled, (_, action) => action.payload)
      .addCase(chooseCard.fulfilled, (_, action) => action.payload);
  },
});

export const handReducer = handSlice.reducer;
