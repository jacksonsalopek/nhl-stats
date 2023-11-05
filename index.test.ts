import { describe, it, expect } from "bun:test";
import { buildGameId, GameType } from ".";

describe("index.ts", () => {
	it("should build proper game id for regular season", () => {
		const id = buildGameId("2023", GameType.Regular, 1);
		const id2 = buildGameId("2023", GameType.Regular, 10);
		expect(id).toEqual("2023020001");
		expect(id2).toEqual("2023020010");
	});
	it.todo("should build proper game id for preseason");
	it.todo("should build proper game id for playoffs");
});
