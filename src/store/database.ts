import { makeAdapter } from "./adapter";
import { LocalStore } from "./repository";

export const store = new LocalStore(makeAdapter());
