import { createSlice } from "@reduxjs/toolkit";
import { createAppAsyncThunk } from "./create-app-async-thunk";

// The installed app's version and build number, for bug reports. Null until loaded, or if the platform has none.
type AppInfoState = {
  readonly version: string | null;
  readonly buildNumber: string | null;
};

const initialState: AppInfoState = { version: null, buildNumber: null };

export const loadAppInfo = createAppAsyncThunk(
  "appInfo/load",
  (_: void, { extra }) => extra.loadAppInfo.execute(),
);

const appInfoSlice = createSlice({
  name: "appInfo",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(loadAppInfo.fulfilled, (_, action) => action.payload);
  },
});

export const appInfoReducer = appInfoSlice.reducer;
