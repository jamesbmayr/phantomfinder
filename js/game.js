/*** globals ***/
	/* triggers */
		const TRIGGERS = {
			submit: "submit",
			click: "click",
			input: "input"
		}

	/* elements */
		const ELEMENTS = {
			"body": document.querySelector("body"),
			"players": document.querySelector("#players"),
			"players-ghost": document.querySelector("#players-ghost"),
			"players-hunters": document.querySelector("#players-hunters"),
			"players-action-pass": document.querySelector("#players-action-pass"),
			"players-action-add": document.querySelector("#players-action-add"),
			"players-resign": document.querySelector("#players-resign"),
			"board-grid": document.querySelector("#board-grid"),
			"board-pieces": document.querySelector("#board-pieces"),
			"postgame": document.querySelector("#postgame"),
			"postgame-message": document.querySelector("#postgame-message"),
			"postgame-rematch": document.querySelector("#postgame-rematch"),
			"postgame-new": document.querySelector("#postgame-new")
		}

	/* state */
		const STATE = {
			playerId: null,
			selected: null,
			game: {}
		}

/*** helpers ***/
	/* showToast */
		const TOAST = {
			beforeFade: 200, // ms
			afterFade: 5000, // ms
			element: null,
			timeout: null
		}

		function showToast(data) {
			try {
				// clear existing countdowns
					if (TOAST.timeout) {
						clearTimeout(TOAST.timeout)
						TOAST.timeout = null
					}

				// append
					if (!TOAST.element) {
						TOAST.element = document.createElement("div")
						TOAST.element.id = "toast"
						TOAST.element.setAttribute("visibility", false)
						TOAST.element.setAttribute("success", false)
						document.body.appendChild(TOAST.element)
					}

				// show
					setTimeout(() => {
						TOAST.element.innerHTML = data.message
						TOAST.element.setAttribute("success", data.success || false)
						TOAST.element.setAttribute("visibility", true)
					}, TOAST.beforeFade)

				// hide
					TOAST.timeout = setTimeout(() => {
						TOAST.element.setAttribute("visibility", false)
					}, TOAST.afterFade)
			} catch (error) {console.log(error)}
		}

/*** socket ***/
	/* start */
		const SOCKET = {
			connection: null,
			createLoop: null,
			createInterval: 5 * 1000, // ms
			pingLoop: null,
			pingInterval: 60 * 1000, // ms
			keepPinging: null
		}

	/* createSocket */
		createSocket()
		SOCKET.createLoop = setInterval(createSocket, SOCKET.createInterval)
		function createSocket() {
			try {
				// already created
					if (SOCKET.connection) {
						clearInterval(SOCKET.createLoop)
						return
					}

				// connect
					SOCKET.connection = new WebSocket(location.href.replace("http","ws"))
					SOCKET.connection.onopen = () => {
						SOCKET.connection.send(null)
					}

				// disconnect
					SOCKET.connection.onerror = error => {
						SOCKET.connection.onclose = () => {}
						clearInterval(SOCKET.createLoop)
						window.location = "/"
					}
					SOCKET.connection.onclose = () => {
						showToast({success: false, message: `disconnected`})
						SOCKET.connection = null
						
						createSocket()
						SOCKET.createLoop = setInterval(createSocket, SOCKET.createInterval)
					}

				// message
					SOCKET.connection.onmessage = message => {
						try {
							SOCKET.keepPinging = true
							const post = JSON.parse(message.data)
							if (post && (typeof post == "object")) {
								receiveSocket(post)
							}
						}
						catch (error) {console.log(error)}
					}

				// ping
					SOCKET.keepPinging = false
					clearInterval(SOCKET.pingLoop)
					SOCKET.pingLoop = setInterval(pingServer, SOCKET.pingInterval)
			} catch (error) {console.log(error)}
		}

	/* pingServer */
		function pingServer() {
			try {
				if (!SOCKET.keepPinging) {
					return
				}

				SOCKET.keepPinging = false
				fetch("/ping", {method: "GET"})
					.then(response => response.json())
					.then(data => {})
			} catch (error) {console.log(error)}
		}

	/* receiveSocket */
		function receiveSocket(data) {
			try {
				// redirect
					if (data.location) {
						window.location = data.location
						return
					}
					
				// failure
					if (!data || !data.success) {
						showToast({success: false, message: data.message || `unknown websocket error`})

						// force close
							if (data.close) {
								SOCKET.connection.onclose = () => {}
								if (SOCKET.connection.readyState == 1) { // OPEN
									SOCKET.connection.close()
								}

								setTimeout(() => {
									window.location = "/"
								}, 2000) // ms
							}
						return
					}

				// toast
					if (data.message) {
						showToast({success: data.success, message: data.message})
					}

				// data
					if (data.playerId) {
						STATE.playerId = data.playerId
					}

					if (data.rematch) {
						displayBoard(data.game)
					}

					if (data.game) {
						displayGame(data.game)
					}
			} catch (error) {console.log(error)}
		}

