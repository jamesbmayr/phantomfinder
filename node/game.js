/*** modules ***/
	const CORE = require("../node/core")
	const SESSION = require("../node/session")
	module.exports = {}

/*** constants ***/
	const CONSTANTS = CORE.getAsset("constants")

/*** REQUEST ***/
	/* createOne */
		module.exports.createOne = createOne
		function createOne(REQUEST, callback) {
			try {
				// invalid team?
					const team = Number(REQUEST.post.team)
					if (team !== CONSTANTS.teamGhost && team !== CONSTANTS.teamHunters) {
						callback({success: false, message: `invalid team`})
						return
					}

				// new game
					const game = CORE.getSchema("game")
						game.creatorId = REQUEST.session.id

				// add player
					const player = CORE.getSchema("player")
						player.sessionId = REQUEST.session.id
						player.team = team
					game.players[player.sessionId] = player

				// obstacles
					const innerSquares = getInnerSquares(game.width, game.height)
					game.obstacles = generateObstacles(innerSquares)

				// ghost
					const ghost = generateGhost(innerSquares, game.obstacles)
					game.pieces.push(ghost)

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "insert"
						query.document = game

				// insert
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `unable to create game`})
							return
						}

						// game
							const gameId = results.documents[0].id

						// update session
							SESSION.setGame(REQUEST.session.id, gameId, results => {
								if (!results.success) {
									callback(results)
									return
								}
								
								callback({success: true, message: `game created`, location: `/game/${gameId}`})
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

	/* joinOne */
		module.exports.joinOne = joinOne
		function joinOne(REQUEST, callback) {
			try {
				// validate
					const gameId = REQUEST.post.gameId
					if (!gameId || !CONSTANTS.gamePathRegex.test(`/game/${gameId}`)) {
						callback({success: false, message: `invalid game id`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "find"
						query.filters = {id: gameId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `game not found`})
							return
						}

						// game found
							const game = results.documents[0]

						// already over?
							if (game.timeEnd) {
								callback({success: false, message: `game already ended`})
								return
							}

						// too many players
							const playerIds = Object.keys(game.players).filter(key => game.players[key].team !== undefined)
							if (!game.players[REQUEST.session.id] && playerIds.length >= CONSTANTS.playerCount) {
								callback({success: false, message: `game is at maximum player count (${CONSTANTS.playerCount})`})
								return
							}

						// already joined --> redirect
							if (game.players[REQUEST.session.id] && game.players[REQUEST.session.id].team !== undefined) {
								SESSION.setGame(REQUEST.session.id, gameId, results => {
									if (!results.success) {
										callback(results)
										return
									}

									callback({success: true, message: `rejoining game`, location: `/game/${gameId}`})
								})
								return
							}

						// add player
							const opponent = game.players[playerIds[0]]
							const player = CORE.getSchema("player")
								player.sessionId = REQUEST.session.id
								player.team = (opponent.team + 1) % CONSTANTS.playerCount

						// query
							const query = CORE.getSchema("query")
								query.collection = "games"
								query.command = "update"
								query.filters = {id: gameId}
								query.document = {
									updated: new Date().getTime(),
									[`players.${player.sessionId}`]: player
								}

						// start
							query.document.timeStart = new Date().getTime()

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `unable to join game`})
									return
								}

								// add user / session to this game
									SESSION.setGame(REQUEST.session.id, gameId, results => {
										if (!results.success) {
											callback(results)
											return
										}
										
										callback({success: true, message: `joining game`, location: `/game/${gameId}`})
									})
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

	/* readOne */
		module.exports.readOne = readOne
		function readOne(REQUEST, callback) {
			try {
				// validate
					if (!REQUEST.gameId || !CONSTANTS.gamePathRegex.test(`/game/${REQUEST.gameId}`)) {
						callback({success: false, message: `invalid game id`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "find"
						query.filters = {id: REQUEST.gameId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `game not found`})
							return
						}

						// game found
							const game = results.documents[0]

						// return data
							callback({success: true, game: game})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

/*** WEBSOCKETS ***/
	/* setConnect */
		module.exports.setConnect = setConnect
		function setConnect(REQUEST, connected, callback) {
			try {
				// validate
					const gameId = REQUEST.path[REQUEST.path.length - 1]
					if (!gameId || !CONSTANTS.gamePathRegex.test(`/game/${gameId}`)) {
						callback({success: false, message: `invalid game id`, recipients: [REQUEST.session.id]})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "find"
						query.filters = {id: gameId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `game not found`, recipients: [REQUEST.session.id]})
							return
						}

						// get game
							const game = results.documents[0]

						// game ended
							if (game.timeEnd) {
								callback({success: false, message: `game ended`, recipients: [REQUEST.session.id]})
								return
							}

						// query
							const query = CORE.getSchema("query")
								query.collection = "games"
								query.command = "update"
								query.filters = {id: gameId}
								query.document = {
									updated: new Date().getTime(),
									[`players.${REQUEST.session.id}.connected`]: connected || false
								}

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `game not found`, recipients: [REQUEST.session.id]})
									return
								}

								// self
									const updatedGame = results.documents[0]
									const teamNumber = updatedGame.players[REQUEST.session.id].team
									const teamName = teamNumber == CONSTANTS.teamGhost ? "ghost" : teamNumber == CONSTANTS.teamHunters ? "hunters" : "spectator"
									callback({success: true, message: `${connected ? ("connected as " + teamName) : "disconnected"}`, game: updatedGame, playerId: REQUEST.session.id, recipients: [REQUEST.session.id]})

								// others
									const otherPlayerIds = Object.keys(updatedGame.players).filter(playerId => playerId !== REQUEST.session.id)
									if (teamName !== "spectator") {
										callback({success: true, message: `opponent ${connected ? "connected" : "disconnected"}`, game: updatedGame, recipients: otherPlayerIds})
									}
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`, recipients: [REQUEST.session.id]})
			}
		}

	/* quitOne */
		module.exports.quitOne = quitOne
		function quitOne(REQUEST, callback) {
			try {
				// validate
					const gameId = REQUEST.session.gameId
					if (!gameId || !CONSTANTS.gamePathRegex.test(`/game/${gameId}`)) {
						callback({success: false, message: `invalid game id`, recipients: [REQUEST.session.id]})
						return
					}

				// not you
					if (!REQUEST.post.player || REQUEST.post.player !== REQUEST.session.id) {
						callback({success: false, message: `invalid player id`, recipients: [REQUEST.session.id]})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "find"
						query.filters = {id: gameId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `game not found`, recipients: [REQUEST.session.id]})
							return
						}

						// game found
							const game = results.documents[0]

						// not in game
							const player = game.players[REQUEST.session.id]
							if (!player || player.team == undefined) {
								callback({success: false, message: `not in game`, recipients: [REQUEST.session.id]})
								return
							}

						// game ended
							if (game.timeEnd) {
								callback({success: false, message: `game already ended`, recipients: [REQUEST.session.id]})
								return
							}
		
						// query
							const query = CORE.getSchema("query")
								query.collection = "games"
								query.command = "update"
								query.filters = {id: gameId}
								query.document = {
									updated: new Date().getTime(),
									[`players.${REQUEST.session.id}`]: undefined
								}

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `unable to leave game`, recipients: [REQUEST.session.id]})
									return
								}

								// game
									const updatedGame = results.documents[0]

								// remove user / session from this game
									SESSION.setGame(REQUEST.session.id, null, results => {
										if (!results.success) {
											callback(results)
											return
										}
										
										callback({success: true, message: `quitting game`, location: `/`, recipients: [REQUEST.session.id]})
									})

								// empty game --> delete
									if (!Object.keys(updatedGame.players).length) {
										// query
											const query = CORE.getSchema("query")
												query.collection = "games"
												query.command = "delete"
												query.filters = {id: gameId}
											
										// update
											CORE.accessDatabase(query, results => {})
											return
									}

								// inform others
									callback({success: true, message: `opponent quit the game`, game: updatedGame, recipients: Object.keys(updatedGame.players)})
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`, recipients: [REQUEST.session.id]})
			}
		}

	/* updateOne */
		module.exports.updateOne = updateOne
		function updateOne(REQUEST, callback) {
			try {
				// validate
					const gameId = REQUEST.session.gameId
					if (!gameId || !CONSTANTS.gamePathRegex.test(`/game/${gameId}`)) {
						callback({success: false, message: `invalid game id`, recipients: [REQUEST.session.id]})
						return
					}

				// not you
					if (!REQUEST.post.player || REQUEST.post.player !== REQUEST.session.id) {
						callback({success: false, message: `invalid player id`, recipients: [REQUEST.session.id]})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "find"
						query.filters = {id: gameId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `game not found`, recipients: [REQUEST.session.id]})
							return
						}

						// game found
							const game = results.documents[0]

						// not in game
							const player = game.players[REQUEST.session.id]
							if (!player || player.team == undefined) {
								callback({success: false, message: `not in game`, recipients: [REQUEST.session.id]})
								return
							}

						// game hasn't started
							if (!game.timeStart) {
								callback({success: false, message: `waiting for opponent to join`, recipients: [REQUEST.session.id]})
								return
							}

						// game ended
							if (game.timeEnd) {
								callback({success: false, message: `game already ended`, recipients: [REQUEST.session.id]})
								return
							}

						// not your turn
							if (game.turn !== player.team) {
								callback({success: false, message: `not your turn`, recipients: [REQUEST.session.id]})
								return
							}

						// not your piece
							const movedPiece = REQUEST.post.piece
							if (movedPiece.team !== player.team) {
								callback({success: false, message: `not your piece`, recipients: [REQUEST.session.id]})
								return
							}

						// not a legal move
							const legalMoves = getLegalMoves(game, movedPiece)
							const targetSquare = REQUEST.post.target
							if (!legalMoves.find(move => move.x == targetSquare.x && move.y == targetSquare.y)) {
								callback({success: false, message: `illegal move`, recipients: [REQUEST.session.id]})
								return
							}

						// add piece
							if (movedPiece.add) {
								addPiece(REQUEST, game, movedPiece, targetSquare, callback)
								return
							}

						// existing piece
							movePiece(REQUEST, game, movedPiece, targetSquare, callback)
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

	/* addPiece */
		function addPiece(REQUEST, game, movedPiece, targetSquare, callback) {
			try {
				// message
					let message = ""

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "update"
						query.filters = {id: game.id}
						query.document = {
							updated: new Date().getTime()
						}

				// ghost
					if (movedPiece.team !== CONSTANTS.teamHunters) {
						callback({success: false, message: `ghost cannot add pieces`, recipients: [REQUEST.session.id]})
						return
					}

				// too many hunters
					if (game.pieces.filter(piece => piece.team == movedPiece.team).length >= CONSTANTS.simultaneousHunters) {
						callback({success: false, message: `only ${CONSTANTS.simultaneousHunters} hunters allowed at once`, recipients: [REQUEST.session.id]})
						return
					}

				// add piece
					const piece = CORE.getSchema("piece")
						piece.team = movedPiece.team
						piece.x = targetSquare.x
						piece.y = targetSquare.y
					game.pieces.push(piece)
					query.document.pieces = game.pieces

				// capture ghost?
					const opponentPiece = game.pieces.find(piece => piece.team == CONSTANTS.teamGhost && piece.x == targetSquare.x && piece.y == targetSquare.y)
					if (opponentPiece) {
						// remove ghost
							game.pieces = game.pieces.filter(piece => !(piece.x == targetSquare.x && piece.y == targetSquare.y && piece.team == CONSTANTS.teamGhost))
							query.document.pieces = game.pieces

						// game over
							game.winner = CONSTANTS.teamGhost
							query.document.winner = game.winner

							game.timeEnd = new Date().getTime()
							query.document.timeEnd = game.timeEnd

							message = `ghost captured; hunters win`
					}

				// swap turns
					else {
						game.turn = (game.turn + 1) % CONSTANTS.playerCount
						query.document.turn = game.turn
						message = `hunter added to the board`
					}					

				// update
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `game not found`, recipients: [REQUEST.session.id]})
							return
						}

						// self
							const updatedGame = results.documents[0]
							callback({success: true, game: updatedGame, message: message, recipients: Object.keys(updatedGame.players)})

						// game over?
							if (updatedGame.timeEnd) {
								for (const playerId in updatedGame.players) {
									SESSION.setGame(playerId, null, results => {
										if (!results.success) {
											callback(results)
											return
										}
									})
								}
							}
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

	/* movePiece */
		function movePiece(REQUEST, game, movedPiece, targetSquare, callback) {
			try {
				// message
					let message = ""

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "update"
						query.filters = {id: game.id}
						query.document = {
							updated: new Date().getTime()
						}

				// find piece
					const dataPiece = game.pieces.find(piece => piece.x == movedPiece.x && piece.y == movedPiece.y && piece.team == movedPiece.team)
					if (!dataPiece) {
						callback({success: false, message: `piece not found`, recipients: [REQUEST.session.id]})
						return
					}

				// find opponent piece
					const opponentPiece = game.pieces.find(piece => piece.x == targetSquare.x && piece.y == targetSquare.y && piece.team !== movedPiece.team)

				// ghost capturing hunter
					if (opponentPiece && movedPiece.team == CONSTANTS.teamGhost) {
						// move piece
							dataPiece.x = targetSquare.x
							dataPiece.y = targetSquare.y
							query.document.pieces = game.pieces

						// remove hunter
							game.pieces = game.pieces.filter(piece => !(piece.x == targetSquare.x && piece.y == targetSquare.y && piece.team == CONSTANTS.teamHunters))
							query.document.pieces = game.pieces

						// increment deaths
							game.deaths++
							query.document.deaths = game.deaths

						// capture indicator
							game.capture = true
							query.document.capture = game.capture

						// message
							message = `hunters captured: ${game.deaths}; ghost goes again`

						// game over?
							if (game.deaths >= CONSTANTS.hunterDeathGoal) {
								game.winner = CONSTANTS.teamGhost
								query.document.winner = game.winner

								game.timeEnd = new Date().getTime()
								query.document.timeEnd = game.timeEnd

								message = `hunters captured: ${game.deaths}; ghost wins`
							}
					}

				// hunter capturing ghost
					else if (opponentPiece && movedPiece.team == CONSTANTS.teamHunters) {
						// move piece
							dataPiece.x = targetSquare.x
							dataPiece.y = targetSquare.y
							query.document.pieces = game.pieces

						// remove ghost
							game.pieces = game.pieces.filter(piece => !(piece.x == targetSquare.x && piece.y == targetSquare.y && piece.team == CONSTANTS.teamGhost))
							query.document.pieces = game.pieces

						// game over
							game.winner = CONSTANTS.teamHunters
							query.document.winner = game.winner

							game.timeEnd = new Date().getTime()
							query.document.timeEnd = game.timeEnd

							message = `ghost captured; hunters win`
					}

				// normal move
					else {
						// move piece
							dataPiece.x = targetSquare.x
							dataPiece.y = targetSquare.y
							query.document.pieces = game.pieces

						// not a capture
							game.capture = false
							query.document.capture = game.capture

						// swap turns
							game.turn = (game.turn + 1) % CONSTANTS.playerCount
							query.document.turn = game.turn

							message = `${game.turn == CONSTANTS.teamGhost ? "ghost's" : "hunters'" } turn`
					}

				// update
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `game not found`, recipients: [REQUEST.session.id]})
							return
						}

						// self
							const updatedGame = results.documents[0]
							callback({success: true, game: updatedGame, message: message, recipients: Object.keys(updatedGame.players)})

						// game over?
							if (updatedGame.timeEnd) {
								for (const playerId in updatedGame.players) {
									SESSION.setGame(playerId, null, results => {
										if (!results.success) {
											callback(results)
											return
										}
									})
								}
							}
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

	/* rematchOne */
		module.exports.rematchOne = rematchOne
		function rematchOne(REQUEST, callback) {
			try {
				// validate
					const gameId = REQUEST.session.gameId
					if (!gameId || !CONSTANTS.gamePathRegex.test(`/game/${gameId}`)) {
						callback({success: false, message: `invalid game id`, recipients: [REQUEST.session.id]})
						return
					}

				// not you
					if (!REQUEST.post.player || REQUEST.post.player !== REQUEST.session.id) {
						callback({success: false, message: `invalid player id`, recipients: [REQUEST.session.id]})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "find"
						query.filters = {id: gameId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `game not found`, recipients: [REQUEST.session.id]})
							return
						}

						// game found
							const game = results.documents[0]

						// not in game
							const player = game.players[REQUEST.session.id]
							if (!player || player.team == undefined) {
								callback({success: false, message: `not in game`, recipients: [REQUEST.session.id]})
								return
							}

						// game hasn't ended
							if (!game.timeEnd) {
								callback({success: false, message: `game in progress`, recipients: [REQUEST.session.id]})
								return
							}

						// query
							const query = CORE.getSchema("query")
								query.collection = "games"
								query.command = "update"
								query.filters = {id: game.id}
								query.document = {
									updated:   new Date().getTime(),
									timeStart: new Date().getTime(),
									timeEnd:   0,
									turn:      CONSTANTS.teamGhost,
									capture:   false,
									deaths:    0,
									winner:    null
								}

						// swap teams
							const playerIds = Object.keys(game.players).filter(key => game.players[key].team !== undefined)
							query.document.players = game.players
							for (const i in playerIds) {
								const playerId = playerIds[i]
								query.document.players[playerId].team = (query.document.players[playerId].team + 1) % CONSTANTS.playerCount
							}

						// obstacles
							const innerSquares = getInnerSquares(game.width, game.height)
							query.document.obstacles = generateObstacles(innerSquares)

						// ghost
							const ghost = generateGhost(innerSquares, query.document.obstacles)
							query.document.pieces = [ghost]

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `game not found`, recipients: [REQUEST.session.id]})
									return
								}

								// self
									const updatedGame = results.documents[0]
									callback({success: true, game: updatedGame, message: `rematch started! players swap teams`, rematch: true, recipients: Object.keys(updatedGame.players)})

								// set game
									for (const playerId in updatedGame.players) {
										SESSION.setGame(playerId, updatedGame.id, results => {
											if (!results.success) {
												callback(results)
												return
											}
										})
									}
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

