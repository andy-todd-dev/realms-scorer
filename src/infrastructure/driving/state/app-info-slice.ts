import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { AppInfoView } from "../../../application/load-app-info.usecase";

// The installed app's version and build number, for bug reports. Null until loaded, or if the platform has none.
const initialState: AppInfoView = { version: null, buildNumber: null };

const appInfoSlice = createSlice({
  name: "appInfo",
  initialState,
  reducers: {
    appInfoSaved: (_, action: PayloadAction<AppInfoView>) => action.payload,
  },
});

export const { appInfoSaved } = appInfoSlice.actions;
export const appInfoReducer = appInfoSlice.reducer;