/*** display ***/
	/* displayGame */
		function displayGame(game) {
			try {
				// save game
					if (game) {
						STATE.game = game
					}

				// build board
					if (!ELEMENTS["board-grid"].hasChildNodes()) {
						displayBoard(STATE.game)
					}

				// update pieces
					displayPieces(STATE.game)

				// display players
					displayPlayers(STATE.game)

				// end
					if (STATE.game.timeEnd) {
						displayEnd(STATE.game)
					}
			} catch (error) {console.log(error)}
		}

	/* displayBoard */
		function displayBoard(game) {
			try {
				// clear out existing board
					ELEMENTS["board-grid"].innerHTML = ""
					ELEMENTS["board-pieces"].innerHTML = ""

				// loop through x and y
					for (let y = 0; y < game.height; y++) {
						const gridRow = document.createElement("div")
							gridRow.className = "board-grid-row"
						ELEMENTS["board-grid"].appendChild(gridRow)

						const piecesRow = document.createElement("div")
							piecesRow.className = "board-pieces-row"
						ELEMENTS["board-pieces"].appendChild(piecesRow)

						for (let x = 0; x < game.width; x++) {
							const gridSquare = document.createElement("div")
								gridSquare.className = "board-grid-square"
								gridSquare.setAttribute("x", x)
								gridSquare.setAttribute("y", y)
								if (game.obstacles.find(obstacle => obstacle.x == x && obstacle.y == y)) {
									gridSquare.setAttribute("obstacle", true)
								}
							gridRow.appendChild(gridSquare)

							const piecesSquare = document.createElement("div")
								piecesSquare.className = "board-pieces-square"
								piecesSquare.setAttribute("x", x)
								piecesSquare.setAttribute("y", y)
								piecesSquare.addEventListener(TRIGGERS.click, movePiece)
							piecesRow.appendChild(piecesSquare)
						}
					}

				// set buttons
					if (STATE.playerId && game.players[STATE.playerId]) {
						// team
							const teamNumber = game.players[STATE.playerId].team

						// both
							if (teamNumber !== undefined) {
								ELEMENTS["players-resign"].setAttribute("visibility", true)
								ELEMENTS["postgame"].setAttribute("visibility", false)
							}

						// ghost
							if (teamNumber == 0) {
								ELEMENTS["players-action-pass"].setAttribute("visibility", true)
								ELEMENTS["players-action-add"].setAttribute("visibility", false)
							}

						// hunter
							if (teamNumber == 1) {
								ELEMENTS["players-action-pass"].setAttribute("visibility", false)
								ELEMENTS["players-action-add"].setAttribute("visibility", true)
							}
					}
			} catch (error) {console.log(error)}
		}

	/* displayPieces */
		function displayPieces(game) {
			try {				
				// remove existing pieces
					const pieces = Array.from(ELEMENTS["board-pieces"].querySelectorAll(".board-pieces-piece"))
					for (const p in pieces) {
						pieces[p].remove()
					}

				// unselect
					unselectPiece()

				// get player
					const playerIsGhost = (STATE.playerId && game.players[STATE.playerId] && game.players[STATE.playerId].team == 0)

				// build pieces
					for (const p in game.pieces) {
						// piece
							const piece = game.pieces[p]

						// square
							const pieceSquare = ELEMENTS["board-pieces"].querySelector(`.board-pieces-square[x='${piece.x}'][y='${piece.y}']`)
							if (!pieceSquare) {
								continue
							}

						// ghost - visible?
							if (piece.team == 0 && !playerIsGhost && !game.capture) {
								// check lines of sight
									if (!isGhostVisible(game)) {
										continue
									}
							}

						// svgPath
							const svgPath = piece.team ? "M 47 40 C 43 38 40 35 40 30 C 40 24 44 20 50 20 C 56 20 60 24 60 30 C 60 35 57 38 53 40 C 53 41 53 41 53 42 C 56 42 57 42 60 42 C 64 42 72 50 75 53 C 78 56 73 61 70 58 C 67 55 62 50 60 50 C 60 55 60 83 60 86 C 60 88 58 90 56 90 C 54 90 52 88 52 86 C 52 83 52 73 52 70 C 51 70 49 70 48 70 C 48 73 48 83 48 86 C 48 88 46 90 44 90 C 42 90 40 88 40 86 C 40 83 40 55 40 50 C 38 50 33 55 30 58 C 27 61 22 56 25 53 C 28 50 36 42 40 42 C 43 42 44 42 47 42 C 47 41 47 41 47 40 Z" : "M 54 40 C 54 42 56 44 58 44 C 60 44 62 42 62 40 C 62 38 60 36 58 36 C 56 36 54 38 54 40 Z M 38 40 C 38 42 40 44 42 44 C 44 44 46 42 46 40 C 46 38 44 36 42 36 C 40 36 38 38 38 40 Z M 36 70 C 36 70 34 75 34 75 C 32 80 32 80 31 75 C 30 70 30 60 30 40 C 30 29 39 20 50 20 C 61 20 70 29 70 40 C 70 60 70 70 69 75 C 68 80 68 80 66 75 C 66 75 64 70 64 70 C 62 65 62 65 60 70 C 60 70 58 75 58 75 C 56 80 56 80 54 75 C 54 75 52 70 52 70 C 50 65 50 65 48 70 C 48 70 48 70 46 75 C 44 80 44 80 42 75 C 42 75 40 70 40 70 C 38 65 38 65 36 70 Z"

						// otherwise
							const pieceElement = document.createElement("button")
								pieceElement.className = "board-pieces-piece"
								pieceElement.setAttribute("x", piece.x)
								pieceElement.setAttribute("y", piece.y)
								pieceElement.setAttribute("team", piece.team)
								pieceElement.innerHTML = `<svg viewBox="10 10 80 80"><path d="${svgPath}"></path></svg>`
								pieceElement.addEventListener(TRIGGERS.click, selectPiece)
							pieceSquare.appendChild(pieceElement)
					}
			} catch (error) {console.log(error)}
		}

	/* displayPlayers */
		function displayPlayers(game) {
			try {
				// turn indicator
					ELEMENTS["players"].setAttribute("turn", game.turn)

				// hunter count
					ELEMENTS["players-hunters"].setAttribute("tally", game.deaths)

				// add hunters
					const hunterCount = game.pieces.filter(piece => piece.team).length || 0
					ELEMENTS["players-action-add"].setAttribute("count", hunterCount)

				// capture
					if (game.capture) {
						ELEMENTS["body"].setAttribute("capture", true)
					}
					else {
						ELEMENTS["body"].removeAttribute("capture")
					}

				// winner
					if (game.winner !== null) {
						ELEMENTS["body"].setAttribute("winner", game.winner)
					}
			} catch (error) {console.log(error)}
		}

	/* displayEnd */
		function displayEnd(game) {
			try {
				// set message
					ELEMENTS["postgame-message"].innerText = game.winner ? "hunters win" : "ghost wins"

				// unhide postgame
					ELEMENTS["postgame"].setAttribute("visibility", true)
			} catch (error) {console.log(error)}
		}

	/* displayLegalMoves */
		function displayLegalMoves(piece) {
			try {
				// remove highlighted squares
					const highlightedSquares = Array.from(ELEMENTS["board-pieces"].querySelectorAll(".board-pieces-square[highlighted=true]"))
					for (const square of highlightedSquares) {
						square.removeAttribute("highlighted")
					}

				// no piece?
					if (!piece) {
						return
					}

				// piece
					for (const move of piece.legalMoves) {
						// current square
							if (move.x == piece.x && move.y == piece.y) {
								continue
							}

						// other squares
							const square = ELEMENTS["board-pieces"].querySelector(`.board-pieces-square[x='${move.x}'][y='${move.y}']`)
							square.setAttribute("highlighted", true)
					}
			} catch (error) {console.log(error)}
		}

