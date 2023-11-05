import { Database } from "bun:sqlite";
import { exists, existsSync, mkdir } from "fs";

export enum GameType {
	Preseason = "01",
	Regular = "02",
	Playoffs = "03",
	AllStar = "04",
}

export interface GameStatsMetadata {
	wait: number;
	timeStamp: string;
}

export interface GameStatsDataGame {
	pk: number;
	season: string;
	type: string;
}

export interface DateTime {
	dateTime: string;
	endDateTime: string;
}

export interface GameStatsDataTeam {
	id: number;
	name: string;
	link: string;
	venue: unknown;
	abbreviation: string;
	triCode: string;
	teamName: string;
	locationName: string;
	firstYearOfPlay: string;
	division: unknown;
	conference: unknown;
	franchise: unknown;
	shortName: string;
	officialSiteUrl: string;
	franchiseId: number;
	active: boolean;
}

export interface GameStatsDataTeams {
	away: GameStatsDataTeam;
	home: GameStatsDataTeam;
}

export interface GameStatsData {
	game: GameStatsDataGame;
	datetime: DateTime;
	status: unknown;
	teams: GameStatsDataTeams;
}

export interface Plays {
	allPlays: unknown[];
	scoringPlays: number[];
	penaltyPlays: number[];
	playsByPeriod: unknown[];
	currentPlay: unknown;
	scoringPlaysCount: number;
	penaltyPlaysCount: number;
}

export interface Linescore {
	currentPeriod: number;
	currentPeriodOrdinal: string;
	currentPeriodTimeRemaining: string;
	periods: unknown[];
	shootoutInfo: unknown;
	teams: unknown;
	powerPlayStrength: string;
	hasShootout: boolean;
	intermissionInfo: unknown;
	powerPlayInfo: unknown;
}

export interface Boxscore {
	teams: unknown;
	officials: unknown[];
	info: unknown;
	decisions: unknown;
}

export interface GameStatsLiveData {
	plays: Plays;
	linescore: Linescore;
	boxscore: Boxscore;
	decisions: unknown;
}

export interface GameStats {
	copyright: string;
	gamePk: number;
	link: string;
	metaData: GameStatsMetadata;
	gameData: GameStatsData;
	liveData: GameStatsLiveData;
}

export function buildGameId(
	season: string,
	type: GameType,
	gameNumber: number,
) {
	return `${season}${type}${gameNumber.toString().padStart(4, "0")}`;
}

export async function getGameStats(gameId: string) {
	const res = await fetch(
		`https://statsapi.web.nhl.com/api/v1/game/${gameId}/feed/live`,
	);
	const json = await res.json<GameStats>();
	return json;
}

export async function updateDb(db: Database) {
	const currentDataQuery = db.query("SELECT * FROM games");
	const currentData = currentDataQuery.all() as {
		game_id: string;
		game_data: string;
	}[];

	const args = Bun.argv.slice(2);
	const seasonArgIndex = args.findIndex((arg) => arg.startsWith("--season"));
	if (seasonArgIndex === -1) {
		console.log("No season argument found!");
		process.exit(1);
	}
	const seasonArg =
		args[args.findIndex((arg) => arg.startsWith("--season")) + 1];
	console.log(`Parsing data for ${seasonArg} season...`);
	console.log(currentData ? "Current data found!" : "No current data found!");

	let gameNumber = 1;
	let error = false;
	while (!error) {
		try {
			const gameId = buildGameId(seasonArg, GameType.Regular, gameNumber);

			if (
				currentData !== null &&
				Array.isArray(currentData) &&
				currentData.find((row) => row.game_id === gameId)
			) {
				console.log(`Skipping ${gameId} because it already exists!`);
				gameNumber++;
				continue;
			}

			const gameStats = await getGameStats(gameId);
			console.log(
				`${gameStats.gameData.game.pk} (${gameStats.gameData.datetime.dateTime}): ${gameStats.gameData.teams.away.name} @ ${gameStats.gameData.teams.home.name}`,
			);
			const stmt = db.prepare(`
        INSERT INTO games (game_id, game_data)
        VALUES (?, ?)
      `);
			stmt.run(gameId, JSON.stringify(gameStats));
			gameNumber++;
		} catch (e) {
			error = true;
		}
	}
}

export async function getStats(
	db: Database,
	config: {
		season?: string;
		type?: GameType;
		gameNumber?: number;
		team?: string;
		output?: "json" | "csv";
	},
) {
	console.log("Getting stats...");
	const currentDataQuery = db.query("SELECT * FROM games");
	const currentData = currentDataQuery.all() as {
		game_id: string;
		game_data: string;
	}[];
	if (!currentData) {
		console.log("No data found!");
		process.exit(1);
	}
	let data = currentData.map((row) => JSON.parse(row.game_data)) as GameStats[];

	if (config.gameNumber) {
		data = data.filter((game) => game.gameData.game.pk === config.gameNumber);
	}
	if (config.type) {
		data = data.filter((game) => game.gameData.game.type === config.type);
	}
	if (config.season) {
		data = data.filter((game) =>
			// biome-ignore lint/style/noNonNullAssertion: unreachable if config.season dne
			game.gameData.game.season.startsWith(config.season!),
		);
	}
	if (config.team) {
		data = data.filter(
			(
				game,
			) => // biome-ignore lint/style/noNonNullAssertion: unreachable if config.team dne
				game.gameData.teams.home.name.includes(config.team!) ||
				// biome-ignore lint/style/noNonNullAssertion: unreachable if config.team dne
				game.gameData.teams.away.name.includes(config.team!),
		);
	}

	if (!config.output || config.output === "json") {
		console.log("Writing JSON to /out/stats.json...");
		if (!existsSync("./out")) {
			mkdir("./out", async () => {
				const file = Bun.file("./out/stats.json");
				await Bun.write(file, JSON.stringify(data));
			});
		} else {
			const file = Bun.file("./out/stats.json");
			await Bun.write(file, JSON.stringify(data));
		}
	} else if (config.output === "csv") {
		console.log("CSV output not yet implemented!");
	}
}

export function findArgs(args: string[], arg: string) {
	return args.findIndex((a) => a.startsWith(arg));
}

export async function main() {
	const db = new Database("./nhl-stats.sqlite");
	db.run(
		"CREATE TABLE IF NOT EXISTS games ( game_id TEXT PRIMARY KEY, game_data TEXT )",
	);
	const args = Bun.argv.slice(2);
	const command = args[0];
	const commands = ["update-db", "get"];
	if (!commands.includes(command)) {
		console.log(`Invalid command! Valid commands: ${commands.join(", ")}`);
		process.exit(1);
	}

	switch (command) {
		case "update-db":
			await updateDb(db);
			break;
		case "get":
			await getStats(db, {
				season:
					findArgs(args, "--season") !== -1
						? args[findArgs(args, "--season") + 1]
						: undefined,
				type:
					findArgs(args, "--type") !== -1
						? (args[findArgs(args, "--type") + 1] as GameType)
						: undefined,
				gameNumber:
					findArgs(args, "--game-number") !== -1
						? parseInt(args[findArgs(args, "--game-number") + 1]) || undefined
						: undefined,
				team:
					findArgs(args, "--team") !== -1
						? args[findArgs(args, "--team") + 1]
						: undefined,
				output:
					findArgs(args, "--output") !== -1
						? (args[findArgs(args, "--output") + 1] as
								| "json"
								| "csv"
								| undefined)
						: undefined,
			});
			break;
	}
	console.log("Done!");
}

main();