/*** OTHER ***/
	/* getInnerSquares */
		function getInnerSquares(width, height) {
			try {
				// empty list
					const innerSquares = {
						x: [],
						y: []
					}

				// generate lists
					for (let x = 1; x < width  - 1; x++) { // no obstacles on edges
						innerSquares.x.push(x)
					}
					for (let y = 1; y < height - 1; y++) { // no obstacles on edges
						innerSquares.y.push(y)
					}

				// return
					return innerSquares
			}
			catch (error) {
				CORE.logError(error)
				return {}
			}
		}

	/* generateObstacles */
		function generateObstacles(innerSquares) {
			try {
				// add obstacles
					const obstacles = []
					while (obstacles.length < CONSTANTS.obstacleCount) {
						// empty obstacle
							const obstacle = {x: null, y: null}

						// random unoccupied location
							do {
								obstacle.x = CORE.chooseRandom(innerSquares.x)
								obstacle.y = CORE.chooseRandom(innerSquares.y)
							}
							while (obstacles.find(existingObstacle => existingObstacle.x == obstacle.x && existingObstacle.y == obstacle.y))

						// add to list
							obstacles.push(obstacle)
					}

				// return
					return obstacles
			}
			catch (error) {
				CORE.logError(error)
				return []
			}
		}

	/* generateGhost */
		function generateGhost(innerSquares, obstacles) {
			try {
				// piece
					const ghost = CORE.getSchema("piece")
						ghost.team = CONSTANTS.teamGhost

				// random location
					do {
						ghost.x = CORE.chooseRandom(innerSquares.x)
						ghost.y = CORE.chooseRandom(innerSquares.y)
					}
					while (obstacles.find(existingObstacle => existingObstacle.x == ghost.x && existingObstacle.y == ghost.y))

				// return
					return ghost
			}
			catch (error) {
				CORE.logError(error)
				return {}
			}
		}

	/* isLegalSquare */
		function isLegalSquare(game, x, y, team) {
			try {
				// outside the board
					if (x < 0 || y < 0 || x >= game.width || y >= game.height) {
						return false
					}

				// obstacle
					if (game.obstacles.find(obstacle => obstacle.x == x && obstacle.y == y)) {
						return false
					}

				// allied hunter
					if (team == CONSTANTS.teamHunters && game.pieces.find(existingPiece => existingPiece.x == x && existingPiece.y == y && existingPiece.team == team)) {
						return false
					}

				// legal
					return true
			}
			catch (error) {
				CORE.logError(error)
				return false
			}
		}

	/* getLegalMoves */
		function getLegalMoves(game, piece) {
			try {
				// moves
					const moves = []

				// hunter - add
					if (piece.team == CONSTANTS.teamHunters && piece.add) {
						// top-left corner
							let x = 0
							let y = 0

						// across top
							while (x < game.width) {
								if (isLegalSquare(game, x, y, piece.team)) {
									moves.push({x: x, y: y})
								}
								x++
							}
							x--

						// down right
							while (y < game.height) {
								if (isLegalSquare(game, x, y, piece.team)) {
									moves.push({x: x, y: y})
								}
								y++
							}
							y--

						// across bottom
							while (x >= 0) {
								if (isLegalSquare(game, x, y, piece.team)) {
									moves.push({x: x, y: y})
								}
								x--
							}
							x++

						// up left
							while (y >= 0) {
								if (isLegalSquare(game, x, y, piece.team)) {
									moves.push({x: x, y: y})
								}
								y--
							}
							y++

						return moves
					}

				// hunter - existing
					if (piece.team == CONSTANTS.teamHunters) {
						// coordinates
							let x, y
						// N

							x = 0
							y = -1
							while (isLegalSquare(game, piece.x + x, piece.y + y, piece.team)) {
								moves.push({x: piece.x + x, y: piece.y + y})
								y--
							}

						// NE
							x = 1
							y = -1
							while (isLegalSquare(game, piece.x + x, piece.y + y, piece.team)) {
								moves.push({x: piece.x + x, y: piece.y + y})
								x++
								y--
							}

						// E
							x = 1
							y = 0
							while (isLegalSquare(game, piece.x + x, piece.y + y, piece.team)) {
								moves.push({x: piece.x + x, y: piece.y + y})
								x++
							}

						// SE
							x = 1
							y = 1
							while (isLegalSquare(game, piece.x + x, piece.y + y, piece.team)) {
								moves.push({x: piece.x + x, y: piece.y + y})
								x++
								y++
							}

						// S
							x = 0
							y = 1
							while (isLegalSquare(game, piece.x + x, piece.y + y, piece.team)) {
								moves.push({x: piece.x + x, y: piece.y + y})
								y++
							}

						// SW
							x = -1
							y = 1
							while (isLegalSquare(game, piece.x + x, piece.y + y, piece.team)) {
								moves.push({x: piece.x + x, y: piece.y + y})
								x--
								y++
							}

						// W
							x = -1
							y = 0
							while (isLegalSquare(game, piece.x + x, piece.y + y, piece.team)) {
								moves.push({x: piece.x + x, y: piece.y + y})
								x--
							}

						// NW
							x = -1
							y = -1
							while (isLegalSquare(game, piece.x + x, piece.y + y, piece.team)) {
								moves.push({x: piece.x + x, y: piece.y + y})
								x--
								y--
							}

						return moves
					}

				// ghost
					// in place
						moves.push({x: piece.x, y: piece.y})

					// NW
						if (isLegalSquare(game, piece.x - 1, piece.y - 2, piece.team)) {
							moves.push({x: piece.x - 1, y: piece.y - 2})
						}

					// NE
						if (isLegalSquare(game, piece.x + 1, piece.y - 2, piece.team)) {
							moves.push({x: piece.x + 1, y: piece.y - 2})
						}

					// EN
						if (isLegalSquare(game, piece.x + 2, piece.y - 1, piece.team)) {
							moves.push({x: piece.x + 2, y: piece.y - 1})
						}

					// ES
						if (isLegalSquare(game, piece.x + 2, piece.y + 1, piece.team)) {
							moves.push({x: piece.x + 2, y: piece.y + 1})
						}

					// SE
						if (isLegalSquare(game, piece.x + 1, piece.y + 2, piece.team)) {
							moves.push({x: piece.x + 1, y: piece.y + 2})
						}

					// SW
						if (isLegalSquare(game, piece.x - 1, piece.y + 2, piece.team)) {
							moves.push({x: piece.x - 1, y: piece.y + 2})
						}

					// WS
						if (isLegalSquare(game, piece.x - 2, piece.y + 1, piece.team)) {
							moves.push({x: piece.x - 2, y: piece.y + 1})
						}

					// WN
						if (isLegalSquare(game, piece.x - 2, piece.y - 1, piece.team)) {
							moves.push({x: piece.x - 2, y: piece.y - 1})
						}

					return moves
			}
			catch (error) {
				CORE.logError(error)
				return []
			}
		}