/*** actions ***/
	/* quitGame */
		ELEMENTS["players-resign"]?.addEventListener(TRIGGERS.click, quitGame)
		function quitGame(event) {
			try {
				// not a player?
					if (!STATE.playerId || !STATE.game.players[STATE.playerId] || STATE.game.players[STATE.playerId].team == undefined) {
						return
					}

				// ended?
					if (STATE.game.timeEnd) {
						return
					}

				// confirm
					if (!window.confirm("Are you sure you want to resign?")) {
						return
					}

				// data
					const data = {
						action: "quitGame",
						player: STATE.playerId
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}

	/* movePiece */
		function movePiece(event) {
			try {
				// not a player?
					if (!STATE.playerId || !STATE.game.players[STATE.playerId] || STATE.game.players[STATE.playerId].team == undefined) {
						return
					}

				// ended?
					if (STATE.game.timeEnd) {
						return
					}

				// not your turn?
					if (STATE.game.turn !== STATE.game.players[STATE.playerId].team) {
						return
					}

				// no piece selected?
					if (!STATE.selected) {
						return
					}

				// get target
					const targetSquare = event.target.closest(".board-pieces-square")
					const target = {
						x: Number(targetSquare.getAttribute("x")),
						y: Number(targetSquare.getAttribute("y"))
					}

				// not highlighted?
					if (!targetSquare.getAttribute("highlighted")) {
						return
					}

				// not a legal move
					if (!STATE.selected.legalMoves.find(move => move.x == target.x && move.y == target.y)) {
						return
					}

				// data
					const data = {
						action: "updateGame",
						player: STATE.playerId,
						piece: {
							x: STATE.selected.x,
							y: STATE.selected.y,
							team: STATE.selected.team
						},
						target: {
							x: target.x,
							y: target.y
						}
					}
					if (STATE.selected.add) {
						data.piece.add = true
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}

	/* passTurn */
		ELEMENTS["players-action-pass"]?.addEventListener(TRIGGERS.click, passTurn)
		function passTurn(event) {
			try {
				// not a player?
					if (!STATE.playerId || !STATE.game.players[STATE.playerId] || STATE.game.players[STATE.playerId].team == undefined) {
						return
					}

				// ended?
					if (STATE.game.timeEnd) {
						return
					}

				// not your turn?
					if (STATE.game.turn !== STATE.game.players[STATE.playerId].team) {
						return
					}

				// get ghost position
					const ghostElement = ELEMENTS["board-pieces"].querySelector("[team='0']")
					const ghostX = Number(ghostElement.getAttribute("x"))
					const ghostY = Number(ghostElement.getAttribute("y"))

				// data
					const data = {
						action: "updateGame",
						player: STATE.playerId,
						piece: {
							x: ghostX,
							y: ghostY,
							team: 0 // ghost
						},
						target: {
							x: ghostX,
							y: ghostY
						}
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}

	/* startRematch */
		ELEMENTS["postgame-rematch"]?.addEventListener(TRIGGERS.click, startRematch)
		function startRematch(event) {
			try {
				// data
					const data = {
						action: "rematchGame",
						player: STATE.playerId
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}

	/* startNew */
		ELEMENTS["postgame-new"]?.addEventListener(TRIGGERS.click, startNew)
		function startNew(event) {
			try {
				// redirect
					window.location = "/"
			} catch (error) {console.log(error)}
		}

/*** selections ***/
	/* selectPiece */
		function selectPiece(event) {
			try {
				// don't bubble up
					event.preventDefault()
					event.stopPropagation()

				// ended?
					if (STATE.game.timeEnd) {
						return
					}

				// get piece
					const pieceElement = event.target.closest(".board-pieces-piece")

				// already selected?
					if (STATE.selected) {
						// clicking on same piece --> unselect
							if (STATE.selected.element == pieceElement) {
								unselectPiece()
								return
							}

						// capture?
							const playerTeam = STATE.game.players[STATE.playerId].team
							const newPieceTeam = Number(pieceElement.getAttribute("team"))
							const pieceX = Number(pieceElement.getAttribute("x"))
							const pieceY = Number(pieceElement.getAttribute("y"))
							if (STATE.selected.team == playerTeam && newPieceTeam !== playerTeam && STATE.selected.legalMoves.find(move => move.x == pieceX && move.y == pieceY)) {
								movePiece(event)
								return
							}

						// otherwise --> unselect
							unselectPiece()
					}

				// select
					const team = Number(pieceElement.getAttribute("team"))
					STATE.selected = {
						element: pieceElement,
						x: Number(pieceElement.getAttribute("x")),
						y: Number(pieceElement.getAttribute("y")),
						team: team
					}
					STATE.selected.legalMoves = getLegalMoves(STATE.selected)

				// highlight
					STATE.selected.element.setAttribute("selected", true)
					displayLegalMoves(STATE.selected)
			} catch (error) {console.log(error)}
		}

	/* selectAddPiece */
		ELEMENTS["players-action-add"]?.addEventListener(TRIGGERS.click, selectAddPiece)
		function selectAddPiece(event) {
			try {
				// not a player?
					if (!STATE.playerId || !STATE.game.players[STATE.playerId] || STATE.game.players[STATE.playerId].team == undefined) {
						return
					}

				// ended?
					if (STATE.game.timeEnd) {
						return
					}

				// not your turn?
					if (STATE.game.turn !== STATE.game.players[STATE.playerId].team) {
						return
					}

				// already selected?
					if (STATE.selected) {
						unselectPiece()
					}

				// select
					STATE.selected = {
						element: null,
						x: null,
						y: null,
						team: 1, // hunters
						add: true
					}
					STATE.selected.legalMoves = getLegalMoves(STATE.selected)

				// highlight
					displayLegalMoves(STATE.selected)
			} catch (error) {console.log(error)}
		}

	/* unselectPiece */
		function unselectPiece() {
			try {
				// no piece selected
					if (!STATE.selected) {
						return
					}

				// unhighlight
					if (STATE.selected.element) {
						STATE.selected.element.removeAttribute("selected")
					}
					displayLegalMoves(null)

				// deselect
					STATE.selected = null
			} catch (error) {console.log(error)}
		}

/* helpers */
	/* getLegalMoves */
		function getLegalMoves(piece) {
			try {
				// moves
					const moves = []

				// hunter - add
					if (piece.team == 1 && piece.add) {
						// top-left corner
							let x = 0
							let y = 0

						// across top
							while (x < STATE.game.width) {
								if (isLegalSquare(x, y, piece.team)) {
									moves.push({x: x, y: y})
								}
								x++
							}
							x--

						// down right
							while (y < STATE.game.height) {
								if (isLegalSquare(x, y, piece.team)) {
									moves.push({x: x, y: y})
								}
								y++
							}
							y--

						// across bottom
							while (x >= 0) {
								if (isLegalSquare(x, y, piece.team)) {
									moves.push({x: x, y: y})
								}
								x--
							}
							x++

						// up left
							while (y >= 0) {
								if (isLegalSquare(x, y, piece.team)) {
									moves.push({x: x, y: y})
								}
								y--
							}
							y++

						return moves
					}

				// hunter - existing
					if (piece.team == 1) {
						// coordinates
							let x, y

						// N
							x = 0
							y = -1
							while (isLegalSquare(piece.x + x, piece.y + y, piece.team)) {
								moves.push({x: piece.x + x, y: piece.y + y})
								y--
							}

						// NE
							x = 1
							y = -1
							while (isLegalSquare(piece.x + x, piece.y + y, piece.team)) {
								moves.push({x: piece.x + x, y: piece.y + y})
								x++
								y--
							}

						// E
							x = 1
							y = 0
							while (isLegalSquare(piece.x + x, piece.y + y, piece.team)) {
								moves.push({x: piece.x + x, y: piece.y + y})
								x++
							}

						// SE
							x = 1
							y = 1
							while (isLegalSquare(piece.x + x, piece.y + y, piece.team)) {
								moves.push({x: piece.x + x, y: piece.y + y})
								x++
								y++
							}

						// S
							x = 0
							y = 1
							while (isLegalSquare(piece.x + x, piece.y + y, piece.team)) {
								moves.push({x: piece.x + x, y: piece.y + y})
								y++
							}

						// SW
							x = -1
							y = 1
							while (isLegalSquare(piece.x + x, piece.y + y, piece.team)) {
								moves.push({x: piece.x + x, y: piece.y + y})
								x--
								y++
							}

						// W
							x = -1
							y = 0
							while (isLegalSquare(piece.x + x, piece.y + y, piece.team)) {
								moves.push({x: piece.x + x, y: piece.y + y})
								x--
							}

						// NW
							x = -1
							y = -1
							while (isLegalSquare(piece.x + x, piece.y + y, piece.team)) {
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
						if (isLegalSquare(piece.x - 1, piece.y - 2, piece.team)) {
							moves.push({x: piece.x - 1, y: piece.y - 2})
						}

					// NE
						if (isLegalSquare(piece.x + 1, piece.y - 2, piece.team)) {
							moves.push({x: piece.x + 1, y: piece.y - 2})
						}

					// EN
						if (isLegalSquare(piece.x + 2, piece.y - 1, piece.team)) {
							moves.push({x: piece.x + 2, y: piece.y - 1})
						}

					// ES
						if (isLegalSquare(piece.x + 2, piece.y + 1, piece.team)) {
							moves.push({x: piece.x + 2, y: piece.y + 1})
						}

					// SE
						if (isLegalSquare(piece.x + 1, piece.y + 2, piece.team)) {
							moves.push({x: piece.x + 1, y: piece.y + 2})
						}

					// SW
						if (isLegalSquare(piece.x - 1, piece.y + 2, piece.team)) {
							moves.push({x: piece.x - 1, y: piece.y + 2})
						}

					// WS
						if (isLegalSquare(piece.x - 2, piece.y + 1, piece.team)) {
							moves.push({x: piece.x - 2, y: piece.y + 1})
						}

					// WN
						if (isLegalSquare(piece.x - 2, piece.y - 1, piece.team)) {
							moves.push({x: piece.x - 2, y: piece.y - 1})
						}

					return moves
			} catch (error) {console.log(error)}
		}

	/* isLegalSquare */
		function isLegalSquare(x, y, team) {
			try {
				// outside the board
					if (x < 0 || y < 0 || x >= STATE.game.width || y >= STATE.game.height) {
						return false
					}

				// obstacle
					if (STATE.game.obstacles.find(obstacle => obstacle.x == x && obstacle.y == y)) {
						return false
					}

				// allied hunter
					if (team == 1 && STATE.game.pieces.find(piece => piece.x == x && piece.y == y && piece.team == team)) {
						return false
					}

				// legal
					return true
			} catch (error) {console.log(error)}
		}

	/* isGhostVisible */
		function isGhostVisible(game) {
			try {
				// get ghost location
					const ghost = game.pieces.find(piece => piece.team == 0)

				// get hunters
					const hunters = game.pieces.filter(piece => piece.team == 1)

				// get visible squares
					const visibleSquares = []
					for (const h in hunters) {
						visibleSquares.push(...getLegalMoves(hunters[h]))
					}

				// loop through visible squares
					const overlap = visibleSquares.find(square => square.x == ghost.x && square.y == ghost.y)
					return !!overlap
			} catch (error) {console.log(error)}
		}
